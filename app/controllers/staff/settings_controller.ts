import type { HttpContext } from '@adonisjs/core/http'
import {
  defaultTrialDays,
  setDefaultTrialDays,
  setTrialExtendMaxDays,
  trialExtendMaxDays,
} from '#accounts/settings'
import { authorizeStaff, staffCan } from '#staff/access'
import { defaultTrialValidator, trialExtendMaxValidator } from '#validators/accounts'

/**
 * Konsol: settings. The default trial length (D-459) and the most days
 * one "Tambah hari" by `trials.extend` may add (D-481); every change is
 * logged. Abilities: `settings.view`, `settings.manage`.
 */
export default class SettingsController {
  async show(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'settings.view')
    return ctx.inertia.render('console/settings', {
      defaultTrialDays: await defaultTrialDays(),
      trialExtendMaxDays: await trialExtendMaxDays(),
      can: { manageTrials: staffCan(staff, 'settings.manage') },
    })
  }

  async update(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'settings.manage')
    const { days } = await ctx.request.validateUsing(defaultTrialValidator)
    await setDefaultTrialDays(staff, days)
    ctx.session.flash('success', ctx.i18n.t('console.settings.saved'))
    return ctx.response.redirect().toPath('/pengaturan')
  }

  async updateExtendLimit(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'settings.manage')
    const { days } = await ctx.request.validateUsing(trialExtendMaxValidator)
    await setTrialExtendMaxDays(staff, days)
    ctx.session.flash('success', ctx.i18n.t('console.settings.saved'))
    return ctx.response.redirect().toPath('/pengaturan')
  }
}
