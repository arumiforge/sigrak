import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import type { AiConfig } from '#config/ai'
import StaffActivityLog from '#models/staff_activity_log'
import { authorizeStaff, staffCan } from '#staff/access'
import {
  isPurpose,
  MAX_MODELS_PER_PURPOSE,
  presentPurposes,
  presentTeamKey,
  resetPurposeModels,
  setPurposeModels,
  testModel,
} from '../ai_models.js'
import { modelTestValidator, purposeModelsValidator } from '../validators.js'

const PAGE = '/pengaturan/model-ai'
const RECENT = 10

/**
 * Konsol: Pengaturan → Model AI (R2-03, D-315). The active model and
 * ordered fallbacks per purpose, the test button and the latest
 * changes. `ai_models.view` reads; `ai_models.manage` (the owner)
 * changes and tests. Every change is logged.
 */
export default class AiModelsController {
  async index(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'ai_models.view')
    const recent = await StaffActivityLog.query()
      .where('subject_type', 'ai_model')
      .preload('staffUser')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(RECENT)

    return ctx.inertia.render('console/ai_models', {
      purposes: await presentPurposes(),
      maxModels: MAX_MODELS_PER_PURPOSE,
      teamKey: await presentTeamKey(),
      fakeDriver: app.config.get<AiConfig>('ai').driver !== 'gemini',
      recent: recent.map((log) => ({
        id: log.id,
        action: log.action,
        purpose: log.subjectId,
        changes: log.changes as Record<string, unknown>,
        by: log.staffUser?.name ?? null,
        at: log.createdAt.toISO()!,
      })),
      can: {
        manage: staffCan(staff, 'ai_models.manage'),
        manageKey: staffCan(staff, 'integrations.manage'),
      },
    })
  }

  async update(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'ai_models.manage')
    const purpose = this.#purpose(ctx)
    const { models } = await ctx.request.validateUsing(purposeModelsValidator)
    const changed = await setPurposeModels(staff, purpose, models)
    return this.#back(ctx, changed ? 'integrations.models.saved' : 'integrations.unchanged')
  }

  async reset(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'ai_models.manage')
    const purpose = this.#purpose(ctx)
    const changed = await resetPurposeModels(staff, purpose)
    return this.#back(ctx, changed ? 'integrations.models.restored' : 'integrations.unchanged')
  }

  async test(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'ai_models.manage')
    const purpose = this.#purpose(ctx)
    const { model } = await ctx.request.validateUsing(modelTestValidator)
    const result = await testModel(staff, purpose, model)
    if (result.ok) {
      ctx.session.flash(
        'success',
        ctx.i18n.t('integrations.models.test_ok', { model, seconds: secondsOf(result.latencyMs) })
      )
    } else {
      ctx.session.flash(
        'error',
        ctx.i18n.t('integrations.models.test_failed', {
          model,
          reason: ctx.i18n.t(`integrations.models.test_reasons.${result.reason}`),
        })
      )
    }
    return ctx.response.redirect().toPath(PAGE)
  }

  #purpose(ctx: HttpContext): string {
    const purpose = String(ctx.params.purpose)
    if (!isPurpose(purpose)) ctx.response.abort('Unknown AI purpose', 404)
    return purpose
  }

  #back(ctx: HttpContext, message: string) {
    ctx.session.flash('success', ctx.i18n.t(message))
    return ctx.response.redirect().toPath(PAGE)
  }
}

/** "1,2" seconds, Indonesian decimal comma. */
function secondsOf(ms: number) {
  return (ms / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })
}
