import { Exception } from '@adonisjs/core/exceptions'
import encryption from '@adonisjs/core/services/encryption'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { Secret, TOTP } from 'otpauth'
import qrcode from 'qrcode-generator'
import StaffUser from '#models/staff_user'
import { logStaffActivity } from '#accounts/activity_log'
import { hasRole, loadStaffAccess, staffCan, StaffForbiddenException } from './access.js'
import { HIGH_ROLES } from './roles.js'

/**
 * Staff 2FA with a 6-digit code from an authenticator app (TOTP,
 * D-343, R2-02), on the `otpauth` library (RFC 6238: SHA-1, 6 digits,
 * 30 seconds, one step of clock drift either way).
 *
 * - Required for Pemilik and Admin (the high roles), optional for
 *   everyone else.
 * - The secret is stored encrypted with the app key and only decrypted
 *   to check a code or to show it while enrolling.
 * - A code is accepted once: the time step of the last accepted code is
 *   kept and older or equal steps are refused.
 * - Wrong codes are throttled per account, whatever the IP.
 * - No recovery codes: an admin resets the 2FA (logged) and the staff
 *   member enrols again.
 */

export const TOTP_ISSUER = 'SIGRAK'
const TOTP_DIGITS = 6
const TOTP_PERIOD = 30
const TOTP_WINDOW = 1

/** Five wrong codes in five minutes block the account's codes for fifteen. */
export const WRONG_CODE_LIMIT = 5
const wrongCodes = () =>
  limiter.use({ requests: WRONG_CODE_LIMIT, duration: '5 minutes', blockDuration: '15 minutes' })
const throttleKey = (staff: StaffUser) => `two_factor_${staff.id}`

export class TwoFactorRefusedException extends Exception {
  static status = 422
  static code = 'E_TWO_FACTOR_REFUSED'

  /** Lang key under `two_factor.errors.*` the page shows. */
  constructor(readonly reason: 'self' | 'high_role' | 'not_enrolled' | 'required') {
    super(`Two-factor change refused: ${reason}`)
  }
}

/* ----------------------------------------------------------------------
 * State
 * -------------------------------------------------------------------- */

/** Whether the staff member must use 2FA (Pemilik or Admin, D-343). */
export function twoFactorRequired(staff: StaffUser) {
  return HIGH_ROLES.some((role) => hasRole(staff, role))
}

/** Whether the staff member has confirmed an authenticator. */
export function twoFactorEnabled(staff: StaffUser) {
  return staff.twoFactorConfirmedAt !== null && staff.twoFactorSecret !== null
}

function totpFor(staff: StaffUser, secret: string) {
  return new TOTP({
    issuer: TOTP_ISSUER,
    label: staff.email,
    secret: Secret.fromBase32(secret),
    algorithm: 'SHA1',
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
  })
}

function revealSecret(staff: StaffUser): string {
  if (!staff.twoFactorSecret) throw new Error(`Staff ${staff.id} has no 2FA secret`)
  const plain = encryption.decrypt<string>(staff.twoFactorSecret)
  if (typeof plain !== 'string') throw new Error(`2FA secret of staff ${staff.id} is unreadable`)
  return plain
}

/* ----------------------------------------------------------------------
 * Enrolment
 * -------------------------------------------------------------------- */

/**
 * What the enrolment page shows: the manual key (grouped by four) and
 * the QR code of the otpauth URI as one SVG path. The secret is made on
 * the first visit and kept until it is confirmed, so a reload shows the
 * same code.
 */
export async function enrolmentFor(staff: StaffUser) {
  if (twoFactorEnabled(staff)) throw new TwoFactorRefusedException('required')
  if (!staff.twoFactorSecret) {
    staff.twoFactorSecret = encryption.encrypt(new Secret({ size: 20 }).base32)
    staff.twoFactorLastStep = null
    await staff.save()
  }
  const secret = revealSecret(staff)
  return {
    manualKey: secret.match(/.{1,4}/g)!.join(' '),
    qr: qrPath(totpFor(staff, secret).toString()),
  }
}

/**
 * The QR code of `text` as the `d` of one SVG path in a square of
 * `size` modules (including a four-module quiet zone), so the page
 * draws it without HTML from the server.
 */
export function qrPath(text: string) {
  const code = qrcode(0, 'M')
  code.addData(text)
  code.make()
  const count = code.getModuleCount()
  const quiet = 4
  const parts: string[] = []
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (code.isDark(row, col)) parts.push(`M${col + quiet} ${row + quiet}h1v1h-1z`)
    }
  }
  return { size: count + quiet * 2, path: parts.join('') }
}

/* ----------------------------------------------------------------------
 * Codes
 * -------------------------------------------------------------------- */

export type CodeResult =
  { ok: true } | { ok: false; reason: 'wrong' } | { ok: false; reason: 'blocked'; minutes: number }

class WrongCode extends Error {}

/**
 * Checks a code against the staff member's secret, once: a match
 * stores its time step in the same statement that checks the last one,
 * so two requests cannot both use it. A wrong code counts towards the
 * throttle; while the account is blocked no code is checked.
 */
export async function checkCode(staff: StaffUser, code: string): Promise<CodeResult> {
  const token = code.replace(/\s+/g, '')
  try {
    const [blocked] = await wrongCodes().penalize(throttleKey(staff), async () => {
      if (!(await acceptCode(staff, token))) throw new WrongCode()
      return true
    })
    if (blocked) {
      return {
        ok: false,
        reason: 'blocked',
        minutes: Math.max(1, Math.ceil(blocked.response.availableIn / 60)),
      }
    }
    return { ok: true }
  } catch (error) {
    if (error instanceof WrongCode) return { ok: false, reason: 'wrong' }
    throw error
  }
}

async function acceptCode(staff: StaffUser, token: string) {
  if (!/^\d{6}$/.test(token) || !staff.twoFactorSecret) return false
  const totp = totpFor(staff, revealSecret(staff))
  const delta = totp.validate({
    token,
    window: TOTP_WINDOW,
    afterCounter: staff.twoFactorLastStep ?? undefined,
  })
  if (delta === null) return false
  const step = totp.counter() + delta
  const { rows } = await db.rawQuery(
    `UPDATE staff_users SET two_factor_last_step = ?
      WHERE id = ? AND (two_factor_last_step IS NULL OR two_factor_last_step < ?)
      RETURNING id`,
    [step, staff.id, step]
  )
  if (rows.length === 0) return false
  staff.twoFactorLastStep = step
  staff.$original.twoFactorLastStep = step
  return true
}

/** Clears the wrong-code count after a successful sign-in. */
export async function clearWrongCodes(staff: StaffUser) {
  await wrongCodes().delete(throttleKey(staff))
}

/**
 * Turns 2FA on after the first right code from the new authenticator.
 * Logged as the staff member's own change.
 */
export async function confirmEnrolment(staff: StaffUser, code: string): Promise<CodeResult> {
  if (twoFactorEnabled(staff) || !staff.twoFactorSecret) {
    throw new TwoFactorRefusedException('not_enrolled')
  }
  const result = await checkCode(staff, code)
  if (!result.ok) return result
  await db.transaction(async (trx) => {
    staff.useTransaction(trx)
    staff.twoFactorConfirmedAt = DateTime.now()
    await staff.save()
    await logStaffActivity(staff, 'staff.two_factor_enable', 'staff', staff.id, {}, trx)
  })
  await clearWrongCodes(staff)
  return result
}

/**
 * Turns 2FA off with a current code; only for staff who are not
 * required to use it. Logged.
 */
export async function disableTwoFactor(staff: StaffUser, code: string): Promise<CodeResult> {
  await loadStaffAccess(staff)
  if (twoFactorRequired(staff)) throw new TwoFactorRefusedException('required')
  if (!twoFactorEnabled(staff)) throw new TwoFactorRefusedException('not_enrolled')
  const result = await checkCode(staff, code)
  if (!result.ok) return result
  await db.transaction(async (trx) => {
    staff.useTransaction(trx)
    clearSecret(staff)
    await staff.save()
    await logStaffActivity(staff, 'staff.two_factor_disable', 'staff', staff.id, {}, trx)
  })
  return result
}

function clearSecret(staff: StaffUser) {
  staff.twoFactorSecret = null
  staff.twoFactorConfirmedAt = null
  staff.twoFactorLastStep = null
}

/* ----------------------------------------------------------------------
 * Reset by an admin
 * -------------------------------------------------------------------- */

/**
 * "Atur ulang 2FA" (D-343): removes another staff member's
 * authenticator so they enrol again at their next sign-in. Needs
 * `staff.reset_2fa`; never on oneself; an account that holds Pemilik
 * or Admin only by someone with `staff.manage_high` (the same rule as
 * its roles, so an admin cannot weaken an owner's sign-in). Logged.
 */
export async function resetTwoFactor(actor: StaffUser, targetId: number) {
  await loadStaffAccess(actor)
  if (!staffCan(actor, 'staff.reset_2fa')) throw new StaffForbiddenException()
  await db.transaction(async (trx) => {
    const target = await StaffUser.query({ client: trx })
      .where('id', targetId)
      .forUpdate()
      .firstOrFail()
    await target.load('roleAssignments')
    if (actor.id === target.id) throw new TwoFactorRefusedException('self')
    if (twoFactorRequired(target) && !staffCan(actor, 'staff.manage_high')) {
      throw new TwoFactorRefusedException('high_role')
    }
    if (!target.twoFactorSecret) throw new TwoFactorRefusedException('not_enrolled')
    const wasEnabled = twoFactorEnabled(target)
    clearSecret(target)
    await target.save()
    await logStaffActivity(
      actor,
      'staff.two_factor_reset',
      'staff',
      target.id,
      { was_enabled: wasEnabled },
      trx
    )
  })
}

/**
 * The same reset from the server (ace `staff:reset-2fa`), for the case
 * where no other owner can do it in the console. Logged without a
 * staff member.
 */
export async function resetTwoFactorFromServer(target: StaffUser) {
  await db.transaction(async (trx) => {
    target.useTransaction(trx)
    const wasEnabled = twoFactorEnabled(target)
    clearSecret(target)
    await target.save()
    await trx.table('staff_activity_logs').insert({
      staff_user_id: null,
      action: 'staff.two_factor_reset',
      subject_type: 'staff',
      subject_id: String(target.id),
      changes: JSON.stringify({ was_enabled: wasEnabled, from: 'server' }),
      created_at: new Date(),
    })
  })
}
