import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import StaffUser from '#models/staff_user'
import { loadStaffAccess } from '#staff/access'
import { twoFactorEnabled, twoFactorRequired } from '#staff/two_factor'
import { TWO_FACTOR_ENROL_PATH } from '#staff/two_factor_session'

/**
 * Denies unauthenticated requests and sends them to the login page of
 * the same host. Each host's routes pass exactly one guard.
 *
 * On admin. it also loads the staff member's roles and scopes once for
 * the request (app/staff/access.ts), signs out an account that was
 * disabled while its session was open, and sends an owner or admin
 * without 2FA to the enrolment page before any other page (R2-02).
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
      if (
        twoFactorRequired(user) &&
        !twoFactorEnabled(user) &&
        !ENROLMENT_ROUTES.has(ctx.route?.name ?? '')
      ) {
        return ctx.response.redirect().toPath(TWO_FACTOR_ENROL_PATH)
      }
    }
    return next()
  }
}

/**
 * The only admin. routes an owner or admin without 2FA may open
 * (D-343): the enrolment page, its form and Keluar.
 */
const ENROLMENT_ROUTES = new Set([
  'admin.two_factor.edit',
  'admin.two_factor.confirm',
  'admin.logout',
])
