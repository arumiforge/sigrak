import type { Queue } from 'bullmq'
import type { QueueName } from '#config/queue'
import { queue, queueSettings } from '#services/queue/queues'
import { queueNames, waitMsOf } from '#services/queue/wait_metrics'

/**
 * The parts of a BullMQ queue the collectors read, so tests can pass a
 * fake. The real one is `queue(name)` from the producer side.
 */
export type QueueProbe = Pick<Queue, 'getJobCounts' | 'getJobs'>

export type QueueOpener<Probe = QueueProbe> = (name: QueueName) => Probe

export type QueueSummary = {
  name: QueueName
  /** Ready but not started (waiting plus prioritised). */
  waiting: number
  active: number
  delayed: number
  failed: number
  /** Age of the oldest job that is ready but not started; null when none. */
  oldestWaitMs: number | null
  /** The queue-wait alert threshold of this queue (D-469). */
  thresholdMs: number
  /** `slow` when the oldest waiting job is older than the threshold. */
  status: 'ok' | 'slow'
}

/**
 * Sizes and the oldest wait of every queue (D-316, D-467). The same
 * numbers as GET /healthz/queues, plus the failed count; the recent
 * start percentiles stay on the health endpoint.
 */
export async function collectQueues(
  options: {
    open?: QueueOpener
    names?: readonly QueueName[]
    thresholds?: Record<QueueName, number>
    now?: number
  } = {}
): Promise<QueueSummary[]> {
  const open = options.open ?? queue
  const names = options.names ?? queueNames
  const thresholds = options.thresholds ?? queueSettings().waitAlertMs
  const now = options.now ?? Date.now()

  return Promise.all(
    names.map(async (name) => {
      const probe = open(name)
      const [counts, oldest] = await Promise.all([
        probe.getJobCounts('wait', 'prioritized', 'active', 'delayed', 'failed'),
        probe.getJobs(['wait'], 0, 0, true),
      ])
      const oldestJob = oldest[0]
      const oldestWaitMs = oldestJob ? waitMsOf({ ...oldestJob, processedOn: now }, now) : null
      const thresholdMs = thresholds[name]
      return {
        name,
        waiting: (counts.wait ?? 0) + (counts.prioritized ?? 0),
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
        oldestWaitMs,
        thresholdMs,
        status: (oldestWaitMs ?? 0) > thresholdMs ? 'slow' : 'ok',
      } satisfies QueueSummary
    })
  )
}
