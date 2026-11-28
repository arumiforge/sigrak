import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import vine from '@vinejs/vine'
import type StaffUser from '#models/staff_user'
import { authorizeStaff, schoolScopeOf, staffCan } from '#staff/access'
import CurriculumVersion from '../models/curriculum_version.js'
import { compareVersions } from '../console/compare.js'
import { impactOf } from '../console/impact.js'
import {
  changedSinceSignOff,
  CurriculumReviewRefusedException,
  isOwnImport,
  publish,
  rollback,
  signOff,
  withdrawSignOff,
  type ReviewRefusal,
} from '../console/review.js'

const signOffValidator = vine.create({
  note: vine.string().trim().maxLength(2000).optional(),
})

const compareValidator = vine.create({
  dengan: vine.number().withoutDecimals().positive().optional(),
  mapel: vine
    .string()
    .trim()
    .maxLength(20)
    .regex(/^[A-Z0-9-]+$/)
    .optional(),
})

const KIND_ORDER = { structure: 0, cp: 1, topics: 2 } as const
const STATUS_ORDER = { active: 0, signed_off: 1, draft: 2, retired: 3 } as const

async function staffNames(ids: (number | null)[]) {
  const wanted = [...new Set(ids.filter((id): id is number => id !== null))]
  if (wanted.length === 0) return new Map<number, string>()
  const rows = (await db.from('staff_users').whereIn('id', wanted).select('id', 'name')) as {
    id: number
    name: string
  }[]
  return new Map(rows.map((row) => [Number(row.id), row.name]))
}

/** Subjects with any row in each version (allocations, CP, topics). */
async function subjectCounts(versionIds: number[]) {
  if (versionIds.length === 0) return new Map<number, number>()
  const rows = (await db.rawQuery(
    `SELECT curriculum_version_id AS id, count(DISTINCT subject_id) AS subjects FROM (
       SELECT curriculum_version_id, subject_id FROM subject_allocations
       UNION ALL SELECT curriculum_version_id, subject_id FROM learning_outcomes
       UNION ALL SELECT curriculum_version_id, subject_id FROM topics
     ) rows WHERE curriculum_version_id = ANY(?::bigint[]) GROUP BY curriculum_version_id`,
    [versionIds]
  )) as { rows: { id: string; subjects: string }[] }
  return new Map(rows.rows.map((row) => [Number(row.id), Number(row.subjects)]))
}

async function rowCounts(versionId: number) {
  const count = async (table: string) =>
    Number(
      (
        (await db
          .from(table)
          .where('curriculum_version_id', versionId)
          .count('* as count')
          .first()) as { count: string }
      ).count
    )
  const objectives = Number(
    (
      (await db
        .from('learning_objectives as o')
        .join('topics as t', 't.id', 'o.topic_id')
        .where('t.curriculum_version_id', versionId)
        .count('* as count')
        .first()) as { count: string }
    ).count
  )
  return {
    allocations: await count('subject_allocations'),
    elements: await count('learning_outcome_elements'),
    outcomes: await count('learning_outcomes'),
    topics: await count('topics'),
    objectives,
  }
}

function summaryOf(version: CurriculumVersion) {
  return {
    id: version.id,
    code: version.code,
    name: version.name,
    kind: version.kind,
    status: version.status,
    appliesFrom: version.appliesFromSchoolYear,
    effectiveOn: version.effectiveOn?.toISODate() ?? null,
    changedSinceSignOff: changedSinceSignOff(version),
  }
}

/**
 * Konsol: Kurikulum (R2-08, D-317). The curriculum versions, one
 * version's page with its sign-off and publication, the comparison with
 * the version it replaces, and the impact report.
 *
 * Abilities: `curriculum.view` for every page, `curriculum.signoff` to
 * sign off or withdraw a sign-off (never one's own import, D-339),
 * `curriculum.publish` to publish and roll back. The state changes and
 * their log rows live in app/curriculum/console/review.ts.
 */
export default class CurriculumVersionsController {
  async index(ctx: HttpContext) {
    await authorizeStaff(ctx, 'curriculum.view')
    const versions = await CurriculumVersion.query().orderBy('code', 'asc')
    const subjects = await subjectCounts(versions.map((version) => version.id))
    const codes = new Map(versions.map((version) => [version.id, version.code]))
    const sorted = [...versions].sort(
      (a, b) =>
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.code.localeCompare(b.code)
    )

    return ctx.inertia.render('console/curriculum/versions', {
      versions: sorted.map((version) => ({
        ...summaryOf(version),
        supersedes: version.supersedesId ? (codes.get(version.supersedesId) ?? null) : null,
        subjects: subjects.get(version.id) ?? 0,
        curatedSubjects: version.curatedSubjectCodes().length,
      })),
    })
  }

  async show(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'curriculum.view')
    const version = await this.#version(ctx)
    const predecessor = version.supersedesId
      ? await CurriculumVersion.find(version.supersedesId)
      : null
    const successors = await CurriculumVersion.query()
      .where('supersedes_id', version.id)
      .orderBy('code', 'asc')
    const history = (await db
      .from('staff_activity_logs as l')
      .leftJoin('staff_users as s', 's.id', 'l.staff_user_id')
      .where('l.subject_type', 'curriculum_version')
      .where('l.subject_id', String(version.id))
      .orderBy('l.created_at', 'desc')
      .orderBy('l.id', 'desc')
      .limit(30)
      .select('l.id', 'l.action', 'l.changes', 'l.created_at', 's.name as staff_name')) as {
      id: number
      action: string
      changes: Record<string, unknown>
      created_at: Date
      staff_name: string | null
    }[]
    const names = await staffNames([
      ...version.importedByIds,
      version.signedOffById,
      version.publishedById,
    ])

    return ctx.inertia.render('console/curriculum/version', {
      version: {
        ...summaryOf(version),
        curatedSubjects: version.curatedSubjectCodes(),
        files: Object.keys(version.meta.files ?? {}).sort(),
        importedBy: version.importedByIds.map((id) => names.get(id) ?? `#${id}`),
        signOff: version.signedOffAt
          ? {
              by: version.signedOffById ? (names.get(version.signedOffById) ?? null) : null,
              at: version.signedOffAt.toISO()!,
              note: version.signOffNote,
            }
          : null,
        published: version.publishedAt
          ? {
              by: version.publishedById ? (names.get(version.publishedById) ?? null) : null,
              at: version.publishedAt.toISO()!,
            }
          : null,
      },
      counts: await rowCounts(version.id),
      predecessor: predecessor ? summaryOf(predecessor) : null,
      successors: successors.map(summaryOf),
      history: history.map((row) => ({
        id: Number(row.id),
        action: row.action,
        note: typeof row.changes?.note === 'string' ? row.changes.note : null,
        file: typeof row.changes?.file === 'string' ? row.changes.file : null,
        at: new Date(row.created_at).toISOString(),
        by: row.staff_name,
      })),
      can: this.#can(staff, version, predecessor),
    })
  }

  async compare(ctx: HttpContext) {
    await authorizeStaff(ctx, 'curriculum.view')
    const version = await this.#version(ctx)
    const input = await ctx.request.validateUsing(compareValidator, { data: ctx.request.qs() })

    const options = await CurriculumVersion.query()
      .where('kind', version.kind)
      .whereNot('id', version.id)
      .orderBy('code', 'asc')
    const base =
      options.find((option) => option.id === input.dengan) ??
      options.find((option) => option.id === version.supersedesId) ??
      options.find((option) => option.status === 'active') ??
      null

    let comparison = null
    let subject: string | null = null
    if (base) {
      const first = await compareVersions(base, version, null)
      const changed = first.subjects
        .filter((row) => row.added + row.removed + row.changed > 0 || row.jpBefore !== row.jpAfter)
        // Subjects in both versions first: their row-by-row changes say the most.
        .sort((a, b) => Number(a.presence !== 'both') - Number(b.presence !== 'both'))
      subject =
        first.subjects.find((row) => row.code === input.mapel)?.code ??
        changed[0]?.code ??
        first.subjects[0]?.code ??
        null
      comparison = subject ? await compareVersions(base, version, subject) : first
    }

    return ctx.inertia.render('console/curriculum/compare', {
      version: summaryOf(version),
      base: base ? summaryOf(base) : null,
      options: options.map(summaryOf),
      subject,
      comparison,
    })
  }

  async impact(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'curriculum.view')
    const version = await this.#version(ctx)
    return ctx.inertia.render('console/curriculum/impact', {
      version: summaryOf(version),
      impact: await impactOf(version, schoolScopeOf(staff, 'curriculum.view')),
    })
  }

  async signOff(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'curriculum.signoff')
    const { note } = await ctx.request.validateUsing(signOffValidator)
    return this.#change(ctx, async (id) => {
      const version = await signOff(staff, id, note && note.length > 0 ? note : null)
      return ctx.i18n.t('curriculum.toasts.signed_off', { code: version.code })
    })
  }

  async withdraw(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'curriculum.signoff')
    return this.#change(ctx, async (id) => {
      const version = await withdrawSignOff(staff, id)
      return ctx.i18n.t('curriculum.toasts.withdrawn', { code: version.code })
    })
  }

  async publish(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'curriculum.publish')
    return this.#change(ctx, async (id) => {
      const version = await publish(staff, id)
      return ctx.i18n.t('curriculum.toasts.published', { code: version.code })
    })
  }

  async rollback(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'curriculum.publish')
    return this.#change(ctx, async (id) => {
      const { version, restored } = await rollback(staff, id)
      return restored
        ? ctx.i18n.t('curriculum.toasts.rolled_back', {
            code: version.code,
            previous: restored.code,
          })
        : ctx.i18n.t('curriculum.toasts.unpublished', { code: version.code })
    })
  }

  async #version(ctx: HttpContext) {
    return CurriculumVersion.findOrFail(Number(ctx.params.version))
  }

  /** What the staff member may do on this version now, and why not. */
  #can(staff: StaffUser, version: CurriculumVersion, predecessor: CurriculumVersion | null) {
    const blocked: Extract<
      ReviewRefusal,
      'own_import' | 'changed_since_signoff' | 'predecessor_unpublished'
    >[] = []
    const signoff = staffCan(staff, 'curriculum.signoff')
    const publishAbility = staffCan(staff, 'curriculum.publish')
    const ownImport = isOwnImport(staff, version)
    if (signoff && version.status === 'draft' && ownImport) blocked.push('own_import')
    const changed = changedSinceSignOff(version)
    const predecessorUnpublished =
      predecessor !== null &&
      (predecessor.status === 'draft' || predecessor.status === 'signed_off')
    if (publishAbility && version.status === 'signed_off') {
      if (changed) blocked.push('changed_since_signoff')
      if (predecessorUnpublished) blocked.push('predecessor_unpublished')
    }
    return {
      signOff: signoff && version.status === 'draft' && !ownImport,
      withdraw: signoff && version.status === 'signed_off',
      publish:
        publishAbility && version.status === 'signed_off' && !changed && !predecessorUnpublished,
      rollback: publishAbility && version.status === 'active',
      blocked,
    }
  }

  /** Runs a change on the version in the URL and returns to its page. */
  async #change(ctx: HttpContext, work: (id: number) => Promise<string>) {
    const id = Number(ctx.params.version)
    await CurriculumVersion.findOrFail(id)
    try {
      ctx.session.flash('success', await work(id))
    } catch (error) {
      if (!(error instanceof CurriculumReviewRefusedException)) throw error
      ctx.session.flash('error', ctx.i18n.t(`curriculum.errors.${error.reason}`))
    }
    return ctx.response.redirect().toPath(`/kurikulum/${id}`)
  }
}
