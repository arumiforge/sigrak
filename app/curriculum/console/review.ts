import { createHash } from 'node:crypto'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import { logStaffActivity } from '#accounts/activity_log'
import type StaffUser from '#models/staff_user'
import { staffCan } from '#staff/access'
import CurriculumVersion, { type VersionMeta } from '../models/curriculum_version.js'
import { PolicyProfileResolver } from '../policy/policy_profile_resolver.js'

/**
 * The curriculum console's state changes (R2-08, D-317, D-339):
 *
 *   draft ──sign off──▶ signed_off ──publish──▶ active
 *     ▲                     │                     │
 *     └──withdraw sign-off──┘◀─────rollback───────┘ (back to draft)
 *
 * - A validator (`curriculum.signoff`) signs off a draft, never one
 *   they imported data into (D-339). The sign-off keeps the version's
 *   source-file fingerprint; data imported afterwards blocks publishing
 *   until someone signs off again.
 * - The curriculum role (`curriculum.publish`) publishes a signed-off
 *   version. Its predecessor (`supersedes_id`) stays active, so the
 *   resolver keeps using it for school years before the new version
 *   starts; once a line has an active version, its unpublished
 *   versions are skipped (PolicyProfileResolver).
 * - Rollback sends an active version back to draft (its sign-off is
 *   cleared, so it needs a new review); the previous version is used
 *   again, and a retired predecessor becomes active again.
 *
 * Each change and its log row commit in one transaction, with the
 * version row locked; the resolver cache is cleared after the commit.
 */

export type ReviewRefusal =
  | 'not_draft'
  | 'not_signed_off'
  | 'not_active'
  | 'own_import'
  | 'changed_since_signoff'
  | 'predecessor_unpublished'
  | 'no_data'

export class CurriculumReviewRefusedException extends Exception {
  static status = 422
  static code = 'E_CURRICULUM_REVIEW_REFUSED'

  /** Lang key under `curriculum.errors.*` the page shows. */
  constructor(readonly reason: ReviewRefusal) {
    super(`Curriculum review refused: ${reason}`)
  }
}

/**
 * The fingerprint of a version's data: its source files and their
 * hashes as the import recorded them (`meta.files`, D-229).
 */
export function fingerprintOf(meta: VersionMeta) {
  const files = Object.entries(meta.files ?? {})
    .map(([name, file]) => `${name}:${file.sha256}`)
    .sort()
  return createHash('sha256').update(files.join('\n')).digest('hex')
}

/** Whether the data changed after the sign-off (a file imported again with other content). */
export function changedSinceSignOff(version: CurriculumVersion) {
  return (
    version.signedOffFingerprint !== null &&
    version.signedOffFingerprint !== fingerprintOf(version.meta)
  )
}

/** Whether `staff` may sign off this version: never one they imported into (D-339). */
export function isOwnImport(staff: StaffUser, version: CurriculumVersion) {
  return version.importedByIds.includes(staff.id)
}

async function lockVersion(trx: TransactionClientContract, id: number) {
  return CurriculumVersion.query({ client: trx }).where('id', id).forUpdate().firstOrFail()
}

async function change<T>(work: (trx: TransactionClientContract) => Promise<T>) {
  const result = await db.transaction(work)
  PolicyProfileResolver.clearCache()
  return result
}

function requireAbility(staff: StaffUser, ability: Parameters<typeof staffCan>[1]) {
  if (!staffCan(staff, ability)) throw new Error(`${ability} is checked by the caller`)
}

export async function signOff(staff: StaffUser, versionId: number, note: string | null) {
  requireAbility(staff, 'curriculum.signoff')
  return change(async (trx) => {
    const version = await lockVersion(trx, versionId)
    if (version.status !== 'draft') throw new CurriculumReviewRefusedException('not_draft')
    if (isOwnImport(staff, version)) throw new CurriculumReviewRefusedException('own_import')
    if (Object.keys(version.meta.files ?? {}).length === 0) {
      throw new CurriculumReviewRefusedException('no_data')
    }
    const fingerprint = fingerprintOf(version.meta)
    version.merge({
      status: 'signed_off',
      signedOffById: staff.id,
      signedOffAt: DateTime.now(),
      signOffNote: note,
      signedOffFingerprint: fingerprint,
    })
    await version.save()
    await logStaffActivity(
      staff,
      'curriculum.signoff',
      'curriculum_version',
      version.id,
      { code: version.code, note, fingerprint },
      trx
    )
    return version
  })
}

export async function withdrawSignOff(staff: StaffUser, versionId: number) {
  requireAbility(staff, 'curriculum.signoff')
  return change(async (trx) => {
    const version = await lockVersion(trx, versionId)
    if (version.status !== 'signed_off') {
      throw new CurriculumReviewRefusedException('not_signed_off')
    }
    const previous = { by: version.signedOffById, at: version.signedOffAt?.toISO() ?? null }
    clearSignOff(version)
    version.status = 'draft'
    await version.save()
    await logStaffActivity(
      staff,
      'curriculum.signoff_withdraw',
      'curriculum_version',
      version.id,
      { code: version.code, signed_off: previous },
      trx
    )
    return version
  })
}

export async function publish(staff: StaffUser, versionId: number) {
  requireAbility(staff, 'curriculum.publish')
  return change(async (trx) => {
    const version = await lockVersion(trx, versionId)
    if (version.status !== 'signed_off') {
      throw new CurriculumReviewRefusedException('not_signed_off')
    }
    if (changedSinceSignOff(version)) {
      throw new CurriculumReviewRefusedException('changed_since_signoff')
    }
    // Someone who imported after the sign-off cannot have it count as theirs.
    if (version.signedOffById !== null && version.importedByIds.includes(version.signedOffById)) {
      throw new CurriculumReviewRefusedException('own_import')
    }
    if (version.supersedesId !== null) {
      const predecessor = await lockVersion(trx, version.supersedesId)
      if (predecessor.status === 'draft' || predecessor.status === 'signed_off') {
        throw new CurriculumReviewRefusedException('predecessor_unpublished')
      }
    }
    version.merge({ status: 'active', publishedById: staff.id, publishedAt: DateTime.now() })
    await version.save()
    await logStaffActivity(
      staff,
      'curriculum.publish',
      'curriculum_version',
      version.id,
      { code: version.code, signed_off_by: version.signedOffById },
      trx
    )
    return version
  })
}

export async function rollback(staff: StaffUser, versionId: number) {
  requireAbility(staff, 'curriculum.publish')
  return change(async (trx) => {
    const version = await lockVersion(trx, versionId)
    if (version.status !== 'active') throw new CurriculumReviewRefusedException('not_active')

    let restored: CurriculumVersion | null = null
    if (version.supersedesId !== null) {
      restored = await lockVersion(trx, version.supersedesId)
      if (restored.status === 'retired') {
        restored.status = 'active'
        await restored.save()
      }
    }
    const previous = {
      signed_off_by: version.signedOffById,
      published_by: version.publishedById,
      published_at: version.publishedAt?.toISO() ?? null,
    }
    clearSignOff(version)
    version.merge({ status: 'draft', publishedById: null, publishedAt: null })
    await version.save()
    await logStaffActivity(
      staff,
      'curriculum.rollback',
      'curriculum_version',
      version.id,
      { code: version.code, restored: restored?.code ?? null, ...previous },
      trx
    )
    return { version, restored }
  })
}

function clearSignOff(version: CurriculumVersion) {
  version.merge({
    signedOffById: null,
    signedOffAt: null,
    signOffNote: null,
    signedOffFingerprint: null,
  })
}

/**
 * Records who imported data into a version (`curriculum:import --by`),
 * so they cannot sign it off (D-339), and logs the import.
 */
export async function recordImport(
  staff: StaffUser,
  versionCode: string,
  details: { file: string; changes: number }
) {
  await db.transaction(async (trx) => {
    const version = await CurriculumVersion.query({ client: trx })
      .where('code', versionCode)
      .forUpdate()
      .first()
    if (!version) return
    if (!version.importedByIds.includes(staff.id)) {
      await trx
        .from('curriculum_versions')
        .where('id', version.id)
        .update({
          imported_by_ids: trx.raw('array_append(imported_by_ids, ?::bigint)', [staff.id]),
        })
    }
    await logStaffActivity(
      staff,
      'curriculum.import',
      'curriculum_version',
      version.id,
      { code: version.code, status: version.status, ...details },
      trx
    )
  })
}
