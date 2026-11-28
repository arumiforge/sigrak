import type { ReactNode } from 'react'
import { router, usePoll } from '@inertiajs/react'
import { Icon } from '~/components/icon'
import { ConfirmAction } from '~/components/patterns/confirm_dialog'
import { DataTable, type DataColumn } from '~/components/patterns/data_table'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { DeferredSection, SkeletonCards, SkeletonList } from '~/components/patterns/skeletons'
import { StatusChip, type StatusTone } from '~/components/patterns/status_chip'
import { Button } from '~/components/ui/button'
import { formatDateTime, formatNumber, formatTime } from '~/lib/format'
import { useT } from '~/lib/i18n'

type QueueName = 'ai' | 'exports' | 'default'

type QueueSummary = {
  name: QueueName
  waiting: number
  active: number
  delayed: number
  failed: number
  oldestWaitMs: number | null
  thresholdMs: number
  status: 'ok' | 'slow'
}

type FailedJob = {
  queue: QueueName
  id: string
  name: string
  reason: string
  attempts: number
  queuedAt: string
  failedAt: string | null
}

type DiskSummary = {
  path: string
  totalBytes: number
  freeBytes: number
  freePercent: number
  status: 'ok' | 'low' | 'critical'
}

type ActivityDay = {
  day: string
  generations: number
  succeeded: number
  failed: number
  aiAttempts: number
  aiErrors: number
}

type DailyActivity = {
  days: ActivityDay[]
  aiErrorKinds: { outcome: string; count: number }[]
}

type Props = {
  canManage: boolean
  refreshSeconds: number
  activityDays: number
  checkedAt: string
  /** Deferred; null when the section cannot be read right now. */
  queues?: QueueSummary[] | null
  failedJobs?: FailedJob[] | null
  disk?: DiskSummary | null
  backup?: { lastBackupAt: string | null } | null
  activity?: DailyActivity | null
}

const REFRESHED_PROPS = ['checkedAt', 'queues', 'failedJobs', 'disk', 'backup', 'activity']

type T = ReturnType<typeof useT>

function duration(t: T, ms: number) {
  if (ms < 60_000) return t('system_health.duration.seconds', { count: Math.round(ms / 1000) })
  if (ms < 3_600_000) {
    return t('system_health.duration.minutes', { count: Math.floor(ms / 60_000) })
  }
  return t('system_health.duration.hours', {
    count: formatNumber(ms / 3_600_000, { decimals: 1 }),
  })
}

function bytes(t: T, value: number) {
  const gigabytes = value / 1024 ** 3
  if (gigabytes >= 1) {
    return t('system_health.bytes.gigabytes', { count: formatNumber(gigabytes, { decimals: 1 }) })
  }
  return t('system_health.bytes.megabytes', {
    count: formatNumber(Math.round(value / 1024 ** 2)),
  })
}

/** "2026-11-28" → "28/11/2026" (already a WIB day). */
function shortDay(day: string) {
  const [year, month, date] = day.split('-')
  return `${date}/${month}/${year}`
}

function Section({
  title,
  intro,
  children,
  id,
}: {
  title: string
  intro?: ReactNode
  children: ReactNode
  id: string
}) {
  return (
    <section aria-labelledby={id} className="mb-8">
      <h2 id={id} className="text-xl font-bold">
        {title}
      </h2>
      {intro && <p className="mt-1 max-w-3xl text-sm text-muted">{intro}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Unavailable() {
  const t = useT()
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border border-warn/35 bg-warn-tint p-4 text-sm text-warn"
    >
      <Icon name="warning" size={18} className="mt-0.5 shrink-0" />
      {t('system_health.unavailable')}
    </p>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

const diskTone: Record<DiskSummary['status'], StatusTone> = {
  ok: 'ok',
  low: 'warn',
  critical: 'danger',
}

function ServerCards({ disk, backup }: Pick<Props, 'disk' | 'backup'>) {
  const t = useT()
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border bg-surface p-4" data-testid="disk-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">{t('system_health.disk.title')}</h3>
          {disk && (
            <StatusChip tone={diskTone[disk.status]} icon>
              {t(`system_health.disk.status.${disk.status}`)}
            </StatusChip>
          )}
        </div>
        {disk ? (
          <>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {t('system_health.disk.free_percent', { percent: disk.freePercent })}
            </p>
            <p className="text-sm">
              {t('system_health.disk.free', {
                free: bytes(t, disk.freeBytes),
                total: bytes(t, disk.totalBytes),
              })}
            </p>
            <p className="mt-1 text-xs break-all text-muted">
              {t('system_health.disk.path', { path: disk.path })}
            </p>
          </>
        ) : (
          <div className="mt-3">
            <Unavailable />
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-surface p-4" data-testid="backup-card">
        <h3 className="font-bold">{t('system_health.backup.title')}</h3>
        {backup ? (
          backup.lastBackupAt ? (
            <>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {formatDateTime(backup.lastBackupAt)}
              </p>
              <p className="text-sm text-muted">{t('system_health.backup.at_note')}</p>
            </>
          ) : (
            <>
              <p className="mt-2 text-2xl font-bold">{t('system_health.backup.none')}</p>
              <p className="text-sm text-muted">{t('system_health.backup.none_note')}</p>
            </>
          )
        ) : (
          <div className="mt-3">
            <Unavailable />
          </div>
        )}
      </div>
    </div>
  )
}

function QueueCards({ queues }: { queues: QueueSummary[] | null | undefined }) {
  const t = useT()
  if (!queues) return <Unavailable />
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {queues.map((queue) => (
        <div
          key={queue.name}
          className="rounded-lg border bg-surface p-4"
          data-testid={`queue-${queue.name}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">{t(`system_health.queues.names.${queue.name}`)}</h3>
            <StatusChip tone={queue.status === 'ok' ? 'ok' : 'warn'} icon>
              {t(`system_health.queues.status.${queue.status}`)}
            </StatusChip>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <Stat
              label={t('system_health.queues.labels.waiting')}
              value={formatNumber(queue.waiting)}
            />
            <Stat
              label={t('system_health.queues.labels.active')}
              value={formatNumber(queue.active)}
            />
            <Stat
              label={t('system_health.queues.labels.delayed')}
              value={formatNumber(queue.delayed)}
            />
            <Stat
              label={t('system_health.queues.labels.failed')}
              value={formatNumber(queue.failed)}
            />
            <div className="col-span-2">
              <Stat
                label={t('system_health.queues.labels.oldest_wait')}
                value={
                  queue.oldestWaitMs === null
                    ? t('system_health.queues.none_waiting')
                    : duration(t, queue.oldestWaitMs)
                }
              />
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted">
            {t('system_health.queues.threshold', { duration: duration(t, queue.thresholdMs) })}
          </p>
        </div>
      ))}
    </div>
  )
}

function FailedJobs({
  jobs,
  canManage,
}: {
  jobs: FailedJob[] | null | undefined
  canManage: boolean
}) {
  const t = useT()
  if (!jobs) return <Unavailable />

  const columns: DataColumn<FailedJob>[] = [
    {
      id: 'job',
      header: t('system_health.failed.labels.job'),
      primary: true,
      cell: (job) => (
        <span className="font-semibold break-all">
          {job.name} <span className="font-normal text-muted">#{job.id}</span>
        </span>
      ),
    },
    {
      id: 'queue',
      header: t('system_health.failed.labels.queue'),
      cell: (job) => t(`system_health.queues.names.${job.queue}`),
    },
    {
      id: 'reason',
      header: t('system_health.failed.labels.reason'),
      cell: (job) =>
        job.reason ? (
          <span className="break-words">{job.reason}</span>
        ) : (
          <span className="text-muted">{t('system_health.failed.no_reason')}</span>
        ),
    },
    {
      id: 'attempts',
      header: t('system_health.failed.labels.attempts'),
      align: 'right',
      cell: (job) => formatNumber(job.attempts),
    },
    {
      id: 'failed_at',
      header: t('system_health.failed.labels.failed_at'),
      cell: (job) => (
        <span className="whitespace-nowrap">{formatDateTime(job.failedAt ?? job.queuedAt)}</span>
      ),
    },
  ]

  const base = (job: FailedJob) =>
    `/kesehatan-sistem/pekerjaan/${job.queue}/${encodeURIComponent(job.id)}`

  return (
    <>
      {!canManage && jobs.length > 0 && (
        <p className="mb-3 text-sm text-muted">{t('system_health.failed.view_only_note')}</p>
      )}
      <DataTable
        rows={jobs}
        columns={columns}
        getRowId={(job) => `${job.queue}:${job.id}`}
        caption={t('system_health.failed.caption')}
        empty={<EmptyState icon="success" description={t('system_health.failed.empty')} compact />}
        rowActions={
          canManage
            ? (job) => {
                const queue = t(`system_health.queues.names.${job.queue}`)
                return (
                  <div className="flex flex-wrap gap-2">
                    <ConfirmAction
                      action={`${base(job)}/coba-lagi`}
                      label={t('system_health.failed.retry_action')}
                      ariaLabel={t('system_health.failed.retry_label', { job: job.name })}
                      title={t('system_health.failed.retry_title', { job: job.name })}
                      description={t('system_health.failed.retry_description', { queue })}
                      confirmLabel={t('system_health.failed.retry_label', { job: job.name })}
                      destructive={false}
                      size="sm"
                    />
                    <ConfirmAction
                      action={`${base(job)}/hapus`}
                      label={t('system_health.failed.remove_action')}
                      ariaLabel={t('system_health.failed.remove_label', { job: job.name })}
                      title={t('system_health.failed.remove_title', { job: job.name })}
                      description={t('system_health.failed.remove_description', { queue })}
                      confirmLabel={t('system_health.failed.remove_label', { job: job.name })}
                      size="sm"
                    />
                  </div>
                )
              }
            : undefined
        }
      />
    </>
  )
}

function Activity({
  activity,
  days,
}: {
  activity: DailyActivity | null | undefined
  days: number
}) {
  const t = useT()
  if (!activity) return <Unavailable />

  const totals = activity.days.reduce(
    (sum, day) => ({
      generations: sum.generations + day.generations,
      succeeded: sum.succeeded + day.succeeded,
      failed: sum.failed + day.failed,
      aiAttempts: sum.aiAttempts + day.aiAttempts,
      aiErrors: sum.aiErrors + day.aiErrors,
    }),
    { generations: 0, succeeded: 0, failed: 0, aiAttempts: 0, aiErrors: 0 }
  )
  const number = (key: keyof typeof totals) =>
    function NumberCell(day: ActivityDay) {
      return <span className="tabular-nums">{formatNumber(day[key])}</span>
    }
  const columns: DataColumn<ActivityDay>[] = [
    {
      id: 'day',
      header: t('system_health.activity.labels.day'),
      primary: true,
      cell: (day) => shortDay(day.day),
    },
    {
      id: 'generations',
      header: t('system_health.activity.labels.generations'),
      align: 'right',
      cell: number('generations'),
    },
    {
      id: 'succeeded',
      header: t('system_health.activity.labels.succeeded'),
      align: 'right',
      cell: number('succeeded'),
    },
    {
      id: 'failed',
      header: t('system_health.activity.labels.failed'),
      align: 'right',
      cell: number('failed'),
    },
    {
      id: 'ai_attempts',
      header: t('system_health.activity.labels.ai_attempts'),
      align: 'right',
      cell: number('aiAttempts'),
    },
    {
      id: 'ai_errors',
      header: t('system_health.activity.labels.ai_errors'),
      align: 'right',
      cell: number('aiErrors'),
    },
  ]
  const outcome = (code: string) => {
    const key = `system_health.activity.outcomes.${code}`
    const label = t(key)
    return label === key ? code : label
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <DataTable
        rows={[...activity.days].reverse()}
        columns={columns}
        getRowId={(day) => day.day}
        caption={t('system_health.activity.caption')}
        estimateCardHeight={220}
      />
      <div className="space-y-3">
        <div className="rounded-lg border bg-surface p-4">
          <h3 className="font-bold">{t('system_health.activity.totals_title', { days })}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <Stat
              label={t('system_health.activity.labels.generations')}
              value={formatNumber(totals.generations)}
            />
            <Stat
              label={t('system_health.activity.labels.failed')}
              value={formatNumber(totals.failed)}
            />
            <Stat
              label={t('system_health.activity.labels.ai_attempts')}
              value={formatNumber(totals.aiAttempts)}
            />
            <Stat
              label={t('system_health.activity.labels.ai_errors')}
              value={formatNumber(totals.aiErrors)}
            />
          </dl>
        </div>
        <div className="rounded-lg border bg-surface p-4" data-testid="ai-error-kinds">
          <h3 className="font-bold">{t('system_health.activity.kinds_title')}</h3>
          {activity.aiErrorKinds.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{t('system_health.activity.kinds_empty')}</p>
          ) : (
            <ul className="mt-2 divide-y">
              {activity.aiErrorKinds.map((kind) => (
                <li key={kind.outcome} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 text-sm break-words">{outcome(kind.outcome)}</span>
                  <span className="font-semibold tabular-nums">{formatNumber(kind.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Konsol /kesehatan-sistem (R2-04, D-316): queues, failed jobs, disk,
 * generations and AI errors per day, last backup. Every section is a
 * deferred prop with its skeleton; the page reloads them every
 * `refreshSeconds` (30 s). Abilities: `system_health.view` to see,
 * `system_health.manage` for "Coba lagi" and "Hapus".
 */
export default function ConsoleSystemHealth({
  canManage,
  refreshSeconds,
  activityDays: days,
  checkedAt,
  queues,
  failedJobs,
  disk,
  backup,
  activity,
}: Props) {
  const t = useT()
  usePoll(refreshSeconds * 1000, { only: REFRESHED_PROPS })

  return (
    <>
      <PageHeader
        title={t('system_health.title')}
        description={t('system_health.intro')}
        meta={t('system_health.checked_at', { time: formatTime(checkedAt) })}
        actions={
          <Button
            variant="outline"
            onClick={() => router.reload({ only: REFRESHED_PROPS })}
            data-testid="refresh"
          >
            <Icon name="loading" />
            {t('system_health.refresh_action')}
          </Button>
        }
      />

      <div className="mb-8">
        <DeferredSection data={['disk', 'backup']} fallback={<SkeletonCards cards={2} />}>
          <ServerCards disk={disk} backup={backup} />
        </DeferredSection>
      </div>

      <Section
        id="queues-title"
        title={t('system_health.queues.title')}
        intro={t('system_health.queues.intro')}
      >
        <DeferredSection data="queues" fallback={<SkeletonCards cards={3} />}>
          <QueueCards queues={queues} />
        </DeferredSection>
      </Section>

      <Section
        id="failed-title"
        title={t('system_health.failed.title')}
        intro={t('system_health.failed.intro')}
      >
        <DeferredSection data="failedJobs" fallback={<SkeletonList rows={3} />}>
          <FailedJobs jobs={failedJobs} canManage={canManage} />
        </DeferredSection>
      </Section>

      <Section
        id="activity-title"
        title={t('system_health.activity.title')}
        intro={t('system_health.activity.intro', { days })}
      >
        <DeferredSection data="activity" fallback={<SkeletonList rows={6} />}>
          <Activity activity={activity} days={days} />
        </DeferredSection>
      </Section>
    </>
  )
}
