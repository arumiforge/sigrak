import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import StaffUser from '#models/staff_user'
import { loadStaffAccess } from '#staff/access'

/**
 * Denies unauthenticated requests and sends them to the login page of
 * the same host. Each host's routes pass exactly one guard.
 *
 * On admin. it also loads the staff member's roles and scopes once for
 * the request (app/staff/access.ts), and signs out an account that was
 * disabled while its session was open.
 */
export default class AuthMiddleware {
  redirectTo = '/masuk'

  async handle(ctx: HttpContext, next: NextFn, options: { guard: keyof Authenticators }) {
    await ctx.auth.authenticateUsing([options.guard], { loginRoute: this.redirectTo })
    const user = ctx.auth.user
    if (user instanceof StaffUser) {
      if (user.disabledAt) {
        await ctx.auth.use('staff').logout()
        ctx.session.flash('error', ctx.i18n.t('auth.staff_disabled'))
        return ctx.response.redirect().toPath(this.redirectTo)
      }
      await loadStaffAccess(user)
    }
    return next()
  }
}
