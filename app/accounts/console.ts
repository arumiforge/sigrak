import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import School from '#models/school'
import type StaffUser from '#models/staff_user'
import User from '#models/user'
import { logStaffActivity } from '#accounts/activity_log'
import { clampDays, extendedSchoolUntil, extendedUserDays, trialOf } from '#accounts/trial'
import type { HttpContext } from '@adonisjs/core/http'
import {
  currentStaff,
  StaffForbiddenException,
  withinScope,
  withinScopeForUser,
} from '#staff/access'

/**
 * Trial changes from the console (D-459), each logged with the staff
 * member and the old and new value.
 */
export type TrialChange = { mode: 'extend' | 'set' | 'clear'; days?: number }

/**
 * A school's trial, for all its teachers:
 *
 * - "Tambah hari" reopens every teacher's trial counted from today,
 *   also trials that ended long ago (D-469): the school's extension end
 *   becomes `days` after the later of today and its current end.
 * - "Atur lama" sets the school's own length, counted from each
 *   teacher's start.
 * - "Ikut bawaan" removes both.
 */
export async function changeSchoolTrial(staff: StaffUser, schoolId: number, change: TrialChange) {
  return db.transaction(async (trx) => {
    const school = await School.query({ client: trx })
      .where('id', schoolId)
      .forUpdate()
      .firstOrFail()
    const before = { days: school.trialDays, extendedUntil: school.trialExtendedUntil }
    if (change.mode === 'extend') {
      school.trialExtendedUntil = extendedSchoolUntil(school.trialExtendedUntil, change.days!)
    } else if (change.mode === 'set') {
      school.trialDays = clampDays(change.days!)
    } else {
      school.trialDays = null
      school.trialExtendedUntil = null
    }
    await school.save()
    await logStaffActivity(
      staff,
      `trial.${change.mode}`,
      'school',
      school.id,
      {
        from: { days: before.days, extended_until: before.extendedUntil?.toISO() ?? null },
        to: { days: school.trialDays, extended_until: school.trialExtendedUntil?.toISO() ?? null },
      },
      trx
    )
    return school
  })
}

/**
 * One person's own trial length. "Tambah" gives `days` more from the
 * later of today and the current end, so an ended trial opens again
 * ("can be extended when it ends", D-459). A trial that never started
 * starts now.
 */
export async function changeUserTrial(staff: StaffUser, userId: number, change: TrialChange) {
  const user = await User.findOrFail(userId)
  const status = await trialOf(user, db.connection())

  return db.transaction(async (trx) => {
    user.useTransaction(trx)
    const before = user.trialDays
    if (change.mode !== 'clear' && !user.trialStartedAt) {
      user.trialStartedAt = DateTime.now()
    }
    user.trialDays =
      change.mode === 'clear'
        ? null
        : change.mode === 'extend'
          ? extendedUserDays(status, change.days!)
          : clampDays(change.days!)
    await user.save()
    await logStaffActivity(
      staff,
      `trial.${change.mode}`,
      'user',
      user.id,
      { from: before, to: user.trialDays },
      trx
    )
    return user
  })
}

/**
 * Most days one "Tambah hari" from Penjualan or Koordinator Wilayah may
 * add (`trials.extend`, internal-roles §3: "trial extensions within a
 * limit"). Provisional value until the owner names the limit.
 */
export const TRIAL_EXTEND_MAX_DAYS = 14

/**
 * Who may make a trial change: `trials.manage` within scope for any
 * change, or `trials.extend` within scope for "Tambah hari" up to
 * TRIAL_EXTEND_MAX_DAYS. A 403 otherwise.
 */
export async function authorizeTrialChange(
  ctx: HttpContext,
  change: TrialChange,
  target: { schoolId: number } | { userId: number }
) {
  const staff = await currentStaff(ctx)
  const reaches = (ability: 'trials.manage' | 'trials.extend') =>
    'schoolId' in target
      ? withinScope(staff, ability, target.schoolId)
      : withinScopeForUser(staff, ability, target.userId)
  if (await reaches('trials.manage')) return staff
  if (
    change.mode === 'extend' &&
    (change.days ?? 0) <= TRIAL_EXTEND_MAX_DAYS &&
    (await reaches('trials.extend'))
  ) {
    return staff
  }
  throw new StaffForbiddenException()
}
