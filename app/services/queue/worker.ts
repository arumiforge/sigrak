import { Worker, WaitingError, type Job } from 'bullmq'
import logger from '@adonisjs/core/services/logger'
import type { QueueName, WorkerSettings } from '#config/queue'
import { defaultJobFor } from '#jobs/default_registry'
import { exportJobFor } from '#jobs/export_registry'
import { planForJob } from '#jobs/registry'
import {
  CpuPoolClosedError,
  CpuTaskInterruptedError,
  closeCpuPool,
  cpuPool,
} from '#services/cpu_pool/main'
import { cancellation } from '#services/generation/cancellation'
import { GenerationRunner } from '#services/generation/generation_runner'
import type { StepJobData } from '#services/generation/plan'
import { closeQueues, queueSettings } from '#services/queue/queues'
import {
  QueueWaitAlert,
  closeWaitMetrics,
  recordWait,
  waitMsOf,
} from '#services/queue/wait_metrics'

export type WorkerHandle = {
  worker: Worker
  /**
   * Stops taking jobs and lets running steps finish for `graceMs`; then
   * interrupts them, and each interrupted step goes back to the queue.
   */
  close(graceMs?: number): Promise<void>
}

/**
 * Runs one generation job: finds the content type's plan by job name and
 * lets the shared runner do one step.
 */
async function processGenerationJob(job: Job, token?: string, signal?: AbortSignal) {
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
 * Runs one `exports` job. CPU work cut off by shutdown (or not started
 * because the pool already closed) goes back to the queue unchanged.
 */
async function processExportJob(job: Job, token?: string, signal?: AbortSignal) {
  const handler = exportJobFor(job.name)
  if (!handler) {
    throw new Error(`No export handler for job "${job.name}"`)
  }
  try {
    return await handler.handle(job, signal)
  } catch (error) {
    if (error instanceof CpuPoolClosedError || error instanceof CpuTaskInterruptedError) {
      await job.moveToWait(token)
      throw new WaitingError()
    }
    throw error
  }
}

/**
 * Runs one `default` job (mail and other small background work).
 */
async function processDefaultJob(job: Job) {
  const handler = defaultJobFor(job.name)
  if (!handler) {
    throw new Error(`No default handler for job "${job.name}"`)
  }
  return handler.handle(job)
}

/**
 * The consumer side of a queue: the body of a worker process role
 * (`node ace queue:work ai` is `worker-ai`). `ai` runs generation
 * steps; `exports` runs export jobs with CPU work in the CPU pool;
 * `default` runs small jobs such as sending mail.
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

  for (const adjustment of settings.adjustments) {
    logger.warn(adjustment, 'Queue setting outside its range; clamped')
  }

  const alert = new QueueWaitAlert(name, settings.waitAlertMs[name])
  const run =
    name === 'exports'
      ? processExportJob
      : name === 'default'
        ? processDefaultJob
        : processGenerationJob
  const processJob = async (job: Job, token?: string, signal?: AbortSignal) => {
    const waitMs = waitMsOf(job)
    alert.observe(job, waitMs)
    void recordWait(name, waitMs)
    return run(job, token, signal)
  }

  if (name === 'exports') {
    // Start the threads now, not on the first job.
    cpuPool()
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
        // The CPU pool drains alongside: running tasks get the same grace,
        // then are cut off and their jobs return to the queue (D-451).
        await Promise.all([
          worker.close(),
          name === 'exports' ? closeCpuPool(graceMs) : Promise.resolve(),
        ])
      } finally {
        clearTimeout(timer)
        if (name === 'ai') await cancellation.stopListening()
        // Jobs re-dispatch themselves, so this process also opened producers.
        await closeQueues()
        await closeWaitMetrics()
      }
    },
  }
}
