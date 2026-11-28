import type { HttpContext } from '@adonisjs/core/http'
import StaffUser from '#models/staff_user'
import { backWithFieldError } from '#accounts/http'
import { checkCode, clearWrongCodes, twoFactorEnabled } from '../two_factor.js'
import {
  codeValidator,
  forgetPending,
  pendingStaffId,
  TWO_FACTOR_CHALLENGE_PATH,
} from '../two_factor_session.js'

/**
 * admin. /masuk/kode (R2-02, D-343): the second sign-in step. The
 * password was right; the staff member types the 6-digit code from
 * their authenticator app and is signed in. Without a waiting sign-in
 * (none, expired, or the account changed meanwhile) it goes back to
 * /masuk. Wrong codes are throttled per account (app/staff/
 * two_factor.ts).
 */
export default class TwoFactorChallengeController {
  async create(ctx: HttpContext) {
    if (!(await this.#pending(ctx))) return this.#restart(ctx)
    return ctx.inertia.render('auth/two_factor_challenge', {})
  }

  async store(ctx: HttpContext) {
    const staff = await this.#pending(ctx)
    if (!staff) return this.#restart(ctx)
    const { code } = await ctx.request.validateUsing(codeValidator)

    const result = await checkCode(staff, code)
    if (!result.ok) {
      const message =
        result.reason === 'blocked'
          ? ctx.i18n.t('two_factor.errors.blocked', { minutes: result.minutes })
          : ctx.i18n.t('two_factor.errors.wrong_code')
      return backWithFieldError(ctx, TWO_FACTOR_CHALLENGE_PATH, 'code', message)
    }

    forgetPending(ctx)
    await clearWrongCodes(staff)
    await ctx.auth.use('staff').login(staff)
    return ctx.response.redirect().toPath('/')
  }

  /** The staff member waiting for a code, when they still may sign in with one. */
  async #pending(ctx: HttpContext) {
    const id = pendingStaffId(ctx)
    if (id === null) return null
    const staff = await StaffUser.find(id)
    if (!staff || staff.disabledAt || !twoFactorEnabled(staff)) {
      forgetPending(ctx)
      return null
    }
    return staff
  }

  #restart(ctx: HttpContext) {
    ctx.session.flash('error', ctx.i18n.t('two_factor.errors.expired'))
    return ctx.response.redirect().toPath('/masuk')
  }
}
