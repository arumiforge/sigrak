import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import type { AiConfig } from '#config/ai'
import { generateDemo } from '#jobs/generate_demo'
import AiCredential from '#models/ai_credential'
import Generation from '#models/generation'
import User from '#models/user'
import { ensureDemoKeys } from '#services/ai/demo_keys'
import { demoScenarios } from '#services/ai/fake_provider'
import {
  TooManyActiveGenerationsError,
  generationService,
} from '#services/generation/generation_service'
import { userChannel } from '#services/generation/progress'
import { snapshotOf } from '#services/generation/snapshot'
import { startDemoValidator } from '#validators/ai_demo'

function schoolUser(ctx: HttpContext) {
  const user = ctx.auth.use('web').getUserOrFail()
  if (!(user instanceof User)) {
    throw new Error('Expected a school user')
  }
  return user
}

/** The signed-in user's own demo generation, or 404. */
async function ownGeneration(ctx: HttpContext) {
  const user = schoolUser(ctx)
  return Generation.query()
    .where('public_id', ctx.params.generation)
    .where('user_id', user.id)
    .where('template_key', generateDemo.templateKey)
    .firstOrFail()
}

/**
 * Coba AI (R0-06 spike): start a demo generation on the `worker-ai`
 * process role and watch its steps live over Transmit, with cancel and
 * retry. Runs on the scripted fake provider unless AI_PROVIDER=gemini.
 */
export default class AiDemoController {
  async index(ctx: HttpContext) {
    const user = schoolUser(ctx)
    const { driver } = app.config.get<AiConfig>('ai')
    if (driver === 'fake') {
      await ensureDemoKeys(user.id)
    }

    const latest = await Generation.query()
      .where('user_id', user.id)
      .where('template_key', generateDemo.templateKey)
      .orderBy('id', 'desc')
      .first()
    const keys = await AiCredential.query().where('user_id', user.id).orderBy('id', 'asc')

    return ctx.inertia.render('school/ai_demo', {
      channel: userChannel(user.id),
      driver,
      scenarios: driver === 'fake' ? [...demoScenarios] : [],
      keys: keys.map((key) => ({ label: key.label, status: key.status })),
      generation: latest ? await snapshotOf(latest) : null,
    })
  }

  async store(ctx: HttpContext) {
    const user = schoolUser(ctx)
    const { clientToken, scenario } = await ctx.request.validateUsing(startDemoValidator)
    const membership = await user.currentMembership()

    try {
      await generationService.start(generateDemo, {
        userId: user.id,
        schoolId: membership?.schoolId ?? null,
        clientToken,
        specification: { topic: 'Siklus air', scenario: scenario ?? 'smooth' },
      })
    } catch (error) {
      if (!(error instanceof TooManyActiveGenerationsError)) throw error
      ctx.session.flash('error', ctx.i18n.t('ai_demo.errors.too_many_active'))
    }
    return ctx.response.redirect().toPath('/coba-ai')
  }

  async cancel(ctx: HttpContext) {
    const generation = await ownGeneration(ctx)
    const cancelled = await generationService.cancel(generateDemo, generation)
    ctx.session.flash(
      cancelled ? 'success' : 'error',
      ctx.i18n.t(cancelled ? 'ai_demo.toasts.cancelled' : 'ai_demo.errors.not_running')
    )
    return ctx.response.redirect().toPath('/coba-ai')
  }

  async retry(ctx: HttpContext) {
    const generation = await ownGeneration(ctx)
    try {
      const retried = await generationService.retry(generateDemo, generation)
      if (!retried) {
        ctx.session.flash('error', ctx.i18n.t('ai_demo.errors.not_retryable'))
      }
    } catch (error) {
      if (!(error instanceof TooManyActiveGenerationsError)) throw error
      ctx.session.flash('error', ctx.i18n.t('ai_demo.errors.too_many_active'))
    }
    return ctx.response.redirect().toPath('/coba-ai')
  }
}
