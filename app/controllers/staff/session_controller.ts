import type { HttpContext } from '@adonisjs/core/http'
import StaffUser from '#models/staff_user'
import { emailLoginValidator } from '#validators/auth'
import { attemptLogin, backWithError } from '#services/login_attempts'
import { twoFactorEnabled } from '#staff/two_factor'
import { rememberPending, TWO_FACTOR_CHALLENGE_PATH } from '#staff/two_factor_session'

/**
 * Sign-in for Tim SIGRAK staff on admin. With 2FA on, a right password
 * leads to the code step (app/staff/controllers/
 * two_factor_challenge_controller.ts, D-343).
 */
export default class SessionController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/login', { kind: 'email' as const })
  }

  async store(ctx: HttpContext) {
    const { email, password } = await ctx.request.validateUsing(emailLoginValidator)

    const result = await attemptLogin(ctx, 'admin', email, 'email', ctx.i18n.t('auth.failed'), () =>
      StaffUser.verifyCredentials(email, password).catch(() => null)
    )
    if (!result.ok) {
      return backWithError(ctx, result.field, result.message)
    }
    // A disabled account (R2-01) keeps its password but cannot sign in.
    if (result.account.disabledAt) {
      return backWithError(ctx, 'email', ctx.i18n.t('auth.staff_disabled'))
    }

    // With 2FA on, the password only opens the code step (R2-02, D-343).
    if (twoFactorEnabled(result.account)) {
      rememberPending(ctx, result.account.id)
      return ctx.response.redirect().toPath(TWO_FACTOR_CHALLENGE_PATH)
    }

    await ctx.auth.use('staff').login(result.account)
    return ctx.response.redirect().toPath('/')
  }

  async destroy({ auth, response, session, i18n }: HttpContext) {
    await auth.use('staff').logout()
    session.flash('success', i18n.t('common.toasts.signed_out'))
    return response.redirect().toPath('/masuk')
  }
}
