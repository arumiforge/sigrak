import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { emailLoginValidator } from '#validators/auth'
import { attemptLogin, backWithError } from '#services/login_attempts'

/**
 * Sign-in for school users on app.
 */
export default class SessionController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/login', { kind: 'email' as const })
  }

  async store(ctx: HttpContext) {
    const { email, password } = await ctx.request.validateUsing(emailLoginValidator)

    const result = await attemptLogin(ctx, 'app', email, 'email', ctx.i18n.t('auth.failed'), () =>
      User.verifyCredentials(email, password).catch(() => null)
    )
    if (!result.ok) {
      return backWithError(ctx, result.field, result.message)
    }

    await ctx.auth.use('web').login(result.account)
    return ctx.response.redirect().toPath('/kalender')
  }

  async destroy({ auth, response, session, i18n }: HttpContext) {
    await auth.use('web').logout()
    session.flash('success', i18n.t('common.toasts.signed_out'))
    return response.redirect().toPath('/masuk')
  }
}
