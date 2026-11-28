import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import type { QueueName } from '#config/queue'
import type { SystemHealthConfig } from '#config/system_health'
import { authorizeStaff, staffCan } from '#staff/access'
import { readLastBackup } from '../backup.js'
import { collectDailyActivity } from '../daily_activity.js'
import { collectDisk } from '../disk.js'
import {
  FailedJobNotFoundException,
  FailedJobNotRetryableException,
  listFailedJobs,
  removeFailedJob,
  retryFailedJob,
} from '../failed_jobs.js'
import { collectQueues } from '../queues.js'
import { collectServices } from '../services.js'

const PAGE = '/kesehatan-sistem'

function settings() {
  return app.config.get<SystemHealthConfig>('system_health')
}

/**
 * A section that cannot be read right now (Redis down, a missing
 * mount) shows "tidak bisa dibaca" instead of failing the page; the
 * cause goes to the log, where the server monitoring sees it.
 */
async function orNull<T>(section: string, work: () => Promise<T>): Promise<T | null> {
  try {
    return await work()
  } catch (error) {
    logger.warn({ err: error, section }, 'Kesehatan sistem: section not readable')
    return null
  }
}

/**
 * Konsol /kesehatan-sistem (R2-04, D-316): queue sizes and waits,
 * failed jobs, free disk, generations and AI errors per day, the
 * last backup, and the cache Redis and mail (R2-09). Every section is deferred and the page refreshes itself
 * every 30 s. No alerts here: the server monitoring alerts (D-426).
 *
 * Abilities: `system_health.view` to see (owner, admin, engineer),
 * `system_health.manage` to retry or remove a failed job (owner,
 * engineer); both actions are logged.
 */
export default class SystemHealthController {
  async index(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'system_health.view')
    const config = settings()

    return ctx.inertia.render('console/system_health', {
      canManage: staffCan(staff, 'system_health.manage'),
      refreshSeconds: config.refreshSeconds,
      activityDays: config.activityDays,
      checkedAt: new Date().toISOString(),
      queues: ctx.inertia.defer(() => orNull('queues', () => collectQueues()), 'queues'),
      failedJobs: ctx.inertia.defer(
        () => orNull('failed_jobs', () => listFailedJobs({ perQueue: config.failedJobsPerQueue })),
        'queues'
      ),
      disk: ctx.inertia.defer(() => orNull('disk', () => collectDisk(config.dataPath)), 'server'),
      backup: ctx.inertia.defer(
        () => orNull('backup', () => readLastBackup(config.backupMarkerPath)),
        'server'
      ),
      services: ctx.inertia.defer(() => orNull('services', () => collectServices()), 'server'),
      activity: ctx.inertia.defer(
        () => orNull('activity', () => collectDailyActivity({ days: config.activityDays })),
        'activity'
      ),
    })
  }

  async retry(ctx: HttpContext) {
    return this.#act(ctx, retryFailedJob, 'retried')
  }

  async remove(ctx: HttpContext) {
    return this.#act(ctx, removeFailedJob, 'removed')
  }

  async #act(
    ctx: HttpContext,
    action: typeof retryFailedJob,
    done: 'retried' | 'removed'
  ): Promise<void> {
    const staff = await authorizeStaff(ctx, 'system_health.manage')
    const name = ctx.params.queue as QueueName
    try {
      const job = await action(staff, name, String(ctx.params.job))
      ctx.session.flash(
        'success',
        ctx.i18n.t(`system_health.toasts.${done}`, {
          job: job.name,
          queue: ctx.i18n.t(`system_health.queues.names.${name}`),
        })
      )
    } catch (error) {
      if (error instanceof FailedJobNotRetryableException) {
        ctx.session.flash('error', ctx.i18n.t('system_health.toasts.not_retryable'))
      } else if (error instanceof FailedJobNotFoundException) {
        ctx.session.flash('error', ctx.i18n.t('system_health.toasts.not_found'))
      } else {
        throw error
      }
    }
    return ctx.response.redirect().toPath(PAGE)
  }
}
