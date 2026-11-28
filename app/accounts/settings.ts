import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppSetting from '#models/app_setting'
import type StaffUser from '#models/staff_user'
import { logStaffActivity } from '#accounts/activity_log'

/**
 * Runtime settings Tim SIGRAK changes in the console (app_settings).
 * Each key is typed here with its range and the value used when the
 * row is missing.
 */
export const TRIAL_DAYS_RANGE = { min: 1, max: 3650 } as const

/** What a staff member may type for a length or an extension. */
export const TRIAL_INPUT_RANGE = { min: 1, max: 365 } as const

const DEFAULT_TRIAL_DAYS_KEY = 'trial.default_days'

/** D-160: one week, unless the console says otherwise (D-459). */
const FALLBACK_TRIAL_DAYS = 7

function asTrialDays(value: unknown) {
  const days = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(days) && days >= TRIAL_DAYS_RANGE.min && days <= TRIAL_DAYS_RANGE.max
    ? days
    : FALLBACK_TRIAL_DAYS
}

/**
 * The trial length for a teacher whose own account and schools set
 * none.
 */
export async function defaultTrialDays(): Promise<number> {
  const row = await AppSetting.findBy('key', DEFAULT_TRIAL_DAYS_KEY)
  return asTrialDays(row?.value)
}

/**
 * Changes the default trial length and logs who changed it.
 */
export async function setDefaultTrialDays(staff: StaffUser, days: number) {
  await db.transaction(async (trx: TransactionClientContract) => {
    const before = await AppSetting.query({ client: trx })
      .where('key', DEFAULT_TRIAL_DAYS_KEY)
      .forUpdate()
      .first()
    await trx.rawQuery(
      `INSERT INTO app_settings (key, value, updated_by_staff_id, created_at, updated_at)
       VALUES (?, ?::jsonb, ?, now(), now())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_by_staff_id = EXCLUDED.updated_by_staff_id, updated_at = now()`,
      [DEFAULT_TRIAL_DAYS_KEY, JSON.stringify(days), staff.id]
    )
    await logStaffActivity(
      staff,
      'setting.updated',
      'setting',
      DEFAULT_TRIAL_DAYS_KEY,
      { from: asTrialDays(before?.value), to: days },
      trx
    )
  })
}
