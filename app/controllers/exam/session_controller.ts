import type { HttpContext } from '@adonisjs/core/http'
import ExamParticipant from '#models/exam_participant'
import { examCardLoginValidator } from '#validators/auth'
import { attemptLogin, backWithError } from '#services/login_attempts'

/**
 * Sign-in with an exam card on ujian. The proctor token check comes
 * with the exam slice.
 */
export default class SessionController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/login', { kind: 'exam_card' as const })
  }

  async store(ctx: HttpContext) {
    const { username, password } = await ctx.request.validateUsing(examCardLoginValidator)

    const result = await attemptLogin(
      ctx,
      'exam',
      username,
      'username',
      ctx.i18n.t('auth.exam_failed'),
      () => ExamParticipant.verifyCard(username, password)
    )
    if (!result.ok) {
      return backWithError(ctx, result.field, result.message)
    }

    await ctx.auth.use('exam').login(result.account)
    return ctx.response.redirect().toPath('/')
  }

  async destroy({ auth, response, session, i18n }: HttpContext) {
    await auth.use('exam').logout()
    session.flash('success', i18n.t('common.toasts.signed_out'))
    return response.redirect().toPath('/masuk')
  }
}
