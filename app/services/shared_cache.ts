import redis from '@adonisjs/redis/services/main'
import logger from '@adonisjs/core/services/logger'
import type { RedisConnection } from '@adonisjs/redis'

/**
 * Waits until the `cache` connection is ready (commands and tests; a
 * request never waits). False when it is not ready within the time.
 */
export async function cacheConnectionReady(timeoutMs = 3_000): Promise<boolean> {
  const connection = redis.connection('cache')
  const deadline = Date.now() + timeoutMs
  while (connection.status !== 'ready') {
    if (Date.now() >= deadline) return false
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return true
}

/**
 * A cache shared by every process, on the `cache` Redis connection
 * (D-480). Only for values that can be rebuilt: when `redis-cache` is
 * down, full or restarting, `get` answers "not cached" and `set` does
 * nothing, so the caller computes the value again and nothing fails.
 *
 * Values are stored as JSON (plain objects, arrays, strings, numbers,
 * booleans and null; no Date or Map). Keys live under `<namespace>:`.
 */
export class SharedCache {
  constructor(
    private readonly namespace: string,
    private readonly options: {
      ttlSeconds: number
      /** The connection to use; default the `cache` connection. */
      connection?: () => Pick<RedisConnection, 'status' | 'get' | 'set' | 'ioConnection'>
    }
  ) {}

  #connection() {
    const connection = this.options.connection
      ? this.options.connection()
      : redis.connection('cache')
    // No offline queue on this connection: skip it until it is ready.
    return connection.status === 'ready' ? connection : null
  }

  async get<T>(key: string): Promise<T | undefined> {
    const connection = this.#connection()
    if (!connection) return undefined
    try {
      const raw = await connection.get(`${this.namespace}:${key}`)
      return raw === null ? undefined : (JSON.parse(raw) as T)
    } catch (error) {
      logger.debug({ err: error, cache: this.namespace }, 'Shared cache read skipped')
      return undefined
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    const connection = this.#connection()
    if (!connection) return
    try {
      await connection.set(
        `${this.namespace}:${key}`,
        JSON.stringify(value),
        'EX',
        this.options.ttlSeconds
      )
    } catch (error) {
      logger.debug({ err: error, cache: this.namespace }, 'Shared cache write skipped')
    }
  }

  /**
   * Removes every entry of this namespace (tests, and after a database
   * restore). SCAN matches the full key, so the connection's prefix is
   * added to the pattern and taken off again before UNLINK, which adds
   * it back.
   */
  async clear(): Promise<void> {
    const connection = this.#connection()
    if (!connection) return
    const io = connection.ioConnection
    const prefix = io.options.keyPrefix ?? ''
    try {
      let cursor = '0'
      do {
        const [next, keys] = await io.scan(
          cursor,
          'MATCH',
          `${prefix}${this.namespace}:*`,
          'COUNT',
          500
        )
        cursor = next
        if (keys.length > 0) {
          await io.unlink(...keys.map((key) => key.slice(prefix.length)))
        }
      } while (cursor !== '0')
    } catch (error) {
      logger.debug({ err: error, cache: this.namespace }, 'Shared cache clear skipped')
    }
  }
}
