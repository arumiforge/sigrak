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

  // Redis
  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.secret.optional(),

  // Rate limiter
  LIMITER_STORE: Env.schema.enum(['redis', 'memory'] as const),
})
