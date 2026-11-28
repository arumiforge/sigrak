import { readFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'

type ReadFile = (path: string) => string | undefined

function readText(path: string) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

/**
 * CPUs this process may use: the container's CPU quota from cgroup v2
 * (`cpu.max`) or v1 (`cpu.cfs_quota_us` / `cpu.cfs_period_us`) when one
 * is set, never more than the cores the OS lets the process run on.
 * A fractional quota is rounded down (1.5 CPUs count as 1), at least 1.
 */
export function cpuLimit(read: ReadFile = readText, cores = availableParallelism()): number {
  let quota: number | undefined

  const v2 = read('/sys/fs/cgroup/cpu.max')?.trim().split(/\s+/)
  if (v2 && v2[0] !== 'max') {
    const [max, period] = v2.map(Number)
    if (max > 0 && period > 0) quota = max / period
  }

  if (quota === undefined) {
    const max = Number(read('/sys/fs/cgroup/cpu/cpu.cfs_quota_us')?.trim())
    const period = Number(read('/sys/fs/cgroup/cpu/cpu.cfs_period_us')?.trim())
    if (max > 0 && period > 0) quota = max / period
  }

  const limit = quota === undefined ? cores : Math.min(cores, Math.floor(quota))
  return Math.max(1, limit)
}

/**
 * Threads for the CPU pool (D-463): the CPU limit minus one, so the main
 * thread keeps a core for queue locks and heartbeats; at least one.
 * A configured size is used as given but never above the CPU limit.
 */
export function cpuPoolSize(configured: number | 'auto', limit = cpuLimit()): number {
  if (configured === 'auto') return Math.max(1, limit - 1)
  return Math.max(1, Math.min(configured, limit))
}
