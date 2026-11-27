import env from '#start/env'
import type { ConnectionOptions, DefaultJobOptions } from 'bullmq'

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

  workers: {
    // A crashed worker's step is back in the queue after about lockDuration + stalledInterval.
    ai: { concurrency: 4, lockDuration: 15_000, stalledInterval: 5_000, maxStalledCount: 2 },
    exports: { concurrency: 2, lockDuration: 60_000, stalledInterval: 30_000, maxStalledCount: 1 },
    default: { concurrency: 4, lockDuration: 30_000, stalledInterval: 30_000, maxStalledCount: 1 },
  } satisfies Record<QueueName, WorkerSettings>,
}

export default queueConfig
