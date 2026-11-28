import db from '@adonisjs/lucid/services/db'
import type { DatabaseQueryBuilderContract } from '@adonisjs/lucid/types/querybuilder'

/**
 * Which Kabar a reader sees (D-319, D-477).
 *
 * In the app, a published Kabar with `show_in_app` inside its date
 * window reaches a school user when one of their places matches every
 * target: an active membership (role, school level, the school's
 * kabupaten, kecamatan or province, or the school itself), or an
 * approved pengawas assignment (role `supervisor`). A teacher without
 * a school (signed up alone, D-459) only gets Kabar without region,
 * school or level targets that do not leave out teachers.
 *
 * On sigrak.com, a published Kabar with `show_public` inside its date
 * window shows to everyone; targets never apply there.
 */

/** The date window: from starts_at (or publication) until ends_at. */
function inWindow(query: DatabaseQueryBuilderContract, alias: string, now: Date) {
  return query
    .where(`${alias}.status`, 'published')
    .where((start) =>
      start.whereNull(`${alias}.starts_at`).orWhere(`${alias}.starts_at`, '<=', now)
    )
    .where((end) => end.whereNull(`${alias}.ends_at`).orWhere(`${alias}.ends_at`, '>', now))
}

/**
 * The places of one user, as a SQL fragment with its bindings: role,
 * school id, level, kabupaten, kecamatan and province per row.
 */
function placesSql(userId: number) {
  return {
    sql: `
      SELECT m.role::text AS role, s.id AS school_id, s.level::text AS level,
             s.region_id, s.district_id, r.parent_id AS province_id
        FROM school_memberships m
        JOIN schools s ON s.id = m.school_id
        LEFT JOIN regions r ON r.id = s.region_id
       WHERE m.user_id = ? AND m.status = 'active'
      UNION ALL
      SELECT 'supervisor', s.id, s.level::text, s.region_id, s.district_id, r.parent_id
        FROM supervisor_assignments a
        JOIN schools s ON s.id = a.school_id
        LEFT JOIN regions r ON r.id = s.region_id
       WHERE a.user_id = ? AND a.status = 'approved'
         AND (a.ended_on IS NULL OR a.ended_on >= (now() AT TIME ZONE 'Asia/Jakarta')::date)
      UNION ALL
      SELECT 'teacher', NULL::bigint, NULL::text, NULL::bigint, NULL::bigint, NULL::bigint
       WHERE NOT EXISTS (
               SELECT 1 FROM school_memberships m2 WHERE m2.user_id = ? AND m2.status = 'active')
         AND NOT EXISTS (
               SELECT 1 FROM supervisor_assignments a2
                WHERE a2.user_id = ? AND a2.status = 'approved'
                  AND (a2.ended_on IS NULL
                       OR a2.ended_on >= (now() AT TIME ZONE 'Asia/Jakarta')::date))`,
    bindings: [userId, userId, userId, userId],
  }
}

/** Every target of the Kabar under `alias` matches one place `p`. */
const MATCH_SQL = (alias: string) => `
  (cardinality(${alias}.target_roles) = 0 OR p.role = ANY(${alias}.target_roles))
  AND (cardinality(${alias}.target_levels) = 0 OR p.level = ANY(${alias}.target_levels))
  AND (
    (cardinality(${alias}.target_region_ids) = 0 AND cardinality(${alias}.target_school_ids) = 0)
    OR p.school_id = ANY(${alias}.target_school_ids)
    OR p.region_id = ANY(${alias}.target_region_ids)
    OR p.district_id = ANY(${alias}.target_region_ids)
    OR p.province_id = ANY(${alias}.target_region_ids)
  )`

/** Kabar the user may read in the app now (a query on `announcements as a`). */
export function visibleInApp(userId: number, now = new Date()) {
  const places = placesSql(userId)
  const query = db.from('announcements as a').where('a.show_in_app', true)
  inWindow(query, 'a', now)
  return query.whereRaw(`EXISTS (SELECT 1 FROM (${places.sql}) p WHERE ${MATCH_SQL('a')})`, [
    ...places.bindings,
  ])
}

/** Kabar on sigrak.com/kabar now. */
export function visiblePublicly(now = new Date()) {
  const query = db.from('announcements as a').where('a.show_public', true)
  return inWindow(query, 'a', now)
}

/** How many Kabar the user may read and has not opened yet (the header badge). */
export async function unreadCount(userId: number, now = new Date()) {
  const row = (await visibleInApp(userId, now)
    .whereNotExists((reads) =>
      reads
        .from('announcement_reads as ar')
        .whereRaw('ar.announcement_id = a.id')
        .where('ar.user_id', userId)
    )
    .count('* as count')
    .first()) as { count: string | number } | null
  return Number(row?.count ?? 0)
}

/** Marks Kabar as read by the user (idempotent). */
export async function markRead(userId: number, announcementIds: number[]) {
  if (announcementIds.length === 0) return
  const now = new Date()
  await db
    .table('announcement_reads')
    .insert(announcementIds.map((id) => ({ announcement_id: id, user_id: userId, read_at: now })))
    .onConflict(['announcement_id', 'user_id'])
    .ignore()
}
