import { Exception } from '@adonisjs/core/exceptions'
import type { Job, Queue } from 'bullmq'
import type { QueueName } from '#config/queue'
import type StaffUser from '#models/staff_user'
import { logStaffActivity } from '#accounts/activity_log'
import { queue } from '#services/queue/queues'
import { queueNames } from '#services/queue/wait_metrics'
import type { QueueOpener } from './queues.js'

/**
 * Failed queue jobs on Kesehatan sistem (R2-04, D-316): a list per
 * queue, newest first, and two actions for staff with
 * `system_health.manage` (engineer, owner): try again or remove. Both
 * are logged (subject `job`, id `<queue>:<job id>`).
 *
 * The page never shows a job's data (it may name people); only its
 * name, the first line of the failure reason with e-mail addresses
 * masked, the attempts and the times.
 *
 * Jobs on the `ai` queue are generation steps: when one fails, its
 * generation is already marked failed and the teacher starts again
 * with their own "Coba lagi", so a retry here cannot help. Those jobs
 * can only be removed (R2-09).
 */

/** Queues whose failed jobs are not offered "Coba lagi". */
export const NOT_RETRYABLE_QUEUES: readonly QueueName[] = ['ai']

export type FailedJobSource = Pick<Queue, 'getFailed' | 'getJob'>

/** The parts of a job the list reads (a fake in tests). */
export type FailedJobLike = Pick<
  Job,
  'id' | 'name' | 'failedReason' | 'attemptsMade' | 'timestamp' | 'finishedOn'
>

/** A job the actions change. */
export type FailedJobHandle = FailedJobLike & Pick<Job, 'getState' | 'retry' | 'remove'>

export type FailedJob = {
  queue: QueueName
  id: string
  name: string
  /** First line of the failure reason, shortened, e-mail addresses masked. */
  reason: string
  attempts: number
  queuedAt: string
  failedAt: string | null
  /** False on queues where a retry cannot help (see NOT_RETRYABLE_QUEUES). */
  retryable: boolean
}

export const REASON_MAX_LENGTH = 200

export class FailedJobNotFoundException extends Exception {
  static status = 404
  static code = 'E_FAILED_JOB_NOT_FOUND'
  static message = 'No failed job with this id on this queue.'
}

export class FailedJobNotRetryableException extends Exception {
  static status = 422
  static code = 'E_FAILED_JOB_NOT_RETRYABLE'
  static message = 'Failed jobs on this queue are not retried from the console.'
}

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g

/** One short, safe line of a failure reason. */
export function summarizeReason(reason: string | undefined | null) {
  const firstLine = (reason ?? '').split('\n', 1)[0].trim().replace(EMAIL, '[email]')
  return firstLine.length > REASON_MAX_LENGTH
    ? `${firstLine.slice(0, REASON_MAX_LENGTH - 1)}…`
    : firstLine
}

export function toFailedJob(name: QueueName, job: FailedJobLike): FailedJob {
  return {
    queue: name,
    id: String(job.id),
    name: job.name,
    reason: summarizeReason(job.failedReason),
    attempts: job.attemptsMade ?? 0,
    queuedAt: new Date(job.timestamp).toISOString(),
    failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    retryable: !NOT_RETRYABLE_QUEUES.includes(name),
  }
}

/**
 * The newest failed jobs of every queue (at most `perQueue` each),
 * newest failure first across queues.
 */
export async function listFailedJobs(
  options: {
    open?: QueueOpener<FailedJobSource>
    names?: readonly QueueName[]
    perQueue?: number
  } = {}
): Promise<FailedJob[]> {
  const open = options.open ?? queue
  const names = options.names ?? queueNames
  const perQueue = options.perQueue ?? 25

  const lists = await Promise.all(
    names.map(async (name) => {
      const jobs = (await open(name).getFailed(0, perQueue - 1)) as FailedJobLike[]
      return jobs.filter(Boolean).map((job) => toFailedJob(name, job))
    })
  )
  return lists
    .flat()
    .sort((a, b) => (b.failedAt ?? b.queuedAt).localeCompare(a.failedAt ?? a.queuedAt))
}

async function failedJob(
  open: QueueOpener<FailedJobSource>,
  name: QueueName,
  id: string
): Promise<FailedJobHandle> {
  const job = (await open(name).getJob(id)) as FailedJobHandle | undefined
  if (!job || (await job.getState()) !== 'failed') {
    throw new FailedJobNotFoundException()
  }
  return job
}

function logged(job: FailedJob) {
  return { queue: job.queue, job_name: job.name, reason: job.reason }
}

/** Puts a failed job back in its queue, from the start, and logs it. */
export async function retryFailedJob(
  staff: StaffUser,
  name: QueueName,
  id: string,
  options: { open?: QueueOpener<FailedJobSource> } = {}
) {
  if (NOT_RETRYABLE_QUEUES.includes(name)) throw new FailedJobNotRetryableException()
  const job = await failedJob(options.open ?? queue, name, id)
  // Read before the retry, which clears the failure reason on the job.
  const before = toFailedJob(name, job)
  await job.retry('failed')
  await logStaffActivity(staff, 'job.retry', 'job', `${name}:${before.id}`, logged(before))
  return before
}

/** Removes a failed job for good and logs it. */
export async function removeFailedJob(
  staff: StaffUser,
  name: QueueName,
  id: string,
  options: { open?: QueueOpener<FailedJobSource> } = {}
) {
  const job = await failedJob(options.open ?? queue, name, id)
  const before = toFailedJob(name, job)
  await job.remove()
  await logStaffActivity(staff, 'job.remove', 'job', `${name}:${before.id}`, logged(before))
  return before
}
