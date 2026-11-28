import limiter from '@adonisjs/limiter/services/main'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Loose per-IP limits on the forms that work without a session (D-183):
 * a whole school can share one IP, so the numbers are generous. Sign-in
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

/** "Lupa kata sandi" requests: 5 per minute (D-183). */
export const resetLinkThrottle = perIp('reset_link', 5)

/** New password from a reset link. */
export const resetPasswordThrottle = perIp('reset_password', 10)

/** Self sign-up. */
export const signUpThrottle = perIp('sign_up', 10)

/** Accepting an invitation: 10 per minute (D-183). */
export const invitationThrottle = perIp('invitation_accept', 10)

/** Using a sign-up confirmation link (D-469). */
export const confirmEmailThrottle = perIp('confirm_email', 10)

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
