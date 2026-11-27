import env from '#start/env'
import { defineConfig } from '@adonisjs/transmit'
import { redis } from '@adonisjs/transmit/transports/redis'

/**
 * Server-sent events through Transmit (D-388): AI progress now, chatbot
 * streaming later. A `worker-ai` process broadcasts and the web process
 * holds the browser's stream, so broadcasts travel over Redis pub/sub.
 * Pub/sub channels are shared by every Redis database, so the channel
 * name carries the environment.
 */
export default defineConfig({
  pingInterval: '30s',
  transport:
    env.get('TRANSMIT_TRANSPORT', 'redis') === 'redis'
      ? {
          driver: redis({
            host: env.get('REDIS_HOST'),
            port: env.get('REDIS_PORT'),
            password: env.get('REDIS_PASSWORD')?.release(),
          }),
          channel: `sigrak:${env.get('NODE_ENV')}:transmit`,
        }
      : null,
})
