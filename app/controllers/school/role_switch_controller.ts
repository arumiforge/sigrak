import type { HttpContext } from '@adonisjs/core/http'
import { activeMembershipsOf } from '#accounts/memberships'
import { schoolUser } from '#accounts/http'
import { ACTIVE_MEMBERSHIP_SESSION_KEY } from '#tenancy/active_membership'
import { switchRoleValidator } from '#validators/accounts'

/**
 * Ganti peran: a person with more than one role (a principal who also
 * teaches, a teacher in two schools) picks the one to work as. The
 * choice is the membership's public id in the session; the school
 * context middleware reads it on every request.
 */
export default class RoleSwitchController {
  async show(ctx: HttpContext) {
    const user = schoolUser(ctx)
    const memberships = await activeMembershipsOf(user.id)
    return ctx.inertia.render('accounts/switch_role', {
      memberships: memberships.map((membership) => ({
        ...membership,
        active: membership.publicId === ctx.membership?.publicId,
      })),
    })
  }

  async store(ctx: HttpContext) {
    const user = schoolUser(ctx)
    const { membership } = await ctx.request.validateUsing(switchRoleValidator)
    const memberships = await activeMembershipsOf(user.id)
    const choice = memberships.find((candidate) => candidate.publicId === membership)
    if (!choice) {
      ctx.session.flash('error', ctx.i18n.t('accounts.switch_role.unavailable'))
      return ctx.response.redirect().toPath('/ganti-peran')
    }
    ctx.session.put(ACTIVE_MEMBERSHIP_SESSION_KEY, choice.publicId)
    ctx.session.flash(
      'success',
      ctx.i18n.t('accounts.switch_role.switched', {
        role: ctx.i18n.t(`accounts.roles.${choice.role}`),
        school: choice.schoolName,
      })
    )
    return ctx.response.redirect().toPath('/')
  }
}
