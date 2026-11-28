import { Exception } from '@adonisjs/core/exceptions'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import { logStaffActivity } from '#accounts/activity_log'
import type StaffUser from '#models/staff_user'
import { staffReadTransaction, staffTransaction } from '#tenancy/tenant_transaction'
import { SUPPORT_SESSION_HOURS } from './catalog.js'
import SupportSession from './models/support_session.js'

/**
 * Support sessions (R2-06, D-341, D-469): support opens a school's view
 * read-only under the school MoU. "Lihat sekolah ini" opens one row
 * (staff member, school, start), "Akhiri" or the 2-hour time-out closes
 * it; nothing is logged per page view and nothing is shown to schools.
 *
 * The view itself is read in `staffReadTransaction` (READ ONLY plus
 * `SET LOCAL ROLE sigrak_staff_readonly`), so the database refuses any
 * write during it, and every row passes `withoutSensitiveFields` so
 * religion and health data never leave the server (D-036, D-215).
 * Only the session row itself is written, as staff.
 */

export class NoSupportSessionException extends Exception {
  static status = 404
  static code = 'E_NO_SUPPORT_SESSION'
  static message = 'No open support session.'
}

const EXPIRED = `started_at < now() - interval '${SUPPORT_SESSION_HOURS} hours'`

/**
 * Closes every open session past the time-out, at the moment it timed
 * out (not when someone noticed). Runs before any session is read or
 * opened, so an expired session never counts as open.
 */
export async function closeExpiredSessions(trx: TransactionClientContract) {
  await trx.rawQuery(
    `UPDATE support_sessions
        SET ended_at = started_at + interval '${SUPPORT_SESSION_HOURS} hours'
      WHERE ended_at IS NULL AND ${EXPIRED}`
  )
}

export type OpenSupportSession = {
  id: number
  schoolId: number
  schoolName: string
  startedAt: DateTime
  expiresAt: DateTime
}

function present(row: {
  id: number
  school_id: number
  school_name: string
  started_at: Date
}): OpenSupportSession {
  const startedAt = DateTime.fromJSDate(new Date(row.started_at))
  return {
    id: Number(row.id),
    schoolId: Number(row.school_id),
    schoolName: row.school_name,
    startedAt,
    expiresAt: startedAt.plus({ hours: SUPPORT_SESSION_HOURS }),
  }
}

/**
 * Opens a session on `schoolId` for `staff` (the caller checked
 * `support_sessions.start` and the area scope). An open session of the
 * same staff member on another school is closed first: one at a time.
 */
export async function startSupportSession(staff: StaffUser, schoolId: number) {
  return staffTransaction(async (trx) => {
    await closeExpiredSessions(trx)
    const open = await SupportSession.query({ client: trx })
      .where('staff_user_id', staff.id)
      .whereNull('ended_at')
      .forUpdate()
      .first()
    if (open && open.schoolId === schoolId) return open
    if (open) await endSession(trx, staff, open)
    const session = await SupportSession.create(
      { staffUserId: staff.id, schoolId, startedAt: DateTime.now(), endedAt: null },
      { client: trx }
    )
    await logStaffActivity(
      staff,
      'support_session.start',
      'support_session',
      session.id,
      { school_id: schoolId },
      trx
    )
    return session
  })
}

async function endSession(
  trx: TransactionClientContract,
  staff: StaffUser,
  session: SupportSession
) {
  session.merge({ endedAt: DateTime.now() })
  await session.useTransaction(trx).save()
  await logStaffActivity(
    staff,
    'support_session.end',
    'support_session',
    session.id,
    { school_id: session.schoolId },
    trx
  )
}

/** "Akhiri": closes the staff member's open session, if any. */
export async function endSupportSession(staff: StaffUser) {
  return staffTransaction(async (trx) => {
    await closeExpiredSessions(trx)
    const open = await SupportSession.query({ client: trx })
      .where('staff_user_id', staff.id)
      .whereNull('ended_at')
      .forUpdate()
      .first()
    if (!open) return null
    await endSession(trx, staff, open)
    return open
  })
}

/**
 * The staff member's open session (closing timed-out ones first), or
 * null. Read for the banner on every console page of support staff.
 */
export async function openSupportSessionOf(staffId: number): Promise<OpenSupportSession | null> {
  return staffTransaction(async (trx) => {
    await closeExpiredSessions(trx)
    const row = await trx
      .from('support_sessions as s')
      .join('schools', 'schools.id', 's.school_id')
      .where('s.staff_user_id', staffId)
      .whereNull('s.ended_at')
      .select('s.id', 's.school_id', 's.started_at', 'schools.name as school_name')
      .first()
    return row ? present(row) : null
  })
}

/** The internal list of sessions (newest first), for `support_sessions.view`. */
export async function listSupportSessions(page: number, perPage: number) {
  return staffTransaction(async (trx) => {
    await closeExpiredSessions(trx)
    const total = Number(
      ((await trx.from('support_sessions').count('* as count').first()) as { count: string }).count
    )
    const rows = (await trx
      .from('support_sessions as s')
      .join('schools', 'schools.id', 's.school_id')
      .join('staff_users as st', 'st.id', 's.staff_user_id')
      .orderBy('s.started_at', 'desc')
      .orderBy('s.id', 'desc')
      .limit(perPage)
      .offset((page - 1) * perPage)
      .select(
        's.id',
        's.started_at',
        's.ended_at',
        'schools.id as school_id',
        'schools.name as school_name',
        'st.name as staff_name'
      )) as {
      id: number
      started_at: Date
      ended_at: Date | null
      school_id: number
      school_name: string
      staff_name: string
    }[]
    return { total, rows }
  })
}

/* ----------------------------------------------------------------------
 * Hidden fields (D-036, D-215, D-341)
 * -------------------------------------------------------------------- */

/**
 * Column or prop names that hold religion or health data. Today no
 * table of the support view has one; pupils' religion and the homeroom
 * health records (R5) will, and must stay out of a support session.
 */
const SENSITIVE_NAME = /religion|agama|health|kesehatan|medical|disab|illness|allerg/i

/**
 * A deep copy of `value` without any key that names religion or health
 * data. Every row of the support view passes through it.
 */
export function withoutSensitiveFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => withoutSensitiveFields(item)) as T
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const copy: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_NAME.test(key)) continue
      copy[key] = withoutSensitiveFields(child)
    }
    return copy as T
  }
  return value
}

/* ----------------------------------------------------------------------
 * The school's view
 * -------------------------------------------------------------------- */

/**
 * What support sees of a school during a session: its profile, members,
 * school years, classes with homeroom teachers and the school's own
 * calendar events. No pupils (not in R2), no emails of pupils, no AI
 * keys; read-only throughout. `inspect` runs inside the same read-only
 * transaction (tests use it to prove that writes fail).
 */
export async function readSchoolView(
  schoolId: number,
  inspect?: (trx: TransactionClientContract) => Promise<void>
) {
  return staffReadTransaction(async (trx) => {
    if (inspect) await inspect(trx)
    const school = await trx
      .from('schools as s')
      .leftJoin('regions as r', 'r.id', 's.region_id')
      .leftJoin('regions as d', 'd.id', 's.district_id')
      .where('s.id', schoolId)
      .select(
        's.id',
        's.name',
        's.npsn',
        's.level',
        's.address',
        'r.name as regency_name',
        'r.regency_kind',
        'd.name as district_name'
      )
      .first()
    if (!school) throw new NoSupportSessionException()

    const members = await trx
      .from('school_memberships as m')
      .join('users as u', 'u.id', 'm.user_id')
      .where('m.school_id', schoolId)
      .orderBy('m.status', 'asc')
      .orderBy('m.role', 'asc')
      .orderBy('u.name', 'asc')
      .select('m.public_id', 'm.role', 'm.status', 'm.started_on', 'u.name', 'u.email')

    const years = await trx
      .from('academic_years')
      .where('school_id', schoolId)
      .orderBy('starts_on', 'desc')
      .select('public_id', 'name', 'starts_on', 'ends_on', 'closed_at')

    const classes = await trx
      .from('classes as c')
      .join('academic_years as y', 'y.id', 'c.academic_year_id')
      .leftJoin('users as h', 'h.id', 'c.homeroom_teacher_id')
      .where('c.school_id', schoolId)
      .whereNull('y.closed_at')
      .orderBy('y.starts_on', 'desc')
      .orderBy('c.grade', 'asc')
      .orderBy('c.name', 'asc')
      .limit(200)
      .select(
        'c.public_id',
        'c.grade',
        'c.name',
        'y.name as year_name',
        'h.name as homeroom_name',
        trx.raw(
          `(SELECT count(*)::int FROM teaching_assignments t WHERE t.class_id = c.id) AS assignments`
        )
      )

    const today = DateTime.now().setZone('Asia/Jakarta').toISODate()!
    const events = await trx
      .from('calendar_items as i')
      .join('layer_packages as p', 'p.id', 'i.package_id')
      .where('p.school_id', schoolId)
      .where('i.ends_on', '>=', today)
      .orderBy('i.starts_on', 'asc')
      .limit(20)
      .select('i.id', 'i.title', 'i.starts_on', 'i.ends_on')

    return withoutSensitiveFields({ school, members, years, classes, events })
  })
}
