import { Worker, WaitingError, type Job } from 'bullmq'
import logger from '@adonisjs/core/services/logger'
import type { QueueName, WorkerSettings } from '#config/queue'
import { planForJob } from '#jobs/registry'
import { cancellation } from '#services/generation/cancellation'
import { GenerationRunner } from '#services/generation/generation_runner'
import type { StepJobData } from '#services/generation/plan'
import { closeQueues, queueSettings } from '#services/queue/queues'

export type WorkerHandle = {
  worker: Worker
  /**
   * Stops taking jobs and lets running steps finish for `graceMs`; then
   * interrupts them, and each interrupted step goes back to the queue.
   */
  close(graceMs?: number): Promise<void>
}

/**
 * Runs one job: finds the content type's plan by job name and lets the
 * shared runner do one step.
 */
async function processJob(job: Job, token?: string, signal?: AbortSignal) {
  const plan = planForJob(job.name)
  if (!plan) {
    throw new Error(`No plan for job "${job.name}"`)
  }
  const outcome = await new GenerationRunner(plan).runStep(job.data as StepJobData, signal)
  if (outcome === 'interrupted') {
    // Shutdown mid-call: the same job (same id) waits for the next worker.
    await job.moveToWait(token)
    throw new WaitingError()
  }
  return outcome
}

/**
 * The consumer side of a queue: the body of a worker process role
 * (`node ace queue:work ai` is `worker-ai`). Only the `ai` queue has
 * jobs in R0-06.
 */
export async function startWorker(
  name: QueueName,
  overrides: Partial<WorkerSettings> = {}
): Promise<WorkerHandle> {
  const settings = queueSettings()
  const { concurrency, lockDuration, stalledInterval, maxStalledCount } = {
    ...settings.workers[name],
    ...overrides,
  }

  const worker = new Worker(name, processJob, {
    connection: settings.connection,
    prefix: settings.prefix,
    concurrency,
    lockDuration,
    stalledInterval,
    maxStalledCount,
  })
  worker.on('failed', (job, error) => {
    logger.error({ queue: name, job: job?.id, err: error }, 'Queue job failed')
  })
  worker.on('error', (error) => {
    logger.error({ queue: name, err: error }, 'Queue worker error')
  })

  if (name === 'ai') {
    await cancellation.listen()
  }
  await worker.waitUntilReady()

  return {
    worker,
    async close(graceMs = settings.shutdownGraceMs) {
      const timer = setTimeout(() => cancellation.abortAll('shutdown'), graceMs)
      try {
        await worker.close()
      } finally {
        clearTimeout(timer)
        if (name === 'ai') await cancellation.stopListening()
        // Jobs re-dispatch themselves, so this process also opened producers.
        await closeQueues()
      }
    },
  }
}
