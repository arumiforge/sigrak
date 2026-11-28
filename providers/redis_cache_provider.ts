import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Lets a process stop while `redis-cache` is down (D-480).
 *
 * The `cache` connection has no offline queue, so the Redis provider's
 * QUIT on shutdown fails while that connection is not ready, and the
 * other connections are then never closed. Listed after the Redis
 * provider, this one shuts down first and drops such a connection.
 */
export default class RedisCacheProvider {
  constructor(protected app: ApplicationService) {}

  async shutdown() {
    const redis = await this.app.container.make('redis')
    const connection = redis.activeConnections.cache
    if (connection && connection.status !== 'ready') {
      await connection.disconnect()
    }
  }
}
