import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import { activeMembershipsOf } from '#accounts/memberships'
import { trialOf } from '#accounts/trial'
import { backWithFieldError, schoolUser } from '#accounts/http'
import { changePasswordValidator, profileValidator } from '#validators/accounts'

/**
 * Akun: the signed-in person's name, NIP, password, roles and trial.
 * The email is read-only; changing it goes through Tim SIGRAK for now
 * (D-183).
 */
export default class AccountController {
  async show(ctx: HttpContext) {
    const user = schoolUser(ctx)
    const [memberships, trial] = await Promise.all([activeMembershipsOf(user.id), trialOf(user)])

    return ctx.inertia.render('accounts/account', {
      profile: {
        name: user.name,
        email: user.email,
        nip: user.nip,
        emailVerified: user.emailVerifiedAt !== null,
      },
      memberships: memberships.map((membership) => ({
        ...membership,
        active: membership.publicId === ctx.membership?.publicId,
      })),
      trial: {
        // A school-wide extension (D-469) also counts as a started trial.
        started: trial.endsAt !== null,
        active: trial.active,
        days: trial.days,
        daysLeft: trial.daysLeft,
        endsAt: trial.endsAt?.toISO() ?? null,
      },
    })
  }

  async updateProfile(ctx: HttpContext) {
    const user = schoolUser(ctx)
    const { name, nip } = await ctx.request.validateUsing(profileValidator)
    user.merge({ name, nip: nip ?? null })
    await user.save()
    ctx.session.flash('success', ctx.i18n.t('accounts.account.profile_saved'))
    return ctx.response.redirect().toPath('/akun')
  }

  async updatePassword(ctx: HttpContext) {
    const user = schoolUser(ctx)
    const { current_password: current, password } =
      await ctx.request.validateUsing(changePasswordValidator)
    if (!(await hash.verify(user.password, current))) {
      return backWithFieldError(
        ctx,
        '/akun',
        'current_password',
        ctx.i18n.t('accounts.account.wrong_password')
      )
    }
    user.password = password
    await user.save()
    ctx.session.flash('success', ctx.i18n.t('accounts.account.password_saved'))
    return ctx.response.redirect().toPath('/akun')
  }
}
