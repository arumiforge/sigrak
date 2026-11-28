import { DateTime } from 'luxon'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type User from '#models/user'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import { defaultTrialDays, TRIAL_DAYS_RANGE } from '#accounts/settings'

/**
 * The flexible trial (D-459, replacing the fixed week of D-160; school
 * extension D-469).
 *
 * - The default length is a console setting (`trial.default_days`).
 * - A school may set its own length; it applies to every teacher with
 *   an active membership there.
 * - One teacher may get their own length.
 * - When more than one is set, the longest wins, so a length given to
 *   a school reaches all its teachers and is never cut short by a
 *   shorter value elsewhere. The default counts only when nothing is
 *   set (so a school or a person can also get a shorter trial).
 * - The length runs from `users.trial_started_at` (sign-up, or the
 *   first accepted invitation).
 * - A school-wide extension (`schools.trial_extended_until`) gives every
 *   teacher of the school the same end, counted from the day it was
 *   given, so it also reopens trials that ended long ago (D-469). The
 *   latest end wins.
 */
export type TrialSource = 'user' | 'school' | 'default'

export type TrialInputs = {
  startedAt: DateTime | null
  userDays: number | null
  schoolDays: (number | null)[]
  defaultDays: number
  /** The extension ends of the user's schools (active memberships). */
  schoolExtendedUntil?: (DateTime | null)[]
}

export type TrialStatus = {
  days: number
  source: TrialSource
  startedAt: DateTime | null
  endsAt: DateTime | null
  active: boolean
  daysLeft: number
}

export function trialLength(inputs: Pick<TrialInputs, 'userDays' | 'schoolDays' | 'defaultDays'>) {
  const schoolDays = inputs.schoolDays.filter((days): days is number => days !== null)
  const longestSchool = schoolDays.length > 0 ? Math.max(...schoolDays) : null
  if (inputs.userDays === null && longestSchool === null) {
    return { days: inputs.defaultDays, source: 'default' as TrialSource }
  }
  if (longestSchool === null || (inputs.userDays !== null && inputs.userDays >= longestSchool)) {
    return { days: inputs.userDays!, source: 'user' as TrialSource }
  }
  return { days: longestSchool, source: 'school' as TrialSource }
}

export function trialStatus(inputs: TrialInputs, now = DateTime.now()): TrialStatus {
  const length = trialLength(inputs)
  let days = length.days
  let source = length.source
  let endsAt = inputs.startedAt ? inputs.startedAt.plus({ days }) : null

  const extension = latest(inputs.schoolExtendedUntil ?? [])
  if (extension && (endsAt === null || extension > endsAt)) {
    endsAt = extension
    source = 'school'
    // The length the trial now has, counted from its start (or from now).
    days = Math.max(1, Math.round(extension.diff(inputs.startedAt ?? now, 'days').days))
  }

  const active = endsAt !== null && endsAt > now
  const daysLeft = active ? Math.ceil(endsAt!.diff(now, 'days').days) : 0
  return { days, source, startedAt: inputs.startedAt, endsAt, active, daysLeft }
}

function latest(dates: (DateTime | null)[]) {
  return dates.reduce<DateTime | null>(
    (found, date) => (date && (!found || date > found) ? date : found),
    null
  )
}

/**
 * The trial settings of the schools where the user has an active
 * membership. Reads only the user's own memberships (row-level security
 * lets a user see them before a school is chosen), unless a client is
 * given (a staff transaction in the console).
 */
async function schoolTrials(userId: number, client?: QueryClientContract) {
  const read = async (trx: QueryClientContract) => {
    const result = await trx.rawQuery(
      `SELECT s.trial_days, s.trial_extended_until FROM school_memberships m
         JOIN schools s ON s.id = m.school_id
        WHERE m.user_id = ? AND m.status = 'active'`,
      [userId]
    )
    const rows = result.rows as {
      trial_days: number | null
      trial_extended_until: Date | string | null
    }[]
    return {
      days: rows.map((row) => row.trial_days),
      extendedUntil: rows.map(({ trial_extended_until: until }) =>
        until === null
          ? null
          : until instanceof Date
            ? DateTime.fromJSDate(until)
            : DateTime.fromSQL(until)
      ),
    }
  }
  return client ? read(client) : tenantTransaction(read, { schoolId: null, userId })
}

export async function trialOf(user: User, client?: QueryClientContract): Promise<TrialStatus> {
  const schools = await schoolTrials(user.id, client)
  return trialStatus({
    // A model made in this process may not hold the columns it never set.
    startedAt: user.trialStartedAt ?? null,
    userDays: user.trialDays ?? null,
    schoolDays: schools.days,
    schoolExtendedUntil: schools.extendedUntil,
    defaultDays: await defaultTrialDays(),
  })
}

/**
 * A user's own length that ends the trial `extraDays` after the later
 * of today and the current end. An ended trial is reopened from today
 * ("can be extended when it ends", D-459).
 */
export function extendedUserDays(status: TrialStatus, extraDays: number, now = DateTime.now()) {
  if (!status.startedAt) return clampDays(extraDays)
  const from = status.endsAt && status.endsAt > now ? status.endsAt : now
  const until = from.plus({ days: extraDays })
  // Rounded, so the seconds between reading the status and saving do not add a day.
  return clampDays(Math.round(until.diff(status.startedAt, 'days').days))
}

/**
 * The new end of a school-wide extension (D-469): `extraDays` after the
 * later of today and the school's current extension end, so every
 * teacher's trial, ended or not, runs at least until then.
 */
export function extendedSchoolUntil(
  current: DateTime | null,
  extraDays: number,
  now = DateTime.now()
) {
  const from = current && current > now ? current : now
  return from.plus({ days: Math.min(TRIAL_DAYS_RANGE.max, Math.max(1, Math.round(extraDays))) })
}

export function clampDays(days: number) {
  return Math.min(TRIAL_DAYS_RANGE.max, Math.max(TRIAL_DAYS_RANGE.min, Math.round(days)))
}
