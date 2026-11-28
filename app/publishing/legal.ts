import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import LegalDocument from '#models/legal_document'
import type StaffUser from '#models/staff_user'
import { logStaffActivity } from '#accounts/activity_log'

/**
 * The legal pages of sigrak.com (D-435) and their versions. Each page
 * has a key, a public path (D-149) and its versions; at most one draft
 * at a time. Publishing gives the draft its "berlaku sejak" date for
 * good; a published version is never changed again (database trigger)
 * and stays readable at `?versi=N`.
 */
export const LEGAL_KEYS = ['terms', 'privacy', 'student_data'] as const
export type LegalKey = (typeof LEGAL_KEYS)[number]

export const LEGAL_PATHS: Record<LegalKey, string> = {
  terms: '/syarat-penggunaan',
  privacy: '/kebijakan-privasi',
  student_data: '/perlindungan-data-murid',
}

export function isLegalKey(value: string): value is LegalKey {
  return (LEGAL_KEYS as readonly string[]).includes(value)
}

const ZONE = 'Asia/Jakarta'

export function todayInJakarta() {
  return DateTime.now().setZone(ZONE).toISODate()!
}

export class LegalChangeRefusedException extends Error {
  constructor(readonly reason: 'draft_exists' | 'not_draft') {
    super(`Legal document change refused: ${reason}`)
  }
}

/** The version in force on a date: the newest published one whose date has come. */
export async function currentVersion(key: LegalKey, today = todayInJakarta()) {
  return LegalDocument.query()
    .where('key', key)
    .where('status', 'published')
    .where('effective_on', '<=', today)
    .orderBy('effective_on', 'desc')
    .orderBy('version', 'desc')
    .first()
}

/** A published version that starts later, if any (shown as a note on the page). */
export async function upcomingVersion(key: LegalKey, today = todayInJakarta()) {
  return LegalDocument.query()
    .where('key', key)
    .where('status', 'published')
    .where('effective_on', '>', today)
    .orderBy('effective_on', 'asc')
    .orderBy('version', 'asc')
    .first()
}

/** Every published version of a page, newest first. */
export async function publishedVersions(key: LegalKey) {
  return LegalDocument.query()
    .where('key', key)
    .where('status', 'published')
    .orderBy('version', 'desc')
}

/**
 * Starts the next version of a page as a draft, copying the text of
 * the newest version (or starting empty).
 */
export async function startDraft(
  staff: StaffUser,
  key: LegalKey,
  defaults: { title: string; body: string }
) {
  return db.transaction(async (trx) => {
    const existing = await LegalDocument.query({ client: trx })
      .where('key', key)
      .where('status', 'draft')
      .first()
    if (existing) throw new LegalChangeRefusedException('draft_exists')
    const latest = await LegalDocument.query({ client: trx })
      .where('key', key)
      .orderBy('version', 'desc')
      .forUpdate()
      .first()
    const draft = await LegalDocument.create(
      {
        key,
        version: (latest?.version ?? 0) + 1,
        title: latest?.title ?? defaults.title,
        body: latest?.body ?? defaults.body,
        effectiveOn: DateTime.fromISO(todayInJakarta()),
        changeNote: null,
        status: 'draft',
        publishedAt: null,
        publishedByStaffId: null,
        createdByStaffId: staff.id,
      },
      { client: trx }
    )
    await logStaffActivity(
      staff,
      'legal_document.draft_started',
      'legal_document',
      draft.id,
      { key, version: draft.version },
      trx
    )
    return draft
  })
}

export async function updateDraft(
  staff: StaffUser,
  document: LegalDocument,
  input: { title: string; body: string; effectiveOn: string; changeNote: string | null }
) {
  if (document.status !== 'draft') throw new LegalChangeRefusedException('not_draft')
  await db.transaction(async (trx) => {
    document.useTransaction(trx)
    document.merge({
      title: input.title,
      body: input.body,
      effectiveOn: DateTime.fromISO(input.effectiveOn),
      changeNote: input.changeNote,
    })
    await document.save()
    await logStaffActivity(
      staff,
      'legal_document.updated',
      'legal_document',
      document.id,
      { key: document.key, version: document.version, effective_on: input.effectiveOn },
      trx
    )
  })
}

export async function publishDraft(staff: StaffUser, document: LegalDocument) {
  if (document.status !== 'draft') throw new LegalChangeRefusedException('not_draft')
  await db.transaction(async (trx) => {
    document.useTransaction(trx)
    document.merge({
      status: 'published',
      publishedAt: DateTime.now(),
      publishedByStaffId: staff.id,
    })
    await document.save()
    await logStaffActivity(
      staff,
      'legal_document.published',
      'legal_document',
      document.id,
      {
        key: document.key,
        version: document.version,
        effective_on: document.effectiveOn.toISODate(),
      },
      trx
    )
  })
}

export async function discardDraft(staff: StaffUser, document: LegalDocument) {
  if (document.status !== 'draft') throw new LegalChangeRefusedException('not_draft')
  await db.transaction(async (trx) => {
    document.useTransaction(trx)
    await document.delete()
    await logStaffActivity(
      staff,
      'legal_document.draft_discarded',
      'legal_document',
      document.id,
      { key: document.key, version: document.version },
      trx
    )
  })
}
