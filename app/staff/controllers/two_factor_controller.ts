import type { HttpContext } from '@adonisjs/core/http'
import { backWithFieldError } from '#accounts/http'
import { authorizeStaff, currentStaff, rolesOf } from '../access.js'
import { STAFF_ROLES } from '../roles.js'
import {
  confirmEnrolment,
  disableTwoFactor,
  enrolmentFor,
  resetTwoFactor,
  TwoFactorRefusedException,
  twoFactorEnabled,
  twoFactorRequired,
  type CodeResult,
} from '../two_factor.js'
import { codeValidator, TWO_FACTOR_ENROL_PATH } from '../two_factor_session.js'

/**
 * The staff member's own account page and their 2FA (R2-02, D-343):
 * Akun (/akun), enrolment with a QR code or a manual key confirmed by
 * a first code, turning 2FA off where it is optional, and the admin's
 * "Atur ulang 2FA" on someone else (`staff.reset_2fa`).
 *
 * Owner and admin accounts without 2FA are sent to the enrolment page
 * by the auth middleware before any other console page.
 */
export default class TwoFactorController {
  async account(ctx: HttpContext) {
    const staff = await currentStaff(ctx)
    const roles = rolesOf(staff).sort((a, b) => STAFF_ROLES.indexOf(a) - STAFF_ROLES.indexOf(b))
    return ctx.inertia.render('console/account', {
      account: { name: staff.name, email: staff.email, roles },
      twoFactor: {
        enabled: twoFactorEnabled(staff),
        required: twoFactorRequired(staff),
        since: staff.twoFactorConfirmedAt?.toISO() ?? null,
      },
    })
  }

  async edit(ctx: HttpContext) {
    const staff = await currentStaff(ctx)
    if (twoFactorEnabled(staff)) return ctx.response.redirect().toPath('/akun')
    const enrolment = await enrolmentFor(staff)
    return ctx.inertia.render('console/two_factor_setup', {
      ...enrolment,
      required: twoFactorRequired(staff),
    })
  }

  async confirm(ctx: HttpContext) {
    const staff = await currentStaff(ctx)
    if (twoFactorEnabled(staff)) return ctx.response.redirect().toPath('/akun')
    if (!staff.twoFactorSecret) return ctx.response.redirect().toPath(TWO_FACTOR_ENROL_PATH)
    const { code } = await ctx.request.validateUsing(codeValidator)
    const result = await confirmEnrolment(staff, code)
    if (!result.ok) return this.#wrongCode(ctx, TWO_FACTOR_ENROL_PATH, result)
    ctx.session.flash('success', ctx.i18n.t('two_factor.toasts.enabled'))
    return ctx.response.redirect().toPath('/akun')
  }

  async disable(ctx: HttpContext) {
    const staff = await currentStaff(ctx)
    const { code } = await ctx.request.validateUsing(codeValidator)
    try {
      const result = await disableTwoFactor(staff, code)
      if (!result.ok) return this.#wrongCode(ctx, '/akun', result)
      ctx.session.flash('success', ctx.i18n.t('two_factor.toasts.disabled'))
    } catch (error) {
      if (!(error instanceof TwoFactorRefusedException)) throw error
      ctx.session.flash('error', ctx.i18n.t(`two_factor.errors.${error.reason}`))
    }
    return ctx.response.redirect().toPath('/akun')
  }

  /** "Atur ulang 2FA" on the Staf page; never on oneself. */
  async reset(ctx: HttpContext) {
    const actor = await authorizeStaff(ctx, 'staff.reset_2fa')
    const id = Number(ctx.params.staff)
    try {
      await resetTwoFactor(actor, id)
      ctx.session.flash('success', ctx.i18n.t('two_factor.toasts.reset'))
    } catch (error) {
      if (!(error instanceof TwoFactorRefusedException)) throw error
      ctx.session.flash('error', ctx.i18n.t(`two_factor.errors.${error.reason}`))
    }
    return ctx.response.redirect().toPath(`/staf/${id}`)
  }

  #wrongCode(ctx: HttpContext, path: string, result: Exclude<CodeResult, { ok: true }>) {
    const message =
      result.reason === 'blocked'
        ? ctx.i18n.t('two_factor.errors.blocked', { minutes: result.minutes })
        : ctx.i18n.t('two_factor.errors.wrong_code')
    return backWithFieldError(ctx, path, 'code', message)
  }
}
