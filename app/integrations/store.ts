import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import IntegrationSetting from '#models/integration_setting'
import type StaffUser from '#models/staff_user'
import { logStaffActivity } from '#accounts/activity_log'

/**
 * Integration settings set in the console instead of env (D-431,
 * Fondasi F-005). Core secrets (database, APP_KEY, backup keys) stay in
 * env and never come here.
 *
 * Each integration's values are one object, encrypted whole with the
 * app key and bound to its key (the encryption purpose), so a payload
 * copied to another row does not decrypt. Pages get the values through
 * each integration's `present` function: plain fields in full, secrets
 * only as their last four characters. Every change is logged with the
 * names of the fields that changed, never a secret.
 */

export type MailSecurity = 'starttls' | 'tls'

/** SMTP for transactional mail (D-110, D-431); used only while MAIL_MAILER is empty in env. */
export type MailSettings = {
  host: string
  port: number
  security: MailSecurity
  username: string
  password: string
  fromAddress: string
  fromName: string
}

/** One of the owner's OpenAI-compatible keys for the chatbot (D-393, F-019). */
export type ChatbotKey = { id: string; label: string; secret: string; addedAt: string }

export type ChatbotSettings = {
  baseUrl: string
  model: string
  /** Tried in order, with failover (F-019). */
  keys: ChatbotKey[]
}

/** S3-compatible storage (R2, D-400). Saved only: no live switch yet. */
export type StorageSettings = {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

/**
 * Tim SIGRAK's own Gemini key for the console test button of the AI
 * models page (D-315); never used for a teacher's generation.
 */
export type AiTeamKeySettings = { geminiKey: string }

export type IntegrationPayloads = {
  mail: MailSettings
  chatbot: ChatbotSettings
  storage: StorageSettings
  ai_team_key: AiTeamKeySettings
}

export type IntegrationKey = keyof IntegrationPayloads

export const INTEGRATION_KEYS: IntegrationKey[] = ['mail', 'chatbot', 'storage', 'ai_team_key']

/** Shown instead of a secret: whether it is set and its last four characters. */
export type SecretHint = { set: boolean; last4: string | null }

export function hintOf(secret: string | null | undefined): SecretHint {
  if (!secret) return { set: false, last4: null }
  return { set: true, last4: secret.length > 4 ? secret.slice(-4) : null }
}

const purposeOf = (key: IntegrationKey) => `integration:${key}`

export function encryptPayload<K extends IntegrationKey>(key: K, value: IntegrationPayloads[K]) {
  return encryption.encrypt(value, undefined, purposeOf(key))
}

export function decryptPayload<K extends IntegrationKey>(
  key: K,
  payload: string
): IntegrationPayloads[K] {
  const value = encryption.decrypt<IntegrationPayloads[K]>(payload, purposeOf(key))
  if (!value || typeof value !== 'object') {
    throw new Error(`Integration settings "${key}" cannot be decrypted`)
  }
  return value
}

/** The saved values of an integration, or null when the console holds none. */
export async function readIntegration<K extends IntegrationKey>(
  key: K,
  client?: TransactionClientContract
): Promise<{ value: IntegrationPayloads[K]; updatedAt: Date } | null> {
  const query = client ? IntegrationSetting.query({ client }) : IntegrationSetting.query()
  const row = await query.where('key', key).first()
  if (!row) return null
  return { value: decryptPayload(key, row.payload), updatedAt: row.updatedAt.toJSDate() }
}

/**
 * Field-level differences for the log: plain fields with their old and
 * new value, secrets only as "changed".
 */
export function diffFields<T extends Record<string, unknown>>(
  before: Partial<T> | null,
  after: T,
  secretFields: readonly (keyof T)[]
) {
  const changes: Record<string, unknown> = {}
  for (const field of Object.keys(after) as (keyof T & string)[]) {
    const from = before?.[field] ?? null
    const to = after[field] ?? null
    if (JSON.stringify(from) === JSON.stringify(to)) continue
    changes[field] = secretFields.includes(field) ? 'changed' : { from, to }
  }
  return changes
}

/**
 * Saves an integration and logs the change in one transaction. `build`
 * gets the saved values (or null) and returns the new values and what
 * the log should say; returning null changes nothing.
 */
export async function writeIntegration<K extends IntegrationKey>(
  staff: StaffUser,
  key: K,
  build: (
    before: IntegrationPayloads[K] | null
  ) => { value: IntegrationPayloads[K]; changes: Record<string, unknown>; action?: string } | null
) {
  return db.transaction(async (trx) => {
    const row = await IntegrationSetting.query({ client: trx })
      .where('key', key)
      .forUpdate()
      .first()
    const before = row ? decryptPayload(key, row.payload) : null
    const next = build(before)
    if (!next || Object.keys(next.changes).length === 0) return false

    await trx.rawQuery(
      `INSERT INTO integration_settings (key, payload, updated_by_staff_id, created_at, updated_at)
       VALUES (?, ?, ?, now(), now())
       ON CONFLICT (key) DO UPDATE
         SET payload = EXCLUDED.payload, updated_by_staff_id = EXCLUDED.updated_by_staff_id,
             updated_at = now()`,
      [key, encryptPayload(key, next.value), staff.id]
    )
    await logStaffActivity(
      staff,
      next.action ?? 'integration.updated',
      'integration',
      key,
      next.changes,
      trx
    )
    return true
  })
}

/** Removes an integration's console values (env or nothing applies again). */
export async function clearIntegration(staff: StaffUser, key: IntegrationKey) {
  return db.transaction(async (trx) => {
    const deleted = await trx.from('integration_settings').where('key', key).delete()
    const count = Array.isArray(deleted) ? deleted.length : Number(deleted)
    if (count === 0) return false
    await logStaffActivity(staff, 'integration.cleared', 'integration', key, {}, trx)
    return true
  })
}
