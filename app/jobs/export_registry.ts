import type { Job } from 'bullmq'
import { cpuSample } from '#jobs/cpu_sample'

export type ExportJobHandler = {
  jobName: string
  handle(job: Job, signal?: AbortSignal): Promise<unknown>
}

/** Every job of the `exports` queue, found by job name. */
const handlers: ExportJobHandler[] = [cpuSample]

export function exportJobFor(jobName: string) {
  return handlers.find((handler) => handler.jobName === jobName)
}
