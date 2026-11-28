import db from '@adonisjs/lucid/services/db'
import type StaffUser from '#models/staff_user'
import type StaffRoleAssignment from '#models/staff_role_assignment'
import { grantsFor, staffCan } from '#staff/access'
import { ROLE_SCOPES, type StaffRole } from '#staff/roles'

/**
 * Who may write which Kabar (D-319, D-477, internal-roles §3 "Kabar to
 * schools"), on top of the ability keys of app/staff/abilities.ts:
 *
 * - `announcements.manage` (owner, admin): every Kabar, every kind and
 *   target, in the app and on sigrak.com.
 * - `announcements.write` (Kurator kurikulum, Dukungan, Pemasaran,
 *   Penjualan, Koordinator wilayah, Teknis): Kabar in the app whose
 *   targets lie inside the role's scope, and only the kinds the role
 *   may write: Kurator kurikulum only curriculum notices, Teknis only
 *   maintenance notices (R2-01 open question), the others general
 *   news and events.
 * - `announcements.public` (Pemasaran besides the two above): also on
 *   sigrak.com/kabar. A public Kabar has no targets.
 *
 * One role assignment must cover the whole Kabar: its kind, every
 * target and the levels. A staff member with two roles does not add
 * one role's kinds to the other role's area.
 */

export const PUBLISH_STATUSES = ['draft', 'published'] as const
export type PublishStatus = (typeof PUBLISH_STATUSES)[number]

export const ANNOUNCEMENT_KINDS = ['general', 'event', 'curriculum', 'maintenance'] as const
export type AnnouncementKind = (typeof ANNOUNCEMENT_KINDS)[number]

export const TARGET_LEVELS = ['sd', 'mi'] as const
export type TargetLevel = (typeof TARGET_LEVELS)[number]

/** School roles a Kabar can target; `supervisor` is a pengawas with an approved assignment. */
export const TARGET_ROLES = ['principal', 'operator', 'teacher', 'supervisor'] as const
export type TargetRole = (typeof TARGET_ROLES)[number]

/** Roles with `announcements.write` limited to some kinds; the rest write DEFAULT_KINDS. */
const KINDS_BY_ROLE: Partial<Record<StaffRole, readonly AnnouncementKind[]>> = {
  curriculum: ['curriculum'],
  engineer: ['maintenance'],
}
const DEFAULT_KINDS: readonly AnnouncementKind[] = ['general', 'event']

export function kindsForRole(role: StaffRole): readonly AnnouncementKind[] {
  return KINDS_BY_ROLE[role] ?? DEFAULT_KINDS
}

/** What a Kabar is, as far as the rules care. */
export type AnnouncementDraft = {
  kind: AnnouncementKind
  showInApp: boolean
  showPublic: boolean
  targetRegionIds: number[]
  targetSchoolIds: number[]
  targetLevels: string[]
}

export type RefusalReason = 'kind' | 'targets' | 'public'

/** Region ancestry and school places needed to judge targets. */
export type Places = {
  /** Region id → itself and its ancestors (kecamatan → kabupaten → province). */
  regionChains: Map<number, number[]>
  /** School id → its kabupaten, kecamatan and province ids. */
  schoolPlaces: Map<number, number[]>
}

/** Loads the places of the given target regions and schools (two queries). */
export async function loadPlaces(regionIds: number[], schoolIds: number[]): Promise<Places> {
  const regionChains = new Map<number, number[]>()
  const schoolPlaces = new Map<number, number[]>()
  const uniqueRegions = [...new Set(regionIds)]
  const uniqueSchools = [...new Set(schoolIds)]
  if (uniqueRegions.length > 0) {
    const rows = (await db
      .from('regions as r')
      .leftJoin('regions as p', 'p.id', 'r.parent_id')
      .whereIn('r.id', uniqueRegions)
      .select('r.id', 'r.parent_id', 'p.parent_id as grandparent_id')) as {
      id: number
      parent_id: number | null
      grandparent_id: number | null
    }[]
    for (const row of rows) {
      regionChains.set(
        Number(row.id),
        [row.id, row.parent_id, row.grandparent_id].filter((id) => id !== null).map(Number)
      )
    }
  }
  if (uniqueSchools.length > 0) {
    const rows = (await db
      .from('schools as s')
      .leftJoin('regions as r', 'r.id', 's.region_id')
      .whereIn('s.id', uniqueSchools)
      .select('s.id', 's.region_id', 's.district_id', 'r.parent_id as province_id')) as {
      id: number
      region_id: number | null
      district_id: number | null
      province_id: number | null
    }[]
    for (const row of rows) {
      schoolPlaces.set(
        Number(row.id),
        [row.region_id, row.district_id, row.province_id].filter((id) => id !== null).map(Number)
      )
    }
  }
  return { regionChains, schoolPlaces }
}

function noTargets(draft: AnnouncementDraft) {
  return draft.targetRegionIds.length === 0 && draft.targetSchoolIds.length === 0
}

/** Whether one assignment's area and levels hold every target of the Kabar. */
function areaCovers(assignment: StaffRoleAssignment, draft: AnnouncementDraft, places: Places) {
  const rule = ROLE_SCOPES[assignment.role]
  const regionIds = rule.area === 'none' ? [] : assignment.regionIds
  const schoolIds = rule.schools ? assignment.schoolIds : []
  const levels = rule.levels ? assignment.levels : []

  if (levels.length > 0) {
    if (draft.targetLevels.length === 0) return false
    if (!draft.targetLevels.every((level) => (levels as string[]).includes(level))) return false
  }

  const hasArea = regionIds.length > 0 || schoolIds.length > 0
  if (rule.area === 'none' || (rule.area === 'optional' && !hasArea)) return true
  if (!hasArea) return false
  // An area-bound role never writes to every school at once.
  if (noTargets(draft)) return false

  const inArea = (ids: number[]) => ids.some((id) => regionIds.includes(id))
  const regionsFit = draft.targetRegionIds.every((id) => inArea(places.regionChains.get(id) ?? []))
  const schoolsFit = draft.targetSchoolIds.every(
    (id) => schoolIds.includes(id) || inArea(places.schoolPlaces.get(id) ?? [])
  )
  return regionsFit && schoolsFit
}

/**
 * Why the staff member may not hold this Kabar, or null when they may.
 * Pass the places of its targets (loadPlaces).
 */
export function refusalFor(
  staff: StaffUser,
  draft: AnnouncementDraft,
  places: Places
): RefusalReason | null {
  if (staffCan(staff, 'announcements.manage')) return null
  if (draft.showPublic && !staffCan(staff, 'announcements.public')) return 'public'

  const grants = grantsFor(staff, 'announcements.write')
  const kindGrants = grants.filter((assignment) =>
    kindsForRole(assignment.role).includes(draft.kind)
  )
  if (kindGrants.length === 0) return 'kind'
  if (!draft.showInApp) return null
  return kindGrants.some((assignment) => areaCovers(assignment, draft, places)) ? null : 'targets'
}

/** Whether the staff member may work on Kabar at all (the console page). */
export function canWriteAnnouncements(staff: StaffUser) {
  return (
    staffCan(staff, 'announcements.manage') ||
    staffCan(staff, 'announcements.write') ||
    staffCan(staff, 'announcements.public')
  )
}

/** The kinds the staff member may pick in the editor. */
export function writableKinds(staff: StaffUser): AnnouncementKind[] {
  if (staffCan(staff, 'announcements.manage')) return [...ANNOUNCEMENT_KINDS]
  const kinds = new Set<AnnouncementKind>()
  for (const assignment of grantsFor(staff, 'announcements.write')) {
    for (const kind of kindsForRole(assignment.role)) kinds.add(kind)
  }
  return ANNOUNCEMENT_KINDS.filter((kind) => kinds.has(kind))
}
