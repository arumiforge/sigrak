import limiter from '@adonisjs/limiter/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import type { Area } from '#config/hosts'

/**
 * Failed sign-ins per area, account and IP (Fondasi web-baseline §1):
 * five failures in a minute block that account from that IP for five
 * minutes. Successful sign-ins are not counted.
 */
const failedLogins = () =>
  limiter.use({ requests: 5, duration: '1 minute', blockDuration: '5 minutes' })

export type LoginResult<T> =
  { ok: true; account: T } | { ok: false; field: string; message: string }

export async function attemptLogin<T>(
  ctx: HttpContext,
  area: Area,
  identifier: string,
  field: string,
  failedMessage: string,
  verify: () => Promise<T | null>
): Promise<LoginResult<T>> {
  const key = `login_${area}_${ctx.request.ip()}_${identifier.toLowerCase()}`

  const [blocked, account] = await failedLogins()
    .penalize(key, async () => {
      const found = await verify()
      if (!found) {
        throw new Error('E_LOGIN_FAILED')
      }
      return found
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === 'E_LOGIN_FAILED') {
        return [null, null] as const
      }
      throw error
    })

  if (blocked) {
    const minutes = Math.max(1, Math.ceil(blocked.response.availableIn / 60))
    return { ok: false, field, message: ctx.i18n.t('auth.throttle', { minutes }) }
  }
  if (!account) {
    return { ok: false, field, message: failedMessage }
  }
  return { ok: true, account }
}

/**
 * Sends the visitor back to the login form with one error on a field,
 * keeping what they typed except the password.
 */
export function backWithError(ctx: HttpContext, field: string, message: string) {
  ctx.session.flashExcept(['password', '_csrf'])
  ctx.session.flash('inputErrorsBag', { [field]: [message] })
  return ctx.response.redirect().toPath('/masuk')
}
