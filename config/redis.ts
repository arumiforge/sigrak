import env from '#start/env'
import { defineConfig } from '@adonisjs/redis'
import type { InferConnections } from '@adonisjs/redis/types'

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
  },
})

export default redisConfig

declare module '@adonisjs/redis/types' {
  export interface RedisConnections extends InferConnections<typeof redisConfig> {}
}
