import { RedisConnection } from '@adonisjs/redis'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import type { Job } from 'bullmq'
import type { QueueName } from '#config/queue'
import { queue, queueSettings } from '#services/queue/queues'

/**
 * Queue wait: time from enqueue (or the end of a delay) to the start of a
 * job (D-467). Workers record each start in Redis (queue database, a
 * short list per queue) and log an alert above `queue.waitAlertMs`; the
 * web process reads the numbers for GET /healthz/queues. The alert
 * channel itself (Telegram, Slack) comes with R3 monitoring.
 */

export const queueNames: QueueName[] = ['ai', 'exports', 'default']

/** Starts kept per queue, and how far back the health report looks. */
const SAMPLE_LIMIT = 500
const SAMPLE_WINDOW_MS = 5 * 60_000

type TimedJob = Pick<Job, 'timestamp' | 'processedOn' | 'delay' | 'opts'>

/** Milliseconds a job waited before it started (0 when it started at once). */
export function waitMsOf(job: TimedJob, now = Date.now()): number {
  const startedAt = job.processedOn ?? now
  const readyAt = job.timestamp + (job.delay || job.opts?.delay || 0)
  return Math.max(0, startedAt - readyAt)
}

export type WaitAlert = {
  queue: QueueName
  jobId?: string
  jobName: string
  waitMs: number
  thresholdMs: number
  /** Further slow starts since the previous alert line, not logged one by one. */
  suppressed: number
}

const logAlert = (alert: WaitAlert) => {
  logger.warn({ alert: 'queue_wait', ...alert }, 'Queue wait over threshold')
}

/**
 * Raises the queue-wait alert for slow starts, at most once per
 * `intervalMs` per queue, so a backlog logs one line with a count
 * instead of one line per job.
 */
export class QueueWaitAlert {
  #lastAt = Number.NEGATIVE_INFINITY
  #suppressed = 0

  constructor(
    readonly queueName: QueueName,
    readonly thresholdMs: number,
    readonly report: (alert: WaitAlert) => void = logAlert,
    readonly intervalMs = 30_000
  ) {}

  /** Returns true when the start was over the threshold. */
  observe(job: Pick<Job, 'id' | 'name'>, waitMs: number, now = Date.now()): boolean {
    if (waitMs <= this.thresholdMs) return false
    if (now - this.#lastAt < this.intervalMs) {
      this.#suppressed++
      return true
    }
    this.report({
      queue: this.queueName,
      jobId: job.id,
      jobName: job.name,
      waitMs,
      thresholdMs: this.thresholdMs,
      suppressed: this.#suppressed,
    })
    this.#lastAt = now
    this.#suppressed = 0
    return true
  }
}

let connection: RedisConnection | undefined

/** Own connection on the queue database (D-053), opened on first use. */
function metricsRedis(): RedisConnection {
  if (!connection) {
    const { host, port, password, db } = queueSettings().connection
    connection = new RedisConnection('queue-metrics', {
      host,
      port,
      password,
      db,
      keyPrefix: `${queueSettings().prefix}:metrics:`,
      maxRetriesPerRequest: 2,
    })
    app.terminating(closeWaitMetrics)
  }
  return connection
}

export async function closeWaitMetrics() {
  const open = connection
  connection = undefined
  if (open) await open.quit()
}

const sampleKey = (name: QueueName) => `queue-wait:${name}`

/** Stores one start; never fails the job when Redis hiccups. */
export async function recordWait(name: QueueName, waitMs: number, now = Date.now()) {
  try {
    await metricsRedis()
      .multi()
      .lpush(sampleKey(name), `${now}:${Math.round(waitMs)}`)
      .ltrim(sampleKey(name), 0, SAMPLE_LIMIT - 1)
      .expire(sampleKey(name), 24 * 3600)
      .exec()
  } catch (error) {
    logger.debug({ queue: name, err: error }, 'Queue wait sample not stored')
  }
}

function percentile(sorted: number[], fraction: number) {
  if (sorted.length === 0) return null
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)]
}

export type QueueWaitReport = {
  status: 'ok' | 'slow'
  waiting: number
  active: number
  delayed: number
  /** Age of the oldest job that is ready but not started; null when none. */
  oldestWaitMs: number | null
  /** Starts in the last five minutes. */
  recent: { starts: number; p50Ms: number | null; p95Ms: number | null; maxMs: number | null }
}

export type QueueHealth = {
  status: 'ok' | 'slow'
  thresholdMs: number
  queues: Record<QueueName, QueueWaitReport>
}

async function reportFor(name: QueueName, thresholdMs: number, now: number) {
  const producer = queue(name)
  const [counts, oldest, samples] = await Promise.all([
    producer.getJobCounts('wait', 'prioritized', 'active', 'delayed'),
    producer.getJobs(['wait'], 0, 0, true),
    metricsRedis().lrange(sampleKey(name), 0, SAMPLE_LIMIT - 1),
  ])

  const waits = samples
    .map((sample) => sample.split(':').map(Number))
    .filter(([at, wait]) => now - at <= SAMPLE_WINDOW_MS && Number.isFinite(wait))
    .map(([, wait]) => wait)
    .sort((a, b) => a - b)

  const oldestJob = oldest[0] as TimedJob | undefined
  const oldestWaitMs = oldestJob ? waitMsOf({ ...oldestJob, processedOn: now }, now) : null
  const p95Ms = percentile(waits, 0.95)
  const slow = (oldestWaitMs ?? 0) > thresholdMs || (p95Ms ?? 0) > thresholdMs

  return {
    status: slow ? 'slow' : 'ok',
    waiting: (counts.wait ?? 0) + (counts.prioritized ?? 0),
    active: counts.active ?? 0,
    delayed: counts.delayed ?? 0,
    oldestWaitMs,
    recent: {
      starts: waits.length,
      p50Ms: percentile(waits, 0.5),
      p95Ms,
      maxMs: waits.length ? waits[waits.length - 1] : null,
    },
  } satisfies QueueWaitReport
}

/** Queue-wait numbers of every queue, for GET /healthz/queues. */
export async function queueHealth(now = Date.now()): Promise<QueueHealth> {
  const thresholdMs = queueSettings().waitAlertMs
  const reports = await Promise.all(queueNames.map((name) => reportFor(name, thresholdMs, now)))
  const queues = Object.fromEntries(queueNames.map((name, index) => [name, reports[index]]))
  return {
    status: reports.some((report) => report.status === 'slow') ? 'slow' : 'ok',
    thresholdMs,
    queues: queues as Record<QueueName, QueueWaitReport>,
  }
}
