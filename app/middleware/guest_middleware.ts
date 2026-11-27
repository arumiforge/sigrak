import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

/**
 * Sends a signed-in visitor of a login page to the home of the same
 * host.
 */
export default class GuestMiddleware {
  redirectTo = '/'

  async handle(ctx: HttpContext, next: NextFn, options: { guard: keyof Authenticators }) {
    if (await ctx.auth.use(options.guard).check()) {
      ctx.session.reflash()
      return ctx.response.redirect(this.redirectTo, true)
    }

    return next()
  }
}
