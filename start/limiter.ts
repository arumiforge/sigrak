/*
|--------------------------------------------------------------------------
| HTTP limiters
|--------------------------------------------------------------------------
|
| Fondasi web-baseline §1: rate limits on sign-in per IP and per account.
| The per-account limit (failed attempts per account and IP) lives in
| app/services/login_attempts.ts; the exam site keys its limits on the
| exam session (app/services/exam_sign_in_limits.ts).
|
| Schools reach the internet through one public IP (D-479), so a limit
| keyed on the IP alone is only a flood brake, sized for a whole lab or
| a teachers' training of 300 people signing in at once.
|
*/

import limiter from '@adonisjs/limiter/services/main'

/** Sign-ins per IP per minute: 300 people, each may try twice (D-479). */
export const SIGN_IN_PER_IP_PER_MINUTE = 600

/**
 * Every POST /masuk on app. and admin. from one IP, whatever the account.
 */
export const loginIpThrottle = limiter.define('login_ip', (ctx) => {
  return limiter
    .allowRequests(SIGN_IN_PER_IP_PER_MINUTE)
    .every('1 minute')
    .usingKey(`login_ip_${ctx.request.ip()}`)
    .limitExceeded((error) => {
      error.setMessage(ctx.i18n.t('auth.throttle', { minutes: 1 }))
    })
})
