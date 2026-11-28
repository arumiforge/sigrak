import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import type { AiConfig } from '#config/ai'
import AiUsageLog from '#models/ai_usage_log'
import { resolvePurpose } from '#integrations/ai_models'
import {
  AICancelledError,
  AIError,
  sleep,
  throwIfCancelled,
  type AIErrorClass,
  type AIProvider,
  type AIRequest,
  type AIResponse,
} from '#services/ai/contracts'
import { KeySelector, NoUsableKeyError, keyHealth } from '#services/ai/key_selector'

export type GatewayCall = {
  request: AIRequest
  userId: number
  schoolId: number | null
  generationId?: number
  stepKey?: string
  run?: number
  /** The generation's pinned key (sticky selection). */
  pinnedCredentialId?: number | null
  signal?: AbortSignal
}

export type GatewayResult = {
  response: AIResponse
  /** The key that answered; the caller pins it on the generation. */
  credentialId: number
  attempts: number
}

/**
 * Why a step failed, in the terms the teacher's message needs:
 * an error class, `no_keys`, or `no_usable_key` with the earliest time a
 * key is usable again.
 */
export type GatewayFailure = AIErrorClass | 'no_keys' | 'no_usable_key'

export class AIGatewayError extends Error {
  constructor(
    readonly failure: GatewayFailure,
    readonly availableAt: DateTime | null,
    readonly attempts: number
  ) {
    super(`AI step failed: ${failure}`)
    this.name = 'AIGatewayError'
  }
}

/** Classes that never get better on another key. */
const finalClasses: AIErrorClass[] = ['bad_request', 'blocked', 'malformed_output']

/**
 * The only entry point of the content module into the AI layer: select
 * key → call → classify → retry or fail over → log
 * (ai-provider-engine.md, Error handling and Budgets).
 */
export class AIGateway {
  constructor(
    private provider: AIProvider,
    private selector = new KeySelector()
  ) {}

  async run(call: GatewayCall): Promise<GatewayResult> {
    const config = app.config.get<AiConfig>('ai')
    // The console's model list for the purpose (D-315), timeout from config.
    const purpose = await resolvePurpose(call.request.purpose)
    if (!purpose) {
      throw new Error(`Unknown AI purpose "${call.request.purpose}"`)
    }
    const { gateway } = config
    const deadline = Date.now() + gateway.stepBudgetMs
    const excluded = new Set<number>()

    let modelIndex = 0
    let attempts = 0
    let lastFailure: AIErrorClass | null = null
    let sameKeyRetries = 0

    const select = async (pinnedId: number | null) => {
      try {
        return await this.selector.select(call.userId, purpose.models[modelIndex], {
          pinnedId,
          excluded,
        })
      } catch (error) {
        if (!(error instanceof NoUsableKeyError)) throw error
        if (error.reason === 'no_keys') throw new AIGatewayError('no_keys', null, attempts)
        if (error.availableAt || !lastFailure) {
          throw new AIGatewayError('no_usable_key', error.availableAt, attempts)
        }
        throw new AIGatewayError(lastFailure, null, attempts)
      }
    }

    let credential = await select(call.pinnedCredentialId ?? null)

    const failOver = async () => {
      excluded.add(credential.id)
      sameKeyRetries = 0
      credential = await select(null)
    }

    while (attempts < gateway.maxAttemptsPerStep && Date.now() < deadline) {
      throwIfCancelled(call.signal)
      attempts++
      const model = purpose.models[modelIndex]
      const started = Date.now()

      try {
        await keyHealth.countRequest(credential.id, model)
        const response = await this.provider.generate({
          ...call.request,
          model,
          credential: { id: credential.id, secret: credential.revealSecret() },
          timeoutMs: Math.max(1, Math.min(purpose.timeoutMs, deadline - Date.now())),
          signal: call.signal,
          trace: {
            generationId: call.generationId,
            stepKey: call.stepKey,
            run: call.run,
            attempt: attempts,
          },
        })
        await this.#log(call, credential.id, model, attempts, 'success', started, {
          httpStatus: 200,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        })
        await keyHealth.recordSuccess(credential.id)
        return { response, credentialId: credential.id, attempts }
      } catch (error) {
        if (error instanceof AICancelledError) {
          await this.#log(call, credential.id, model, attempts, 'cancelled', started)
          throw error
        }
        if (!(error instanceof AIError)) {
          throw error
        }

        const { errorClass, details } = error
        lastFailure = errorClass
        await this.#log(call, credential.id, model, attempts, errorClass, started, {
          httpStatus: details.httpStatus,
        })
        logger.info(
          { userId: call.userId, credentialId: credential.id, errorClass, attempt: attempts },
          'AI attempt failed'
        )

        if (finalClasses.includes(errorClass)) {
          throw new AIGatewayError(errorClass, null, attempts)
        }

        switch (errorClass) {
          case 'rate_limited': {
            const delay = details.retryAfterMs
            if (
              delay !== undefined &&
              delay <= gateway.sameKeyRateLimitMaxDelayMs &&
              sameKeyRetries === 0
            ) {
              sameKeyRetries++
              await sleep(delay, call.signal)
              break
            }
            await keyHealth.coolDown(
              credential.id,
              model,
              DateTime.now().plus({ milliseconds: delay ?? gateway.defaultCooldownMs })
            )
            await failOver()
            break
          }
          case 'rate_limited_daily':
            await keyHealth.coolDown(credential.id, model, keyHealth.nextPacificMidnight())
            await failOver()
            break
          case 'key_invalid':
          case 'project_unavailable':
            await keyHealth.markInvalid(credential.id, errorClass)
            await failOver()
            break
          case 'model_unavailable':
            if (modelIndex + 1 >= purpose.models.length) {
              throw new AIGatewayError('model_unavailable', null, attempts)
            }
            modelIndex++
            sameKeyRetries = 0
            break
          case 'transient':
            await keyHealth.recordFailure(credential.id)
            if (sameKeyRetries < gateway.transientBackoffMs.length) {
              const backoff = gateway.transientBackoffMs[sameKeyRetries]
              sameKeyRetries++
              await sleep(backoff + Math.random() * gateway.jitterMs, call.signal)
            } else {
              await failOver()
            }
            break
          case 'timeout':
            // Once more on the same key, so a duplicate cost stays on that project.
            await keyHealth.recordFailure(credential.id)
            if (sameKeyRetries < 1) {
              sameKeyRetries++
            } else {
              await failOver()
            }
            break
          case 'empty_reply':
            await failOver()
            break
        }
      }
    }

    throw new AIGatewayError(lastFailure ?? 'transient', null, attempts)
  }

  async #log(
    call: GatewayCall,
    credentialId: number,
    model: string,
    attempt: number,
    outcome: string,
    started: number,
    extra: { httpStatus?: number; inputTokens?: number; outputTokens?: number } = {}
  ) {
    await AiUsageLog.create({
      userId: call.userId,
      schoolId: call.schoolId,
      aiCredentialId: credentialId,
      generationId: call.generationId ?? null,
      stepKey: call.stepKey ?? null,
      attempt,
      purpose: call.request.purpose,
      model,
      outcome,
      httpStatus: extra.httpStatus ?? null,
      inputTokens: extra.inputTokens ?? 0,
      outputTokens: extra.outputTokens ?? 0,
      latencyMs: Date.now() - started,
    })
  }
}
