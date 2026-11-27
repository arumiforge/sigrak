import env from '#start/env'

/**
 * AI layer settings (docs/final/ai-provider-engine.md). Starting values
 * only: the console will keep the model per purpose in the database
 * (D-315); limits are re-checked against Google's pages at build time.
 */
const driver = env.get('AI_PROVIDER', 'fake')

export type AiDriver = typeof driver

export type PurposeSettings = {
  /** Active model first, then the fallbacks tried on `model_unavailable`. */
  models: string[]
  /** Client timeout of one call. */
  timeoutMs: number
}

const aiConfig = {
  driver,

  /**
   * Templates name a purpose, never a model. The fake driver uses a
   * model name of its own, so its demo runs never touch the daily
   * counters of a real model.
   */
  purposes: {
    demo: {
      models: driver === 'fake' ? ['fake-flash'] : ['gemini-3.8-flash'],
      timeoutMs: driver === 'fake' ? 2_500 : 90_000,
    },
  } satisfies Record<string, PurposeSettings>,

  gateway: {
    /** Attempts per step across all keys, and wall time per step. */
    maxAttemptsPerStep: 4,
    stepBudgetMs: 5 * 60_000,
    /** A 429 with a suggested delay up to this is retried once on the same key. */
    sameKeyRateLimitMaxDelayMs: 20_000,
    /** Cooldown of a (key, model) after a 429 without a usable delay. */
    defaultCooldownMs: 60_000,
    /** Backoff before each same-key retry of a transient error (+ up to 250 ms jitter). */
    transientBackoffMs: [1_000, 2_000],
    jitterMs: 250,
  },

  circuitBreaker: {
    /** Consecutive transient/timeout failures that open the circuit. */
    threshold: 5,
    openMs: 5 * 60_000,
  },

  /**
   * Requests per key per model per day (D-128), counted in Redis and
   * reset at midnight Pacific. A model without an entry is not counted
   * against a limit.
   */
  dailyLimits: {
    'gemini-3.8-flash': 20,
  } as Record<string, number>,

  /** Generations a teacher may have queued or running at once. */
  maxActiveGenerationsPerUser: 2,

  gemini: {
    baseUrl: env.get('AI_GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'),
  },

  fake: {
    /** How long a scripted call "thinks" before answering. */
    callDelayMs: 1_200,
  },
}

export default aiConfig
export type AiConfig = typeof aiConfig
