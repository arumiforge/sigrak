import { DateTime } from 'luxon'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type User from '#models/user'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import { defaultTrialDays, TRIAL_DAYS_RANGE } from '#accounts/settings'

/**
 * The flexible trial (D-459, replacing the fixed week of D-160).
 *
 * - The default length is a console setting (`trial.default_days`).
 * - A school may set its own length; it applies to every teacher with
 *   an active membership there.
 * - One teacher may get their own length.
 * - When more than one is set, the longest wins, so an extension given
 *   to a school reaches all its teachers and is never cut short by a
 *   shorter value elsewhere. The default counts only when nothing is
 *   set (so a school or a person can also get a shorter trial).
 * - The trial runs from `users.trial_started_at` (sign-up, or the first
 *   accepted invitation).
 */
export type TrialSource = 'user' | 'school' | 'default'

export type TrialInputs = {
  startedAt: DateTime | null
  userDays: number | null
  schoolDays: (number | null)[]
  defaultDays: number
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
  const { days, source } = trialLength(inputs)
  const endsAt = inputs.startedAt ? inputs.startedAt.plus({ days }) : null
  const active = endsAt !== null && endsAt > now
  const daysLeft = active ? Math.ceil(endsAt.diff(now, 'days').days) : 0
  return { days, source, startedAt: inputs.startedAt, endsAt, active, daysLeft }
}

/**
 * The trial lengths of the schools where the user has an active
 * membership. Reads only the user's own memberships (row-level security
 * lets a user see them before a school is chosen), unless a client is
 * given (a staff transaction in the console).
 */
async function schoolTrialDays(userId: number, client?: QueryClientContract) {
  const read = async (trx: QueryClientContract) => {
    const result = await trx.rawQuery(
      `SELECT s.trial_days FROM school_memberships m
         JOIN schools s ON s.id = m.school_id
        WHERE m.user_id = ? AND m.status = 'active'`,
      [userId]
    )
    return (result.rows as { trial_days: number | null }[]).map((row) => row.trial_days)
  }
  return client ? read(client) : tenantTransaction(read, { schoolId: null, userId })
}

export async function trialOf(user: User, client?: QueryClientContract): Promise<TrialStatus> {
  return trialStatus({
    // A model made in this process may not hold the columns it never set.
    startedAt: user.trialStartedAt ?? null,
    userDays: user.trialDays ?? null,
    schoolDays: await schoolTrialDays(user.id, client),
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

export function clampDays(days: number) {
  return Math.min(TRIAL_DAYS_RANGE.max, Math.max(TRIAL_DAYS_RANGE.min, Math.round(days)))
}
