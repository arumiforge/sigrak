import type { Job } from 'bullmq'
import { sendMail } from '#jobs/send_mail'

export type DefaultJobHandler = {
  jobName: string
  handle(job: Job): Promise<unknown>
}

/** Every job of the `default` queue (`worker-default`), found by job name. */
const handlers: DefaultJobHandler[] = [sendMail]

export function defaultJobFor(jobName: string) {
  return handlers.find((handler) => handler.jobName === jobName)
}
