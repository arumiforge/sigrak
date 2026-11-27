import { Queue, type JobsOptions } from 'bullmq'
import app from '@adonisjs/core/services/app'
import type queueConfig from '#config/queue'
import type { QueueName } from '#config/queue'

type QueueConfig = typeof queueConfig

const open = new Map<QueueName, Queue>()

export function queueSettings(): QueueConfig {
  return app.config.get<QueueConfig>('queue')
}

/**
 * The producer side of a queue, opened on first use and closed when the
 * app terminates. Any process may add jobs; only the queue's own
 * process role runs them.
 */
export function queue(name: QueueName): Queue {
  let instance = open.get(name)
  if (!instance) {
    const settings = queueSettings()
    instance = new Queue(name, {
      connection: settings.connection,
      prefix: settings.prefix,
      defaultJobOptions: settings.defaultJobOptions,
    })
    if (open.size === 0) {
      app.terminating(closeQueues)
    }
    open.set(name, instance)
  }
  return instance
}

export async function dispatch<Data extends Record<string, unknown>>(
  name: QueueName,
  jobName: string,
  data: Data,
  options: JobsOptions = {}
) {
  return queue(name).add(jobName, data, options)
}

export async function closeQueues() {
  const queues = [...open.values()]
  open.clear()
  await Promise.all(queues.map((instance) => instance.close()))
}
