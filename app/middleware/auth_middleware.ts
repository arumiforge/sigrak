import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

/**
 * Denies unauthenticated requests and sends them to the login page of
 * the same host. Each host's routes pass exactly one guard.
 */
export default class AuthMiddleware {
  redirectTo = '/masuk'

  async handle(ctx: HttpContext, next: NextFn, options: { guard: keyof Authenticators }) {
    await ctx.auth.authenticateUsing([options.guard], { loginRoute: this.redirectTo })
    return next()
  }
}
