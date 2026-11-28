import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import School from '#models/school'
import type StaffUser from '#models/staff_user'
import User from '#models/user'
import { logStaffActivity } from '#accounts/activity_log'
import { defaultTrialDays } from '#accounts/settings'
import { clampDays, extendedUserDays, trialOf } from '#accounts/trial'

/**
 * Trial changes from the console (D-459), each logged with the staff
 * member and the old and new value.
 */
export type TrialChange = { mode: 'extend' | 'set' | 'clear'; days?: number }

/**
 * A school's trial length, for all its teachers. "Tambah" adds days to
 * the school's current length (its own, else the default).
 */
export async function changeSchoolTrial(staff: StaffUser, schoolId: number, change: TrialChange) {
  return db.transaction(async (trx) => {
    const school = await School.query({ client: trx })
      .where('id', schoolId)
      .forUpdate()
      .firstOrFail()
    const before = school.trialDays
    const base = before ?? (await defaultTrialDays())
    school.trialDays =
      change.mode === 'clear'
        ? null
        : clampDays(change.mode === 'extend' ? base + change.days! : change.days!)
    await school.save()
    await logStaffActivity(
      staff,
      `trial.${change.mode}`,
      'school',
      school.id,
      { from: before, to: school.trialDays },
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
