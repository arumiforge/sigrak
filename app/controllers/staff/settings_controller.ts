import type { HttpContext } from '@adonisjs/core/http'
import { staffUser } from '#accounts/http'
import { defaultTrialDays, setDefaultTrialDays } from '#accounts/settings'
import { authorizeStaff, staffCan } from '#accounts/staff_access'
import { defaultTrialValidator } from '#validators/accounts'

/**
 * Konsol: settings. For now only the default trial length (D-459);
 * every change is logged.
 */
export default class SettingsController {
  async show(ctx: HttpContext) {
    const staff = staffUser(ctx)
    authorizeStaff(staff, 'schools.view')
    return ctx.inertia.render('console/settings', {
      defaultTrialDays: await defaultTrialDays(),
      can: { manageTrials: staffCan(staff, 'trials.manage') },
    })
  }

  async update(ctx: HttpContext) {
    const staff = staffUser(ctx)
    authorizeStaff(staff, 'trials.manage')
    const { days } = await ctx.request.validateUsing(defaultTrialValidator)
    await setDefaultTrialDays(staff, days)
    ctx.session.flash('success', ctx.i18n.t('console.settings.saved'))
    return ctx.response.redirect().toPath('/pengaturan')
  }
}
