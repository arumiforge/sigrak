import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Announcement from '#models/announcement'
import type StaffUser from '#models/staff_user'
import { logStaffActivity } from '#accounts/activity_log'
import {
  loadPlaces,
  refusalFor,
  type AnnouncementDraft,
  type AnnouncementKind,
  type RefusalReason,
  type TargetLevel,
  type TargetRole,
} from './announcement_rules.js'
import { uniqueSlug } from './slugs.js'

/**
 * Writing Kabar in the console (R2-05): save as draft, publish, take
 * back, remove. Every change checks the rules of announcement_rules.ts
 * against the Kabar as it is and as it will be, and is logged
 * (`announcement.*`).
 */

const ZONE = 'Asia/Jakarta'

export type AnnouncementInput = {
  title: string
  summary: string | null
  body: string
  kind: AnnouncementKind
  showInApp: boolean
  showPublic: boolean
  targetRegionIds: number[]
  targetSchoolIds: number[]
  targetLevels: TargetLevel[]
  targetRoles: TargetRole[]
  /** "YYYY-MM-DDTHH:mm" in WIB, or null. */
  showFrom: string | null
  showUntil: string | null
}

export class AnnouncementRefusedException extends Error {
  constructor(readonly reason: RefusalReason | 'window' | 'where' | 'state') {
    super(`Announcement change refused: ${reason}`)
  }
}

export function parseLocal(value: string | null) {
  return value ? DateTime.fromISO(value, { zone: ZONE }) : null
}

/** A public-only Kabar has no targets; targets only mean something in the app. */
function cleanInput(input: AnnouncementInput): AnnouncementInput {
  if (input.showInApp) {
    return {
      ...input,
      targetRegionIds: [...new Set(input.targetRegionIds)],
      targetSchoolIds: [...new Set(input.targetSchoolIds)],
      targetLevels: [...new Set(input.targetLevels)],
      targetRoles: [...new Set(input.targetRoles)],
    }
  }
  return { ...input, targetRegionIds: [], targetSchoolIds: [], targetLevels: [], targetRoles: [] }
}

function draftOf(source: AnnouncementInput | Announcement): AnnouncementDraft {
  return {
    kind: source.kind,
    showInApp: source.showInApp,
    showPublic: source.showPublic,
    targetRegionIds: source.targetRegionIds,
    targetSchoolIds: source.targetSchoolIds,
    targetLevels: source.targetLevels,
  }
}

/** Refuses unless the staff member may hold every given Kabar state. */
export async function authorizeAnnouncement(
  staff: StaffUser,
  ...states: (AnnouncementInput | Announcement)[]
) {
  const drafts = states.map(draftOf)
  const places = await loadPlaces(
    drafts.flatMap((draft) => draft.targetRegionIds),
    drafts.flatMap((draft) => draft.targetSchoolIds)
  )
  for (const draft of drafts) {
    const reason = refusalFor(staff, draft, places)
    if (reason) throw new AnnouncementRefusedException(reason)
  }
}

function checkWindow(input: AnnouncementInput) {
  if (!input.showInApp && !input.showPublic) throw new AnnouncementRefusedException('where')
  const from = parseLocal(input.showFrom)
  const until = parseLocal(input.showUntil)
  if (from && !from.isValid) throw new AnnouncementRefusedException('window')
  if (until && !until.isValid) throw new AnnouncementRefusedException('window')
  if (from && until && until <= from) throw new AnnouncementRefusedException('window')
  return { from, until }
}

function columnsOf(input: AnnouncementInput, window: ReturnType<typeof checkWindow>) {
  return {
    title: input.title,
    summary: input.summary,
    body: input.body,
    kind: input.kind,
    showInApp: input.showInApp,
    showPublic: input.showPublic,
    targetRegionIds: input.targetRegionIds,
    targetSchoolIds: input.targetSchoolIds,
    targetLevels: input.targetLevels,
    targetRoles: input.targetRoles,
    startsAt: window.from,
    endsAt: window.until,
  }
}

export async function createAnnouncement(
  staff: StaffUser,
  raw: AnnouncementInput,
  publish: boolean
) {
  const input = cleanInput(raw)
  const window = checkWindow(input)
  await authorizeAnnouncement(staff, input)
  return db.transaction(async (trx) => {
    const announcement = await Announcement.create(
      {
        ...columnsOf(input, window),
        slug: await uniqueSlug(trx, 'announcements', input.title),
        status: publish ? 'published' : 'draft',
        publishedAt: publish ? DateTime.now() : null,
        createdByStaffId: staff.id,
        updatedByStaffId: staff.id,
      },
      { client: trx }
    )
    await logStaffActivity(
      staff,
      publish ? 'announcement.published' : 'announcement.created',
      'announcement',
      announcement.id,
      { title: input.title, kind: input.kind, app: input.showInApp, public: input.showPublic },
      trx
    )
    return announcement
  })
}

export async function updateAnnouncement(
  staff: StaffUser,
  announcement: Announcement,
  raw: AnnouncementInput,
  publish: boolean
) {
  const input = cleanInput(raw)
  const window = checkWindow(input)
  await authorizeAnnouncement(staff, announcement, input)
  await db.transaction(async (trx) => {
    announcement.useTransaction(trx)
    const wasDraft = announcement.status === 'draft'
    announcement.merge({ ...columnsOf(input, window), updatedByStaffId: staff.id })
    // The address stays the same once a Kabar has been published.
    if (wasDraft && announcement.$dirty.title) {
      announcement.slug = await uniqueSlug(trx, 'announcements', input.title, announcement.id)
    }
    if (wasDraft && publish) {
      announcement.status = 'published'
      announcement.publishedAt = DateTime.now()
    }
    const changed = Object.keys(announcement.$dirty)
    await announcement.save()
    await logStaffActivity(
      staff,
      wasDraft && publish ? 'announcement.published' : 'announcement.updated',
      'announcement',
      announcement.id,
      { title: input.title, fields: changed },
      trx
    )
  })
}

export async function unpublishAnnouncement(staff: StaffUser, announcement: Announcement) {
  await authorizeAnnouncement(staff, announcement)
  if (announcement.status !== 'published') throw new AnnouncementRefusedException('state')
  await db.transaction(async (trx) => {
    announcement.useTransaction(trx)
    announcement.merge({ status: 'draft', publishedAt: null, updatedByStaffId: staff.id })
    await announcement.save()
    await logStaffActivity(
      staff,
      'announcement.unpublished',
      'announcement',
      announcement.id,
      { title: announcement.title },
      trx
    )
  })
}

/** Removes a draft; a published Kabar is taken back first. */
export async function deleteAnnouncement(staff: StaffUser, announcement: Announcement) {
  await authorizeAnnouncement(staff, announcement)
  if (announcement.status !== 'draft') throw new AnnouncementRefusedException('state')
  await db.transaction(async (trx) => {
    announcement.useTransaction(trx)
    await announcement.delete()
    await logStaffActivity(
      staff,
      'announcement.deleted',
      'announcement',
      announcement.id,
      { title: announcement.title },
      trx
    )
  })
}
