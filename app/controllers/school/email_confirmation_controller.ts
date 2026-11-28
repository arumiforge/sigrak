import type { HttpContext } from '@adonisjs/core/http'
import {
  confirmEmail,
  findConfirmationEmail,
  sendEmailConfirmation,
} from '#accounts/email_confirmation'
import { schoolUser } from '#accounts/http'

/**
 * Sign-up confirmation (D-469).
 *
 * - /konfirmasi-email/{token} works with or without a session. The
 *   page asks for one press, so a mail scanner that opens the link does
 *   not confirm the address on its own.
 * - /akun/konfirmasi-email sends the link again (signed in).
 */
export default class EmailConfirmationController {
  async show({ inertia, params, auth }: HttpContext) {
    // An invalid link points a signed-in user to Akun, a guest to Masuk.
    const signedIn = await auth.use('web').check()
    const email = await findConfirmationEmail(params.token)
    return inertia.render('auth/confirm_email', { valid: email !== null, email, signedIn })
  }

  async store({ params, session, i18n, response, auth }: HttpContext) {
    const user = await confirmEmail(params.token)
    if (!user) {
      session.flash('error', i18n.t('auth.confirm.link_invalid'))
      return response.redirect().toPath(`/konfirmasi-email/${params.token}`)
    }
    session.flash('success', i18n.t('auth.confirm.done'))
    const signedIn = await auth.use('web').check()
    return response.redirect().toPath(signedIn ? '/akun' : '/masuk')
  }

  async resend(ctx: HttpContext) {
    const sent = await sendEmailConfirmation(schoolUser(ctx))
    ctx.session.flash(
      'success',
      sent ? ctx.i18n.t('auth.confirm.resent') : ctx.i18n.t('auth.confirm.already')
    )
    return ctx.response.redirect().back()
  }
}
