import app from '@adonisjs/core/services/app'
import type queueConfig from '#config/queue'
import { cpuPoolSize } from './limits.js'
import { CpuPool } from './pool.js'

export * from './pool.js'
export { cpuLimit, cpuPoolSize } from './limits.js'

let shared: CpuPool | undefined

/**
 * The process's CPU pool, started on first use (the `worker-exports`
 * role starts it with the worker). Sized from `queue.cpuPool.size`.
 */
export function cpuPool(): CpuPool {
  if (!shared || shared.closed) {
    const settings = app.config.get<typeof queueConfig>('queue')
    shared = new CpuPool({ size: cpuPoolSize(settings.cpuPool.size) })
  }
  return shared
}

/** Drains and stops the process's CPU pool, if one was started. */
export async function closeCpuPool(graceMs: number) {
  const pool = shared
  shared = undefined
  if (!pool) return { drained: true }
  return pool.close(graceMs)
}
