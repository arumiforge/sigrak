import { useState, type ReactNode } from 'react'
import { Deferred, Head } from '@inertiajs/react'
import AppLayout from '~/layouts/app_layout'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'
import {
  addMonths,
  formatMonth,
  formatRange,
  formatWeekday,
  monthGrid,
  monthKeyOf,
  parseDate,
  weekdayNames,
} from '~/lib/dates'

type CalendarEntry = {
  id: string
  title: string
  kind: 'holiday' | 'exam' | 'school_event' | 'no_lessons' | 'national_holiday' | 'joint_leave'
  examType: 'sts' | 'sas' | 'other' | null
  startsOn: string
  endsOn: string
  source: 'school' | 'national'
  isProvisional: boolean
  isSchoolDay: boolean
}

type Props = {
  school: { name: string } | null
  calendar: { name: string; academicYear: string; startsOn: string; endsOn: string } | null
  today: string
  /** Deferred: loaded right after the first render. */
  entries?: CalendarEntry[]
}

type View = 'month' | 'list'

/** A day without lessons for the whole school. */
function isDayOff(entry: CalendarEntry) {
  if (entry.kind === 'joint_leave') return !entry.isSchoolDay
  return entry.kind === 'holiday' || entry.kind === 'national_holiday'
}

function covers(entry: CalendarEntry, date: string) {
  return entry.startsOn <= date && date <= entry.endsOn
}

function overlapsMonth(entry: CalendarEntry, monthKey: string) {
  return monthKeyOf(entry.startsOn) <= monthKey && monthKey <= monthKeyOf(entry.endsOn)
}

function clampMonth(monthKey: string, first: string, last: string) {
  if (monthKey < first) return first
  if (monthKey > last) return last
  return monthKey
}

export default function CalendarPage({ school, calendar, today, entries }: Props) {
  const t = useT()
  const [view, setView] = useState<View>('month')

  const firstMonth = calendar ? monthKeyOf(calendar.startsOn) : monthKeyOf(today)
  const lastMonth = calendar ? monthKeyOf(calendar.endsOn) : monthKeyOf(today)
  const [month, setMonth] = useState(() => clampMonth(monthKeyOf(today), firstMonth, lastMonth))

  return (
    <>
      <Head title={t('calendar.title')} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t('calendar.title')}</h1>
          {school && calendar && (
            <p className="mt-1 text-muted">
              {school.name} · {t('calendar.year', { name: calendar.academicYear })}
            </p>
          )}
        </div>

        {calendar && (
          <div
            role="group"
            aria-label={t('calendar.views.label')}
            className="inline-flex rounded-md border bg-surface p-1"
          >
            {(['month', 'list'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold text-muted',
                  view === option && 'bg-brand-tint text-brand-strong'
                )}
              >
                <Icon name={option === 'month' ? 'grid' : 'list'} />
                {t(`calendar.views.${option}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {!school && <EmptyState>{t('common.empty.no_role')}</EmptyState>}
      {school && !calendar && <EmptyState>{t('calendar.no_calendar')}</EmptyState>}

      {calendar && view === 'month' && (
        <MonthView
          month={month}
          today={today}
          canGoBack={month > firstMonth}
          canGoForward={month < lastMonth}
          onMonthChange={(delta) =>
            setMonth((current) => clampMonth(addMonths(current, delta), firstMonth, lastMonth))
          }
          onThisMonth={() => setMonth(clampMonth(monthKeyOf(today), firstMonth, lastMonth))}
          entries={entries}
        />
      )}

      {calendar && view === 'list' && (
        <section className="mt-6" aria-labelledby="calendar-list-title">
          <h2 id="calendar-list-title" className="sr-only">
            {t('calendar.views.list')}
          </h2>
          <Deferred data="entries" fallback={<EntryListSkeleton rows={8} />}>
            <YearList entries={entries ?? []} />
          </Deferred>
        </section>
      )}
    </>
  )
}

CalendarPage.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card className="mt-6 px-6">
      <p>{children}</p>
    </Card>
  )
}

function MonthView({
  month,
  today,
  canGoBack,
  canGoForward,
  onMonthChange,
  onThisMonth,
  entries,
}: {
  month: string
  today: string
  canGoBack: boolean
  canGoForward: boolean
  onMonthChange: (delta: number) => void
  onThisMonth: () => void
  entries?: CalendarEntry[]
}) {
  const t = useT()
  const label = formatMonth(month)

  return (
    <section className="mt-6" aria-labelledby="calendar-month-title">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onMonthChange(-1)}
          disabled={!canGoBack}
          aria-label={t('calendar.month_nav.previous')}
        >
          <Icon name="chevron-left" />
        </Button>
        <h2
          id="calendar-month-title"
          className="min-w-0 flex-1 text-center text-xl font-semibold"
          aria-live="polite"
        >
          {label}
        </h2>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onMonthChange(1)}
          disabled={!canGoForward}
          aria-label={t('calendar.month_nav.next')}
        >
          <Icon name="chevron-right" />
        </Button>
        <Button variant="ghost" onClick={onThisMonth} className="hidden sm:inline-flex">
          {t('calendar.month_nav.this_month')}
        </Button>
      </div>

      <Card className="mt-4 gap-0 overflow-hidden py-0">
        <MonthGrid month={month} today={today} entries={entries} />
      </Card>

      <h3 className="mt-6 text-lg font-semibold">
        {t('calendar.events_in_month', { month: label })}
      </h3>
      <Deferred data="entries" fallback={<EntryListSkeleton rows={4} />}>
        <MonthList month={month} entries={entries ?? []} />
      </Deferred>
    </section>
  )
}

/**
 * The grid needs no data: the days render at once and the markers fill
 * in when the deferred entries arrive, so nothing shifts.
 */
function MonthGrid({
  month,
  today,
  entries,
}: {
  month: string
  today: string
  entries?: CalendarEntry[]
}) {
  const t = useT()
  const cells = monthGrid(month)
  const names = weekdayNames()

  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">{formatMonth(month)}</caption>
      <thead>
        <tr>
          {names.map((name, index) => (
            <th
              key={name}
              scope="col"
              className={cn(
                'border-b py-2 text-xs font-semibold text-muted',
                index === 6 && 'text-danger'
              )}
            >
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: cells.length / 7 }, (_, week) => (
          <tr key={week}>
            {cells.slice(week * 7, week * 7 + 7).map((date, index) => {
              if (!date) {
                return (
                  <td
                    key={`empty-${week}-${index}`}
                    className="h-14 border-b border-r last:border-r-0 bg-page/60"
                  />
                )
              }
              const dayEntries = entries?.filter((entry) => covers(entry, date)) ?? []
              const off = index === 6 || dayEntries.some(isDayOff)
              const isToday = date === today
              const description = dayEntries.map((entry) => entry.title).join(', ')

              return (
                <td
                  key={date}
                  className={cn(
                    'h-14 border-b border-r p-1 align-top last:border-r-0',
                    isToday && 'bg-brand-tint'
                  )}
                >
                  <span className="sr-only">
                    {formatWeekday(date)}, {formatRange(date, date)}
                    {isToday ? `, ${t('calendar.today')}` : ''}
                    {description ? `: ${description}` : ''}
                  </span>
                  <span aria-hidden="true" className="flex h-full flex-col items-center gap-1">
                    <span
                      className={cn(
                        'flex size-7 items-center justify-center rounded-full text-sm tabular-nums',
                        off && 'font-semibold text-danger',
                        isToday && 'bg-brand font-bold text-primary-foreground'
                      )}
                    >
                      {parseDate(date).getUTCDate()}
                    </span>
                    {dayEntries.length > 0 && (
                      <span className="flex gap-0.5">
                        {dayEntries.slice(0, 3).map((entry) => (
                          <span
                            key={entry.id}
                            className={cn(
                              'size-1.5 rounded-full',
                              isDayOff(entry) ? 'bg-danger' : 'bg-brand'
                            )}
                          />
                        ))}
                      </span>
                    )}
                  </span>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MonthList({ month, entries }: { month: string; entries: CalendarEntry[] }) {
  const t = useT()
  const inMonth = entries.filter((entry) => overlapsMonth(entry, month))

  if (inMonth.length === 0) {
    return <p className="mt-3 text-muted">{t('calendar.empty_month')}</p>
  }
  return <EntryList entries={inMonth} />
}

function YearList({ entries }: { entries: CalendarEntry[] }) {
  const t = useT()

  if (entries.length === 0) {
    return <p className="text-muted">{t('calendar.empty_year')}</p>
  }

  const months = [...new Set(entries.map((entry) => monthKeyOf(entry.startsOn)))]

  return (
    <div className="space-y-6">
      {months.map((monthKey) => (
        <div key={monthKey}>
          <h3 className="text-lg font-semibold">{formatMonth(monthKey)}</h3>
          <EntryList entries={entries.filter((entry) => monthKeyOf(entry.startsOn) === monthKey)} />
        </div>
      ))}
    </div>
  )
}

function EntryList({ entries }: { entries: CalendarEntry[] }) {
  return (
    <ul className="mt-3 divide-y rounded-lg border bg-surface">
      {entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} />
      ))}
    </ul>
  )
}

function EntryRow({ entry }: { entry: CalendarEntry }) {
  const t = useT()
  const kindLabel =
    entry.kind === 'exam' && entry.examType
      ? `${t('calendar.kinds.exam')} · ${t(`calendar.exam_types.${entry.examType}`)}`
      : t(`calendar.kinds.${entry.kind}`)

  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="text-sm tabular-nums text-muted sm:w-64 sm:shrink-0">
        {formatRange(entry.startsOn, entry.endsOn)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{entry.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn('size-2 rounded-full', isDayOff(entry) ? 'bg-danger' : 'bg-brand')}
            />
            <span className={isDayOff(entry) ? 'text-danger' : 'text-muted'}>{kindLabel}</span>
          </span>
          {entry.isProvisional && <span className="text-muted">({t('calendar.provisional')})</span>}
          {entry.isSchoolDay && (
            <span className="font-semibold text-ok">{t('calendar.joint_leave_school_day')}</span>
          )}
        </span>
      </span>
    </li>
  )
}

function EntryListSkeleton({ rows }: { rows: number }) {
  return (
    <ul
      className="mt-3 divide-y rounded-lg border bg-surface"
      aria-busy="true"
      data-testid="calendar-skeleton"
    >
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:gap-4">
          <Skeleton className="h-4 w-40 sm:w-64" />
          <span className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-32" />
          </span>
        </li>
      ))}
    </ul>
  )
}
