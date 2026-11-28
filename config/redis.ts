import env from '#start/env'
import { defineConfig } from '@adonisjs/redis'
import type { InferConnections } from '@adonisjs/redis/types'

const cacheHost = env.get('REDIS_CACHE_HOST')

const redisConfig = defineConfig({
  connection: 'main',

  connections: {
    /**
     * Sessions and rate limits. BullMQ has its own connection options
     * in config/queue.ts (D-053).
     */
    main: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD')?.release(),
      db: 0,
      keyPrefix: 'sigrak:',
      retryStrategy(times) {
        return times > 10 ? null : times * 50
      },
    },

    /**
     * AI key state: round-robin counters, cooldowns per (key, model),
     * daily counters (D-128) and the cancel channel of running
     * generations. Its own database, so clearing sessions never
     * clears a cooldown (D-053).
     */
    ai: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD')?.release(),
      db: env.get('REDIS_AI_DB', 2),
      keyPrefix: 'sigrak:ai:',
      retryStrategy(times) {
        return times > 10 ? null : times * 50
      },
    },

    /**
     * Rebuildable caches only (D-480): the `redis-cache` container with
     * allkeys-lru, a memory cap and no persistence. Losing it slows
     * pages and loses nothing, so a command never waits for it: no
     * offline queue, a short timeout, and it keeps reconnecting.
     * Without REDIS_CACHE_HOST (development, CI) it is a database of
     * the main Redis. The database name is in the prefix, so test runs
     * on separate databases never read each other's entries.
     */
    cache: {
      host: cacheHost ?? env.get('REDIS_HOST'),
      port: cacheHost ? env.get('REDIS_CACHE_PORT', 6379) : env.get('REDIS_PORT'),
      password: (cacheHost
        ? env.get('REDIS_CACHE_PASSWORD')
        : env.get('REDIS_PASSWORD')
      )?.release(),
      db: env.get('REDIS_CACHE_DB', cacheHost ? 0 : 3),
      keyPrefix: `sigrak:cache:${env.get('DB_DATABASE')}:`,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      commandTimeout: 250,
      retryStrategy(times) {
        return Math.min(times * 200, 5_000)
      },
    },
  },
})

export default redisConfig

declare module '@adonisjs/redis/types' {
  export interface RedisConnections extends InferConnections<typeof redisConfig> {}
}
