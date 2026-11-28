/**
 * Runtime settings of the queues and the CPU pool, read from env
 * (D-463, D-467). Pure functions without app imports, so
 * `config/queue.ts` can use them while the app boots.
 */

export type IntRange = { min: number; max: number; fallback: number }

export type SettingAdjustment = {
  name: string
  given: number
  used: number
}

/**
 * Allowed ranges. A value outside its range is clamped to the nearest
 * bound (and the worker logs it at start), so a typo never starts a
 * worker with 0 or 100 000 slots.
 */
export const settingRanges = {
  /** D-467: start at 50 jobs per worker-ai process; size by Little's law later. */
  QUEUE_AI_CONCURRENCY: { min: 1, max: 500, fallback: 50 },
  /** CPU-heavy work runs in the CPU pool; this only limits jobs in flight. */
  QUEUE_EXPORTS_CONCURRENCY: { min: 1, max: 32, fallback: 2 },
  QUEUE_DEFAULT_CONCURRENCY: { min: 1, max: 100, fallback: 4 },
  /**
   * Wait from enqueue to start above this is logged as a queue-wait alert
   * (D-469: 10 s for `ai` and `default`, 60 s for `exports`).
   */
  QUEUE_WAIT_ALERT_MS: { min: 1_000, max: 3_600_000, fallback: 10_000 },
  QUEUE_EXPORTS_WAIT_ALERT_MS: { min: 1_000, max: 3_600_000, fallback: 60_000 },
  /**
   * Threads in the CPU pool when set; unset means container CPU limit − 1
   * (D-463), worked out by the pool itself.
   */
  CPU_POOL_SIZE: { min: 1, max: 64, fallback: 1 },
} satisfies Record<string, IntRange>

export type SettingName = keyof typeof settingRanges

/**
 * Turns an env value into a whole number inside its range. `undefined`
 * gives the fallback; a fraction is rounded down; anything outside the
 * range is clamped and reported in `adjustments`.
 */
export function clampSetting(
  name: SettingName,
  value: number | undefined,
  adjustments: SettingAdjustment[] = []
): number {
  const range: IntRange = settingRanges[name]
  if (value === undefined || Number.isNaN(value)) {
    return range.fallback
  }
  const whole = Math.floor(value)
  const used = Math.min(range.max, Math.max(range.min, whole))
  if (used !== value) {
    adjustments.push({ name, given: value, used })
  }
  return used
}
