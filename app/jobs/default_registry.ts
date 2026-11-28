import type { Job } from 'bullmq'
import { sendMail } from '#jobs/send_mail'
import { generateTimetableDraft } from '#timetable/draft_job'

export type DefaultJobHandler = {
  jobName: string
  handle(job: Job, signal?: AbortSignal): Promise<unknown>
}

/** Every job of the `default` queue (`worker-default`), found by job name. */
const handlers: DefaultJobHandler[] = [sendMail, generateTimetableDraft]

export function defaultJobFor(jobName: string) {
  return handlers.find((handler) => handler.jobName === jobName)
}
