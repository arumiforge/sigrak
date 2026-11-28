/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| Validates the environment variables at boot and casts them to
| JavaScript types. Variable names follow Fondasi settings.md where
| one exists.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),
  TZ: Env.schema.string.optional(),

  // App
  APP_KEY: Env.schema.secret(),
  /**
   * Base domain of the three hosts: app.<domain>, admin.<domain>,
   * ujian.<domain>. Local development uses sigrak.test.
   */
  APP_DOMAIN: Env.schema.string({ format: 'host' }),
  /**
   * Scheme used when the app builds absolute URLs (http locally,
   * https behind Cloudflare Tunnel).
   */
  APP_SCHEME: Env.schema.enum(['http', 'https'] as const),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'redis', 'memory'] as const),

  // Database
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.secret.optional(),
  DB_DATABASE: Env.schema.string(),
  /**
   * The app's login user for the "tenant" connection: a member of the
   * non-owner role sigrak_app, so row-level security applies (R1-01).
   * DB_USER stays the owner that runs migrations.
   */
  DB_APP_USER: Env.schema.string.optional(),
  DB_APP_PASSWORD: Env.schema.secret.optional(),

  // Redis
  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.secret.optional(),
  /**
   * Separate Redis databases for BullMQ queues and AI key state, so
   * clearing one never wipes sessions, jobs or key cooldowns (D-053).
   */
  REDIS_QUEUE_DB: Env.schema.number.optional(),
  REDIS_AI_DB: Env.schema.number.optional(),

  // Queues and the CPU pool (D-463, D-467). Ranges and defaults:
  // app/services/queue/settings.ts; out-of-range values are clamped.
  QUEUE_AI_CONCURRENCY: Env.schema.number.optional(),
  QUEUE_EXPORTS_CONCURRENCY: Env.schema.number.optional(),
  QUEUE_DEFAULT_CONCURRENCY: Env.schema.number.optional(),
  QUEUE_WAIT_ALERT_MS: Env.schema.number.optional(),
  CPU_POOL_SIZE: Env.schema.number.optional(),

  // AI (docs/final/ai-provider-engine.md)
  /**
   * "fake" runs every generation on the scripted fake provider (no key,
   * no network); "gemini" calls Google with the teachers' keys.
   */
  AI_PROVIDER: Env.schema.enum.optional(['fake', 'gemini'] as const),
  AI_GEMINI_BASE_URL: Env.schema.string.optional({ format: 'url', tld: false }),

  // Transmit (SSE)
  /**
   * "redis" relays broadcasts between processes (a worker broadcasts,
   * the web process holds the browser's stream); "none" keeps them in
   * one process.
   */
  TRANSMIT_TRANSPORT: Env.schema.enum.optional(['redis', 'none'] as const),

  // Rate limiter
  LIMITER_STORE: Env.schema.enum(['redis', 'memory'] as const),
})
