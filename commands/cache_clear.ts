import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Empties the shared caches on `redis-cache` (D-480) for this
 * environment's database. Run it after a database restore: cache keys
 * hold layer stamps, and a restore turns the stamps back, so an old
 * entry could match again. Only cache entries are removed; queues,
 * sessions and limits live on the other Redis and are never touched.
 * Restart the web and exam containers afterwards for their small
 * in-process caches.
 */
export default class CacheClear extends BaseCommand {
  static commandName = 'cache:clear'
  static description = 'Empty the shared caches on redis-cache (after a database restore)'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { cacheConnectionReady } = await import('#services/shared_cache')
    if (!(await cacheConnectionReady())) {
      this.logger.error('redis-cache is not reachable; nothing cleared')
      this.exitCode = 1
      return
    }
    const { LayerResolver } = await import('#layers/resolver/layer_resolver')
    await LayerResolver.clearCache()
    this.logger.success('Shared caches cleared')
  }
}
