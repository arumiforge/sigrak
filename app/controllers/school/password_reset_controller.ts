import type { HttpContext } from '@adonisjs/core/http'
import { findResetUser, requestPasswordReset, resetPassword } from '#accounts/password_reset'
import { forgotPasswordValidator, resetPasswordValidator } from '#validators/accounts'

/**
 * Lupa kata sandi (D-183): ask for a link by email, then set a new
 * password from the link. Works without a session.
 */
export default class PasswordResetController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/forgot_password', {})
  }

  /**
   * Same answer whether or not the email has an account.
   */
  async store({ request, session, i18n, response }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)
    await requestPasswordReset(email)
    session.flash('success', i18n.t('auth.reset.link_sent'))
    return response.redirect().toPath('/masuk')
  }

  async edit({ inertia, params }: HttpContext) {
    const user = await findResetUser(params.token)
    return inertia.render('auth/reset_password', {
      valid: user !== null,
      email: user?.email ?? null,
    })
  }

  async update({ request, params, session, i18n, response }: HttpContext) {
    const { password } = await request.validateUsing(resetPasswordValidator)
    const user = await resetPassword(params.token, password)
    if (!user) {
      session.flash('error', i18n.t('auth.reset.link_invalid'))
      return response.redirect().toPath('/lupa-kata-sandi')
    }
    session.flash('success', i18n.t('auth.reset.done'))
    return response.redirect().toPath('/masuk')
  }
}
