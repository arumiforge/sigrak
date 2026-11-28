import limiter from '@adonisjs/limiter/services/main'
import { errors } from '@adonisjs/limiter'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

/**
 * Flood brakes on ujian. sign-in, keyed on the exam session and not on
 * the IP (D-479): a lab of up to 300 pupils signs in through one school
 * IP within the first minute of an exam. Failed attempts per card and
 * IP stay in app/services/login_attempts.ts, so guessing one card's
 * password is still stopped after five tries.
 */

/** Sign-in attempts per open exam session per minute: 300 pupils, each may try three times. */
export const EXAM_SIGN_IN_PER_SESSION_PER_MINUTE = 900

/**
 * Attempts with a card that belongs to no open session have no session
 * to key on; they are braked per IP, loosely, since pupils mistype.
 */
export const UNKNOWN_CARD_PER_IP_PER_MINUTE = 300

/**
 * The open exam session a card name belongs to (the lowest id when the
 * same name is used in several), or null.
 */
async function openSessionOf(username: string): Promise<number | null> {
  const row = (await db
    .from('exam_participants as p')
    .join('exam_sessions as s', 's.id', 'p.exam_session_id')
    .where('p.username', username)
    .where('s.status', 'open')
    .min('s.id as id')
    .first()) as { id: number | string | null } | undefined
  return row?.id === null || row?.id === undefined ? null : Number(row.id)
}

/**
 * Counts one sign-in attempt. Returns null when it may go on, or the
 * message to show when the brake is on.
 */
export async function brakeExamSignIn(ctx: HttpContext, username: string) {
  const sessionId = await openSessionOf(username)
  const [key, requests] =
    sessionId === null
      ? [`exam_unknown_card_${ctx.request.ip()}`, UNKNOWN_CARD_PER_IP_PER_MINUTE]
      : [`exam_session_${sessionId}`, EXAM_SIGN_IN_PER_SESSION_PER_MINUTE]
  try {
    await limiter.use({ requests, duration: '1 minute' }).consume(key)
    return null
  } catch (error) {
    if (error instanceof errors.E_TOO_MANY_REQUESTS) {
      const minutes = Math.max(1, Math.ceil(error.response.availableIn / 60))
      return ctx.i18n.t('auth.throttle', { minutes })
    }
    throw error
  }
}
