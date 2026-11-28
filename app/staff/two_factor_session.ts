import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

/**
 * The step between the password and the code at sign-in (R2-02): a
 * staff member whose password was right but who has not typed a code
 * yet is only remembered in the session, for five minutes, and is not
 * signed in. Nothing is remembered beyond the session (no "trust this
 * device").
 */
const PENDING_KEY = 'staff_two_factor_pending'
export const PENDING_MINUTES = 5

export const TWO_FACTOR_CHALLENGE_PATH = '/masuk/kode'
export const TWO_FACTOR_ENROL_PATH = '/akun/verifikasi-dua-langkah'

type Pending = { id: number; at: number }

export function rememberPending(ctx: HttpContext, staffId: number) {
  ctx.session.regenerate()
  ctx.session.put(PENDING_KEY, { id: staffId, at: Date.now() } satisfies Pending)
}

/** The staff id waiting for a code, or null when there is none or it expired. */
export function pendingStaffId(ctx: HttpContext): number | null {
  const pending = ctx.session.get(PENDING_KEY) as Pending | undefined
  if (!pending || typeof pending.id !== 'number' || typeof pending.at !== 'number') return null
  if (Date.now() - pending.at > PENDING_MINUTES * 60_000) {
    forgetPending(ctx)
    return null
  }
  return pending.id
}

export function forgetPending(ctx: HttpContext) {
  ctx.session.forget(PENDING_KEY)
}

/**
 * A code as typed: digits, maybe with spaces ("482 913"). The format is
 * checked with the code itself, so a typo gets the same plain message
 * as a wrong code.
 */
export const codeValidator = vine.create({
  code: vine.string().trim().maxLength(20),
})
