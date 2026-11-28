import env from '#start/env'
import type { ConnectionOptions, DefaultJobOptions } from 'bullmq'
import { clampSetting, type SettingAdjustment } from '#services/queue/settings'

/**
 * BullMQ queues on Redis (D-388). Each queue is served by its own
 * process role: `node ace queue:work ai` is the `worker-ai` role, and
 * so on for `exports` and `default`. The web process only adds jobs.
 */
export type QueueName = 'ai' | 'exports' | 'default'

export type WorkerSettings = {
  /** Jobs one worker process runs at the same time. */
  concurrency: number
  /**
   * A running job holds a lock that the worker renews every
   * lockDuration / 2. When the process dies, the lock expires and the
   * stalled-job check moves the job back to the queue for another (or
   * the restarted) worker.
   */
  lockDuration: number
  /** How often the worker looks for stalled jobs. */
  stalledInterval: number
  /** A job that stalls more often than this fails. */
  maxStalledCount: number
}

/** Env values that were outside their range; the worker logs them at start. */
const adjustments: SettingAdjustment[] = []

const cpuPoolSize = env.get('CPU_POOL_SIZE')

const queueConfig = {
  /**
   * BullMQ opens its own connections (a worker needs a blocking one),
   * on a database of its own (D-053).
   */
  connection: {
    host: env.get('REDIS_HOST'),
    port: env.get('REDIS_PORT'),
    password: env.get('REDIS_PASSWORD')?.release(),
    db: env.get('REDIS_QUEUE_DB', 1),
    maxRetriesPerRequest: null,
  } satisfies ConnectionOptions,

  prefix: 'sigrak',

  /**
   * No queue-level retries: retries happen inside the AI gateway, and a
   * generation job re-dispatches itself per step (ai-provider-engine.md,
   * "Timeouts and duplicate requests", D-050).
   */
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  } satisfies DefaultJobOptions,

  /**
   * On SIGTERM a worker stops taking jobs and lets running steps finish
   * for this long; then it interrupts them and puts each one back in
   * the queue. Keep it below the container's stop grace period.
   */
  shutdownGraceMs: 8_000,

  /**
   * Concurrency is a per-environment setting (D-467): QUEUE_AI_CONCURRENCY
   * and friends in env, clamped to the ranges in
   * app/services/queue/settings.ts.
   */
  workers: {
    // A crashed worker's step is back in the queue after about lockDuration + stalledInterval.
    ai: {
      concurrency: clampSetting(
        'QUEUE_AI_CONCURRENCY',
        env.get('QUEUE_AI_CONCURRENCY'),
        adjustments
      ),
      lockDuration: 15_000,
      stalledInterval: 5_000,
      maxStalledCount: 2,
    },
    exports: {
      concurrency: clampSetting(
        'QUEUE_EXPORTS_CONCURRENCY',
        env.get('QUEUE_EXPORTS_CONCURRENCY'),
        adjustments
      ),
      lockDuration: 60_000,
      stalledInterval: 30_000,
      maxStalledCount: 1,
    },
    default: {
      concurrency: clampSetting(
        'QUEUE_DEFAULT_CONCURRENCY',
        env.get('QUEUE_DEFAULT_CONCURRENCY'),
        adjustments
      ),
      lockDuration: 30_000,
      stalledInterval: 30_000,
      maxStalledCount: 1,
    },
  } satisfies Record<QueueName, WorkerSettings>,

  /**
   * Queue wait = time from enqueue (or the end of a delay) to the start
   * of a job. A start that waited longer than this is logged as a
   * queue-wait alert, and /healthz/queues reports the queue as "slow".
   * The alert channel itself (Telegram, Slack) comes with R3 monitoring.
   */
  waitAlertMs: clampSetting('QUEUE_WAIT_ALERT_MS', env.get('QUEUE_WAIT_ALERT_MS'), adjustments),

  /**
   * worker_threads pool for CPU-heavy export work (D-463). "auto" sizes
   * it to the container's CPU limit minus one, at least one thread.
   */
  cpuPool: {
    size:
      cpuPoolSize === undefined
        ? ('auto' as const)
        : clampSetting('CPU_POOL_SIZE', cpuPoolSize, adjustments),
  } as { size: number | 'auto' },

  adjustments,
}

export default queueConfig
