import type { HttpContext } from '@adonisjs/core/http'
import { EmailTakenError } from '#accounts/errors'
import { backWithFieldError } from '#accounts/http'
import { signUp } from '#accounts/sign_up'
import { signUpValidator } from '#validators/accounts'

/**
 * Daftar (D-459): a teacher signs up alone and starts the trial. The
 * public "Coba gratis" button on sigrak.com leads here.
 */
export default class SignUpController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/sign_up', {})
  }

  async store(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(signUpValidator)
    try {
      const user = await signUp(data)
      await ctx.auth.use('web').login(user)
    } catch (error) {
      if (!(error instanceof EmailTakenError)) throw error
      return backWithFieldError(ctx, '/daftar', 'email', ctx.i18n.t('auth.sign_up.email_taken'))
    }
    ctx.session.flash('success', ctx.i18n.t('auth.sign_up.welcome'))
    return ctx.response.redirect().toPath('/akun')
  }
}
