/*
|--------------------------------------------------------------------------
| HTTP limiters
|--------------------------------------------------------------------------
|
| Fondasi web-baseline §1: rate limits on sign-in per IP and per account.
| The per-account limit (failed attempts only) lives in LoginThrottle.
|
*/

import limiter from '@adonisjs/limiter/services/main'

/**
 * Every POST /masuk from one IP, whatever the account.
 */
export const loginIpThrottle = limiter.define('login_ip', (ctx) => {
  return limiter
    .allowRequests(30)
    .every('1 minute')
    .usingKey(`login_ip_${ctx.request.ip()}`)
    .limitExceeded((error) => {
      error.setMessage(ctx.i18n.t('auth.throttle', { minutes: 1 }))
    })
})
