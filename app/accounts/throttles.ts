import limiter from '@adonisjs/limiter/services/main'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Loose per-IP limits on the forms that work without a session (D-183):
 * a whole school, or a training of 300 teachers, shares one public IP
 * (D-479), so these are flood brakes, not per-person limits. Sign-in
 * keeps its own limits (start/limiter.ts, app/services/login_attempts.ts).
 */
function perIp(name: string, requests: number) {
  return limiter.define(name, (ctx: HttpContext) =>
    limiter
      .allowRequests(requests)
      .every('1 minute')
      .usingKey(`${name}_${ctx.request.ip()}`)
      .limitExceeded((error) => {
        error.setMessage(ctx.i18n.t('auth.throttle', { minutes: 1 }))
      })
  )
}

/** "Lupa kata sandi" requests (D-183 had 5; raised for a shared IP, D-479). */
export const resetLinkThrottle = perIp('reset_link', 30)

/** New password from a reset link. */
export const resetPasswordThrottle = perIp('reset_password', 60)

/** Self sign-up: a training where every teacher signs up at once. */
export const signUpThrottle = perIp('sign_up', 120)

/** Accepting an invitation: the operator invites the whole school at once. */
export const invitationThrottle = perIp('invitation_accept', 120)

/** Using a sign-up confirmation link (D-469). */
export const confirmEmailThrottle = perIp('confirm_email', 120)

/**
 * Sending the confirmation link again from Akun: 3 per 10 minutes per
 * account (D-469), so a mailbox is not flooded.
 */
export const resendConfirmationThrottle = limiter.define(
  'resend_confirmation',
  (ctx: HttpContext) =>
    limiter
      .allowRequests(3)
      .every('10 minutes')
      .usingKey(`resend_confirmation_${ctx.auth.use('web').user?.id ?? ctx.request.ip()}`)
      .limitExceeded((error) => {
        error.setMessage(ctx.i18n.t('auth.confirm.resend_throttle', { minutes: 10 }))
      })
)
