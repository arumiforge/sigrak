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

const TRIAL_EXTEND_MAX_KEY = 'trial.extend_max_days'

/**
 * Most days one "Tambah hari" from Penjualan or Koordinator wilayah may
 * add (`trials.extend`, internal-roles §3) while the console sets no
 * other limit (D-481).
 */
export const DEFAULT_TRIAL_EXTEND_MAX_DAYS = 14

/** A whole number of days in range, else the fallback. */
function daysOr(value: unknown, range: { min: number; max: number }, fallback: number) {
  const days = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(days) && days >= range.min && days <= range.max ? days : fallback
}

const asTrialDays = (value: unknown) => daysOr(value, TRIAL_DAYS_RANGE, FALLBACK_TRIAL_DAYS)
const asExtendMax = (value: unknown) =>
  daysOr(value, TRIAL_INPUT_RANGE, DEFAULT_TRIAL_EXTEND_MAX_DAYS)

/**
 * The trial length for a teacher whose own account and schools set
 * none.
 */
export async function defaultTrialDays(): Promise<number> {
  const row = await AppSetting.findBy('key', DEFAULT_TRIAL_DAYS_KEY)
  return asTrialDays(row?.value)
}

/** The current "Tambah hari" limit for `trials.extend` (D-481). */
export async function trialExtendMaxDays(): Promise<number> {
  const row = await AppSetting.findBy('key', TRIAL_EXTEND_MAX_KEY)
  return asExtendMax(row?.value)
}

/**
 * Writes one setting and its log row (from, to) in one transaction.
 */
async function writeSetting(
  staff: StaffUser,
  key: string,
  value: number,
  read: (raw: unknown) => number
) {
  await db.transaction(async (trx: TransactionClientContract) => {
    const before = await AppSetting.query({ client: trx }).where('key', key).forUpdate().first()
    await trx.rawQuery(
      `INSERT INTO app_settings (key, value, updated_by_staff_id, created_at, updated_at)
       VALUES (?, ?::jsonb, ?, now(), now())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_by_staff_id = EXCLUDED.updated_by_staff_id, updated_at = now()`,
      [key, JSON.stringify(value), staff.id]
    )
    await logStaffActivity(
      staff,
      'setting.updated',
      'setting',
      key,
      { from: read(before?.value), to: value },
      trx
    )
  })
}

/**
 * Changes the default trial length and logs who changed it.
 */
export async function setDefaultTrialDays(staff: StaffUser, days: number) {
  await writeSetting(staff, DEFAULT_TRIAL_DAYS_KEY, days, asTrialDays)
}

/**
 * Changes the "Tambah hari" limit and logs who changed it (D-481).
 */
export async function setTrialExtendMaxDays(staff: StaffUser, days: number) {
  await writeSetting(staff, TRIAL_EXTEND_MAX_KEY, days, asExtendMax)
}
