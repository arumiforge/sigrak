import type { ReactNode } from 'react'
import { Link } from '@inertiajs/react'
import { Icon } from '~/components/icon'
import { StatusChip } from '~/components/patterns/status_chip'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

/**
 * Shared parts of the timetable pages (R1-09): times shown as `07.35`
 * (EYD, D-471), rows grouped by day, and the year chips.
 */

export const WEEKDAYS = [1, 2, 3, 4, 5, 6] as const

const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** The day's name, Monday (1) to Saturday (6). */
export function dayName(t: ReturnType<typeof useT>, weekday: number) {
  return t(`timetable.weekdays.${WEEKDAY_KEYS[weekday - 1] ?? 'monday'}`)
}

export type Row = {
  publicId: string | null
  weekday: number
  periodNo: number | null
  startsAt: string
  endsAt: string
  kind: 'lesson' | 'break' | 'ceremony' | 'activity'
  label: string | null
  subjectCode: string | null
  subjectName: string | null
  teacherName: string | null
  jp: number
  locked: boolean
  notTaught: boolean
}

/** `07:35` → `07.35`. */
export function displayTime(value: string) {
  return value.slice(0, 5).replace(':', '.')
}

/** Minutes after midnight of `07:35`, or null. */
export function minutesOf(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

export function TimeRange({ start, end }: { start: string; end: string }) {
  const t = useT()
  return (
    <span className="tabular-nums">
      {t('timetable.time_range', { start: displayTime(start), end: displayTime(end) })}
    </span>
  )
}

/** What a row is: the subject, or Istirahat/Upacara/Kegiatan with its label. */
export function rowTitle(t: ReturnType<typeof useT>, row: Row) {
  if (row.kind === 'lesson') return row.subjectName ?? ''
  return row.label ?? t(`timetable.kinds.${row.kind}`)
}

/** One row as a compact line: time, title, teacher and JP. */
export function RowLine({ row, actions }: { row: Row; actions?: ReactNode }) {
  const t = useT()
  const lesson = row.kind === 'lesson'
  return (
    <li
      className={cn(
        'grid gap-1 py-2 sm:grid-cols-[9.5rem_1fr_auto] sm:items-center sm:gap-3',
        !lesson && 'text-muted'
      )}
      data-testid="timetable-row"
    >
      <p className="text-sm font-semibold">
        <TimeRange start={row.startsAt} end={row.endsAt} />
      </p>
      <div className="min-w-0">
        <p className={cn('font-semibold', !lesson && 'font-normal italic')}>
          {rowTitle(t, row)}
          {row.locked && (
            <StatusChip tone="brand" className="ml-2 align-middle not-italic">
              {t('timetable.locked_badge')}
            </StatusChip>
          )}
        </p>
        {lesson && (
          <p className="text-xs text-muted">
            {[
              row.teacherName ?? t('timetable.no_teacher'),
              t('timetable.jp_count', { count: row.jp }),
              row.notTaught ? t('timetable.not_taught') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </li>
  )
}

/** Rows grouped by weekday; days without rows say so (or are left out). */
export function DayGroups({
  rows,
  renderActions,
  hideEmpty,
  dense,
}: {
  rows: Row[]
  renderActions?: (row: Row) => ReactNode
  hideEmpty?: boolean
  dense?: boolean
}) {
  const t = useT()
  return (
    <div className={cn('grid gap-4', !dense && 'md:grid-cols-2')}>
      {WEEKDAYS.map((weekday) => {
        const dayRows = rows.filter((row) => row.weekday === weekday)
        if (hideEmpty && dayRows.length === 0) return null
        return (
          <div key={weekday} className="min-w-0">
            <h3 className="font-bold">{dayName(t, weekday)}</h3>
            {dayRows.length === 0 ? (
              <p className="py-2 text-sm text-muted">{t('timetable.class.day_empty')}</p>
            ) : (
              <ul className="divide-y">
                {dayRows.map((row, index) => (
                  <RowLine
                    key={row.publicId ?? `${weekday}-${index}`}
                    row={row}
                    actions={renderActions?.(row)}
                  />
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

export type YearChoice = { publicId: string; name: string; isCurrent: boolean }

/** Links to the same page for another academic year. */
export function YearChips({
  years,
  current,
  basePath,
  label,
}: {
  years: YearChoice[]
  current: string
  basePath: string
  label: string
}) {
  if (years.length < 2) return null
  return (
    <nav aria-label={label} className="mt-4 overflow-x-auto">
      <ul className="flex gap-2">
        {years.map((row) => (
          <li key={row.publicId}>
            <Link
              href={`${basePath}?tahun=${row.publicId}`}
              prefetch
              aria-current={row.publicId === current ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap',
                row.publicId === current
                  ? 'border-brand bg-brand-tint text-brand-strong'
                  : 'bg-surface text-muted hover:text-text'
              )}
            >
              {row.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** A short status line with an icon (complete, warning, info). */
export function StatusLine({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'info' | 'danger'
  children: ReactNode
}) {
  const icon =
    tone === 'ok' ? 'success' : tone === 'warn' ? 'warning' : tone === 'danger' ? 'error' : 'info'
  return (
    <p
      className={cn(
        'flex items-start gap-2 text-sm',
        tone === 'ok' && 'text-ok',
        tone === 'warn' && 'text-warn',
        tone === 'danger' && 'text-danger',
        tone === 'info' && 'text-muted'
      )}
    >
      <Icon name={icon} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
