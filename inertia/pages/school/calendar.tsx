import { useState, type ReactNode } from 'react'
import { Deferred, Form, Head, Link, usePage } from '@inertiajs/react'
import AppLayout from '~/layouts/app_layout'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { Icon } from '~/components/icon'
import { TextField } from '~/components/text_field'
import { SourceBadge } from '~/components/layers/source_badge'
import { useSourceLabel, type LayerOwner, type LayerSource } from '~/components/layers/source'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'
import {
  addMonths,
  formatDate,
  formatMonth,
  formatRange,
  formatWeekday,
  monthGrid,
  monthKeyOf,
  parseDate,
  weekdayNames,
} from '~/lib/dates'

type Kind =
  | 'holiday'
  | 'exam'
  | 'school_event'
  | 'no_lessons'
  | 'national_holiday'
  | 'joint_leave'
  | 'note'
  | 'setting'

type Entry = {
  key: string
  title: string
  kind: Kind
  examType: 'sts' | 'sas' | 'other' | null
  startsOn: string
  endsOn: string
  class: { id: string; name: string } | null
  own: boolean
  provisional: boolean
  source: LayerSource
}

type HiddenEntry = Entry & { hiddenBy: LayerOwner & { reason: string | null; own: boolean } }

type Totals = {
  schoolDays: number
  holidays: number
  assessments: number
  activities: number
  effectiveDays: number
  effectiveWeeks: number
}

type Effective = {
  daysPerWeek: number
  rows: (Totals & { month: string; semester: 1 | 2 })[]
  semesters: [Totals, Totals]
  total: Totals
}

type Frame = {
  startsOn: string
  evenSemesterStartsOn: string
  endsOn: string
  schoolDaysPerWeek: number
  from: 'layer' | 'academic_year' | 'default'
  source: LayerSource | null
  academicYearDiffers: boolean
  ready: boolean
}

type ChangedItem = { title: string; startsOn: string | null; endsOn: string | null }
type Changes = {
  area: { added: ChangedItem[]; changed: ChangedItem[]; removed: ChangedItem[] }
  days: {
    nowOff: { date: string; title: string }[]
    nowSchoolDays: { date: string; title: string }[]
  }
  effectiveDays: { before: number; after: number }
} | null

type ClassOption = { id: string; name: string; grade: number }

type Props = {
  school: { name: string } | null
  year: { id: string | null; name: string; startsOn: string; endsOn: string } | null
  years: { id: string; name: string }[]
  classes: ClassOption[]
  selectedClass: string | null
  canEdit: boolean
  canPropose: boolean
  today: string
  /** Deferred: loaded right after the first render. */
  entries?: Entry[]
  hidden?: HiddenEntry[]
  frame?: Frame | null
  effective?: Effective | null
  changes?: Changes
}

type View = 'month' | 'list' | 'unused' | 'effective'

const EVENT_KINDS = ['school_event', 'holiday', 'exam', 'no_lessons'] as const

const fieldClass =
  'block h-11 w-full rounded-md border bg-surface px-3 text-base outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30'

/** A day without lessons for the whole school (or for the entry's class). */
function isDayOff(entry: Entry) {
  return (
    entry.kind === 'holiday' || entry.kind === 'national_holiday' || entry.kind === 'joint_leave'
  )
}

function covers(entry: Entry, date: string) {
  return entry.startsOn <= date && date <= entry.endsOn
}

function overlapsMonth(entry: Entry, monthKey: string) {
  return monthKeyOf(entry.startsOn) <= monthKey && monthKey <= monthKeyOf(entry.endsOn)
}

function clampMonth(monthKey: string, first: string, last: string) {
  if (monthKey < first) return first
  if (monthKey > last) return last
  return monthKey
}

export default function CalendarPage(props: Props) {
  const { school, year, today, entries } = props
  const t = useT()
  const [view, setView] = useState<View>('month')

  const firstMonth = year ? monthKeyOf(year.startsOn) : monthKeyOf(today)
  const lastMonth = year ? monthKeyOf(year.endsOn) : monthKeyOf(today)
  const [month, setMonth] = useState(() => clampMonth(monthKeyOf(today), firstMonth, lastMonth))

  return (
    <>
      <Head title={t('calendar.title')} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-3xl">{t('calendar.title')}</h1>
          {school && year && (
            <p className="mt-1 text-muted">
              {school.name} · {t('calendar.year', { name: year.name })}
            </p>
          )}
        </div>
        {props.years.length > 1 && (
          <nav aria-label={t('calendar.years_label')} className="flex flex-wrap gap-2">
            {props.years.map((option) => (
              <Link
                key={option.id}
                href={`/kalender?tahun=${option.id}`}
                aria-current={option.id === year?.id ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold',
                  option.id === year?.id
                    ? 'border-brand bg-brand-tint text-brand-strong'
                    : 'bg-surface text-muted'
                )}
              >
                {option.name}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {!school && <EmptyState>{t('common.empty.no_role')}</EmptyState>}

      {school && year && (
        <>
          {!year.id && props.canEdit && (
            <p className="mt-4 rounded-md border border-warn/40 bg-warn/10 p-4">
              {t('calendar.no_year', { name: year.name })}
            </p>
          )}

          <Deferred
            data={['changes', 'frame']}
            fallback={<Skeleton className="mt-4 h-14 w-full rounded-xl" />}
          >
            <>
              <ChangesNotice {...props} />
              <FrameCard {...props} />
            </>
          </Deferred>

          <div
            role="tablist"
            aria-label={t('calendar.views.label')}
            className="mt-6 flex gap-2 overflow-x-auto pb-1"
          >
            {(['month', 'list', 'unused', 'effective'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                onClick={() => setView(option)}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap',
                  view === option
                    ? 'border-brand bg-brand-tint text-brand-strong'
                    : 'bg-surface text-muted'
                )}
              >
                {option === 'month' && <Icon name="grid" />}
                {option === 'list' && <Icon name="list" />}
                {t(`calendar.views.${option}`)}
                {option === 'unused' && props.hidden && (
                  <span className="rounded-full bg-surface px-2 text-xs text-text">
                    {props.hidden.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {view === 'month' && (
              <MonthView
                {...props}
                month={month}
                canGoBack={month > firstMonth}
                canGoForward={month < lastMonth}
                onMonthChange={(delta) =>
                  setMonth((current) =>
                    clampMonth(addMonths(current, delta), firstMonth, lastMonth)
                  )
                }
                onThisMonth={() => setMonth(clampMonth(monthKeyOf(today), firstMonth, lastMonth))}
              />
            )}
            {view === 'list' && (
              <section className="mt-4" aria-label={t('calendar.views.list')}>
                <Deferred data="entries" fallback={<EntryListSkeleton rows={8} />}>
                  <YearList {...props} entries={entries ?? []} />
                </Deferred>
              </section>
            )}
            {view === 'unused' && (
              <section className="mt-4" aria-label={t('calendar.views.unused')}>
                <Deferred data="hidden" fallback={<EntryListSkeleton rows={3} />}>
                  <HiddenList {...props} />
                </Deferred>
              </section>
            )}
            {view === 'effective' && (
              <Deferred data="effective" fallback={<EntryListSkeleton rows={6} />}>
                <EffectiveTable {...props} />
              </Deferred>
            )}
          </div>

          {(view === 'month' || view === 'list') && (props.canEdit || props.canPropose) && (
            <section
              className="mt-8 rounded-xl border bg-surface p-4 sm:p-6"
              aria-labelledby="event-form-title"
            >
              <h2 id="event-form-title" className="text-lg font-bold">
                {t(props.canEdit ? 'calendar.form.title_add' : 'calendar.form.title_propose')}
              </h2>
              {!props.canEdit && (
                <p className="mt-1 text-sm text-muted">{t('calendar.form.intro_propose')}</p>
              )}
              <EventForm {...props} mode={props.canEdit ? 'add' : 'propose'} />
            </section>
          )}
        </>
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

function ChangesNotice({ changes, year }: Props) {
  const t = useT()
  const { role } = usePage().props
  if (!changes) return null
  const range = (item: ChangedItem) =>
    item.startsOn ? formatRange(item.startsOn, item.endsOn ?? item.startsOn) : ''
  const leader = role === 'operator' || role === 'principal'
  const areaLines = [
    ...changes.area.added.map((item) =>
      t('calendar.changes.added', { title: item.title, date: range(item) })
    ),
    ...changes.area.changed.map((item) =>
      t('calendar.changes.changed', { title: item.title, date: range(item) })
    ),
    ...changes.area.removed.map((item) =>
      t('calendar.changes.removed', { title: item.title, date: range(item) })
    ),
  ]
  const dayLines = [
    ...changes.days.nowOff.map((day) =>
      t('calendar.changes.now_off', { date: formatDate(day.date), title: day.title })
    ),
    ...changes.days.nowSchoolDays.map((day) =>
      t('calendar.changes.now_school_day', { date: formatDate(day.date) })
    ),
  ]
  const lines = leader ? areaLines : dayLines
  if (lines.length === 0) return null
  return (
    <section
      aria-labelledby="calendar-changes-title"
      className="mt-4 rounded-xl border border-warn/40 bg-warn/10 p-4"
    >
      <h2 id="calendar-changes-title" className="flex items-center gap-2 font-bold">
        <Icon name="warning" />
        {t(leader ? 'calendar.changes.operator_title' : 'calendar.changes.teacher_title')}
      </h2>
      <p className="mt-1 text-sm">
        {t(leader ? 'calendar.changes.operator_intro' : 'calendar.changes.teacher_intro')}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {lines.slice(0, 12).map((line, index) => (
          <li key={index} className="break-words">
            {line}
          </li>
        ))}
      </ul>
      {leader && changes.effectiveDays.before !== changes.effectiveDays.after && (
        <p className="mt-2 text-sm font-semibold">
          {t('calendar.changes.effective', {
            before: changes.effectiveDays.before,
            after: changes.effectiveDays.after,
          })}
        </p>
      )}
      <Form
        action="/kalender/perubahan/dibaca"
        method="post"
        options={{ preserveScroll: true }}
        className="mt-3"
      >
        {({ processing }) => (
          <>
            {year?.id && <input type="hidden" name="year" value={year.id} />}
            <Button
              type="submit"
              variant="outline"
              disabled={processing}
              className="w-full sm:w-auto"
            >
              {t('calendar.changes.mark_read')}
            </Button>
          </>
        )}
      </Form>
    </section>
  )
}

function FrameCard({ frame, canEdit }: Props) {
  const t = useT()
  if (!frame) return null
  return (
    <>
      {!frame.ready && (
        <p className="mt-4 rounded-md border border-warn/40 bg-warn/10 p-4">
          {t('calendar.not_ready')}
        </p>
      )}
      <section
        aria-labelledby="calendar-frame-title"
        className="mt-4 rounded-xl border bg-surface p-4"
      >
        <h2 id="calendar-frame-title" className="sr-only">
          {t('calendar.frame.title')}
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="font-semibold">
            {t('calendar.frame.dates', {
              start: formatDate(frame.startsOn),
              end: formatDate(frame.endsOn),
            })}
          </span>
          <span className="text-muted">
            {t('calendar.frame.even_semester', { date: formatDate(frame.evenSemesterStartsOn) })}
          </span>
          <span className="text-muted">
            {t('calendar.frame.days_per_week', { days: frame.schoolDaysPerWeek })}
          </span>
          {frame.source ? (
            <SourceBadge source={frame.source} />
          ) : (
            <span className="text-muted">
              {t(
                frame.from === 'academic_year'
                  ? 'calendar.frame.from_academic_year'
                  : 'calendar.frame.from_default'
              )}
            </span>
          )}
        </div>
        {canEdit && frame.academicYearDiffers && (
          <p className="mt-2 text-sm text-warn">{t('calendar.frame.differs')}</p>
        )}
      </section>
    </>
  )
}

function MonthView(
  props: Props & {
    month: string
    canGoBack: boolean
    canGoForward: boolean
    onMonthChange: (delta: number) => void
    onThisMonth: () => void
  }
) {
  const { month, today, entries } = props
  const t = useT()
  const label = formatMonth(month)

  return (
    <section className="mt-4" aria-labelledby="calendar-month-title">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => props.onMonthChange(-1)}
          disabled={!props.canGoBack}
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
          onClick={() => props.onMonthChange(1)}
          disabled={!props.canGoForward}
          aria-label={t('calendar.month_nav.next')}
        >
          <Icon name="chevron-right" />
        </Button>
        <Button variant="ghost" onClick={props.onThisMonth} className="hidden sm:inline-flex">
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
        <MonthList {...props} />
      </Deferred>
    </section>
  )
}

/**
 * The grid needs no data: the days render at once and the markers fill
 * in when the deferred entries arrive, so nothing shifts.
 */
function MonthGrid({ month, today, entries }: { month: string; today: string; entries?: Entry[] }) {
  const t = useT()
  const days = monthGrid(month)
  const names = weekdayNames()
  const wholeSchool = entries?.filter((entry) => entry.class === null) ?? []

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
        {Array.from({ length: days.length / 7 }, (_, week) => (
          <tr key={week}>
            {days.slice(week * 7, week * 7 + 7).map((date, index) => {
              if (!date) {
                return (
                  <td
                    key={`empty-${week}-${index}`}
                    className="h-14 border-r border-b bg-page/60 last:border-r-0"
                  />
                )
              }
              const dayEntries = wholeSchool.filter((entry) => covers(entry, date))
              const off = index === 6 || dayEntries.some(isDayOff)
              const isToday = date === today
              const description = dayEntries.map((entry) => entry.title).join(', ')

              return (
                <td
                  key={date}
                  className={cn(
                    'h-14 border-r border-b p-1 align-top last:border-r-0',
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
                            key={entry.key}
                            className={cn(
                              'size-1.5 rounded-full',
                              isDayOff(entry)
                                ? 'bg-danger'
                                : entry.kind === 'note'
                                  ? 'bg-muted'
                                  : 'bg-brand'
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

function MonthList(props: Props & { month: string }) {
  const t = useT()
  const inMonth = (props.entries ?? []).filter((entry) => overlapsMonth(entry, props.month))
  if (inMonth.length === 0) return <p className="mt-3 text-muted">{t('calendar.empty_month')}</p>
  return <EntryList {...props} entries={inMonth} />
}

function YearList(props: Props & { entries: Entry[] }) {
  const t = useT()
  if (props.entries.length === 0) return <p className="text-muted">{t('calendar.empty_year')}</p>
  const months = [...new Set(props.entries.map((entry) => monthKeyOf(entry.startsOn)))]
  return (
    <div className="space-y-6">
      {months.map((monthKey) => (
        <div key={monthKey}>
          <h3 className="text-lg font-semibold">{formatMonth(monthKey)}</h3>
          <EntryList
            {...props}
            entries={props.entries.filter((entry) => monthKeyOf(entry.startsOn) === monthKey)}
          />
        </div>
      ))}
    </div>
  )
}

function EntryList(props: Props & { entries: Entry[] }) {
  return (
    <ul className="mt-3 divide-y rounded-lg border bg-surface">
      {props.entries.map((entry) => (
        <EntryRow key={entry.key} {...props} entry={entry} />
      ))}
    </ul>
  )
}

function KindLabel({ entry }: { entry: Entry }) {
  const t = useT()
  const label =
    entry.kind === 'exam' && entry.examType
      ? `${t('calendar.kinds.exam')} · ${t(`calendar.exam_types.${entry.examType}`)}`
      : t(`calendar.kinds.${entry.kind}`)
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn(
          'size-2 rounded-full',
          isDayOff(entry) ? 'bg-danger' : entry.kind === 'note' ? 'bg-muted' : 'bg-brand'
        )}
      />
      <span className={isDayOff(entry) ? 'text-danger' : 'text-muted'}>{label}</span>
    </span>
  )
}

function EntryRow(props: Props & { entry: Entry; hiddenBy?: HiddenEntry['hiddenBy'] }) {
  const { entry, hiddenBy } = props
  const t = useT()
  const sourceLabel = useSourceLabel()

  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="text-sm text-muted tabular-nums sm:w-56 sm:shrink-0">
        {formatRange(entry.startsOn, entry.endsOn)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium break-words">{entry.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <KindLabel entry={entry} />
          {entry.class && (
            <span className="rounded-full border px-2 text-xs font-semibold">
              {t('calendar.class_event', { name: entry.class.name })}
            </span>
          )}
          {entry.provisional && <span className="text-muted">({t('calendar.provisional')})</span>}
          {entry.kind === 'note' && <span className="text-muted">({t('calendar.note')})</span>}
          <SourceBadge source={entry.source} />
        </span>
        {hiddenBy && (
          <span className="mt-1 block text-sm">
            <span className="font-semibold text-ok">
              {entry.kind === 'joint_leave'
                ? t('calendar.joint_leave_school_day')
                : t('calendar.views.unused')}
            </span>
            {' · '}
            {t('layers.list.hidden_by', { source: sourceLabel(hiddenBy) })}
            {hiddenBy.reason && (
              <> · {t('layers.list.hidden_reason', { reason: hiddenBy.reason })}</>
            )}
          </span>
        )}
        {!hiddenBy && entry.source.force === 'mandatory' && entry.source.layer !== 'school' && (
          <span className="mt-1 block text-xs text-muted">{t('calendar.list.mandatory_note')}</span>
        )}
        <EntryActions {...props} />
      </span>
    </li>
  )
}

/** What the viewer may do with one entry: operator changes, others propose (D-380). */
function EntryActions(props: Props & { entry: Entry; hiddenBy?: HiddenEntry['hiddenBy'] }) {
  const { entry, hiddenBy, canEdit, canPropose, year } = props
  const t = useT()
  const yearField = year?.id ? <input type="hidden" name="year" value={year.id} /> : null
  const mandatory = entry.source.force === 'mandatory'

  if (hiddenBy) {
    if (!hiddenBy.own) {
      return null
    }
    if (canEdit) {
      return (
        <SimpleAction
          action={`/kalender/${entry.key}/pakai-lagi`}
          label={t('calendar.list.unhide')}
          yearField={yearField}
        />
      )
    }
    if (canPropose) {
      return (
        <ProposeAction
          entry={entry}
          action="unhide"
          label={t('calendar.list.propose_unhide')}
          yearField={yearField}
        />
      )
    }
    return null
  }

  if (entry.own) {
    if (canEdit) {
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          <details className="w-full text-sm">
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-strong">
              {t('calendar.list.edit')}
            </summary>
            <EventForm {...props} mode="edit" entry={entry} />
          </details>
          <Form
            action={`/kalender/acara/${entry.key}/hapus`}
            method="post"
            options={{ preserveScroll: true }}
            onBefore={() => window.confirm(t('calendar.list.delete_confirm'))}
          >
            {({ processing }) => (
              <>
                {yearField}
                <Button type="submit" variant="outline" disabled={processing}>
                  {t('calendar.list.delete')}
                </Button>
              </>
            )}
          </Form>
        </div>
      )
    }
    if (canPropose) {
      return (
        <div className="mt-2 flex flex-col gap-1">
          <details className="text-sm">
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-strong">
              {t('calendar.list.propose_change')}
            </summary>
            <EventForm {...props} mode="propose_change" entry={entry} />
          </details>
          <ProposeAction
            entry={entry}
            action="retire"
            label={t('calendar.list.propose_delete')}
            yearField={yearField}
          />
        </div>
      )
    }
    return null
  }

  if (mandatory || entry.kind === 'note' || entry.class) return null
  const hideLabel =
    entry.kind === 'joint_leave' ? t('calendar.list.hide') : t('calendar.list.hide_other')
  if (canEdit) {
    return (
      <details className="mt-1 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-strong">
          {hideLabel}
        </summary>
        <Form
          action={`/kalender/${entry.key}/tidak-dipakai`}
          method="post"
          options={{ preserveScroll: true }}
          className="mt-2 flex flex-col gap-2"
        >
          {({ processing }) => (
            <>
              {yearField}
              <label className="space-y-1.5">
                <span className="block font-semibold">{t('calendar.list.hide_reason')}</span>
                <input name="reason" maxLength={300} className={fieldClass} />
              </label>
              <Button
                type="submit"
                disabled={processing}
                className="w-full sm:w-auto sm:self-start"
              >
                {t('calendar.list.hide_confirm')}
              </Button>
            </>
          )}
        </Form>
      </details>
    )
  }
  if (canPropose) {
    return (
      <ProposeAction
        entry={entry}
        action="hide"
        label={t('calendar.list.propose_hide')}
        yearField={yearField}
      />
    )
  }
  return null
}

function SimpleAction({
  action,
  label,
  yearField,
}: {
  action: string
  label: string
  yearField: ReactNode
}) {
  return (
    <Form action={action} method="post" options={{ preserveScroll: true }} className="mt-2">
      {({ processing }) => (
        <>
          {yearField}
          <Button
            type="submit"
            variant="outline"
            disabled={processing}
            className="w-full sm:w-auto"
          >
            {label}
          </Button>
        </>
      )}
    </Form>
  )
}

function ProposeAction({
  entry,
  action,
  label,
  yearField,
}: {
  entry: Entry
  action: 'hide' | 'unhide' | 'retire'
  label: string
  yearField: ReactNode
}) {
  const t = useT()
  return (
    <details className="mt-1 text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-strong">
        {label}
      </summary>
      <Form
        action="/kalender/usulan"
        method="post"
        options={{ preserveScroll: true }}
        className="mt-2 flex flex-col gap-2"
      >
        {({ processing }) => (
          <>
            {yearField}
            <input type="hidden" name="action" value={action} />
            <input type="hidden" name="item_key" value={entry.key} />
            <label className="space-y-1.5">
              <span className="block font-semibold">{t('calendar.list.propose_reason')}</span>
              <input name="reason" maxLength={500} className={fieldClass} />
            </label>
            <Button type="submit" disabled={processing} className="w-full sm:w-auto sm:self-start">
              {t('calendar.list.send_proposal')}
            </Button>
          </>
        )}
      </Form>
    </details>
  )
}

function EventForm(
  props: Props & { mode: 'add' | 'edit' | 'propose' | 'propose_change'; entry?: Entry }
) {
  const { mode, entry, classes, year } = props
  const t = useT()
  const [kind, setKind] = useState<string>(entry?.kind ?? 'school_event')
  const action =
    mode === 'add'
      ? '/kalender/acara'
      : mode === 'edit'
        ? `/kalender/acara/${entry!.key}/ubah`
        : '/kalender/usulan'
  const submit =
    mode === 'add'
      ? 'calendar.form.submit_add'
      : mode === 'edit'
        ? 'calendar.form.submit_edit'
        : 'calendar.form.submit_propose'

  return (
    <Form
      action={action}
      method="post"
      options={{ preserveScroll: true }}
      resetOnSuccess={mode === 'add' || mode === 'propose'}
      className="mt-4 grid gap-4 sm:grid-cols-2"
    >
      {({ processing, errors }) => (
        <>
          {year?.id && <input type="hidden" name="year" value={year.id} />}
          {mode === 'propose' && <input type="hidden" name="action" value="add" />}
          {mode === 'propose_change' && (
            <>
              <input type="hidden" name="action" value="revise" />
              <input type="hidden" name="item_key" value={entry!.key} />
            </>
          )}
          <div className="sm:col-span-2">
            <TextField
              name="title"
              label={t('calendar.form.event_title')}
              required
              minLength={3}
              maxLength={150}
              defaultValue={entry?.title}
              error={errors.title}
            />
          </div>
          <label className="space-y-1.5">
            <span className="block text-sm font-semibold">{t('calendar.form.kind')}</span>
            <select
              name="kind"
              className={fieldClass}
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              {EVENT_KINDS.map((option) => (
                <option key={option} value={option}>
                  {t(`calendar.kinds.${option}`)}
                </option>
              ))}
            </select>
          </label>
          {kind === 'exam' ? (
            <label className="space-y-1.5">
              <span className="block text-sm font-semibold">{t('calendar.form.exam_type')}</span>
              <select
                name="exam_type"
                className={fieldClass}
                defaultValue={entry?.examType ?? 'sts'}
              >
                {(['sts', 'sas', 'other'] as const).map((option) => (
                  <option key={option} value={option}>
                    {t(`calendar.exam_types.${option}`)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="hidden sm:block" />
          )}
          <TextField
            type="date"
            name="starts_on"
            label={t('calendar.form.starts_on')}
            required
            defaultValue={entry?.startsOn}
            min={year?.startsOn}
            max={year?.endsOn}
            error={errors.starts_on}
          />
          <TextField
            type="date"
            name="ends_on"
            label={t('calendar.form.ends_on')}
            defaultValue={entry && entry.endsOn !== entry.startsOn ? entry.endsOn : undefined}
            min={year?.startsOn}
            max={year?.endsOn}
            error={errors.ends_on}
          />
          {classes.length > 0 && (
            <label className="space-y-1.5 sm:col-span-2">
              <span className="block text-sm font-semibold">{t('calendar.form.class')}</span>
              <select name="class" className={fieldClass} defaultValue={entry?.class?.id ?? ''}>
                <option value="">{t('calendar.form.class_all')}</option>
                {classes.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(mode === 'propose' || mode === 'propose_change') && (
            <div className="sm:col-span-2">
              <TextField name="reason" label={t('calendar.list.propose_reason')} maxLength={500} />
            </div>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={processing} className="w-full sm:w-auto">
              {t(submit)}
            </Button>
          </div>
        </>
      )}
    </Form>
  )
}

function HiddenList(props: Props) {
  const t = useT()
  const hidden = props.hidden ?? []
  if (hidden.length === 0)
    return (
      <p className="rounded-md border bg-surface p-4 text-muted">{t('calendar.empty_hidden')}</p>
    )
  return (
    <ul className="divide-y rounded-lg border bg-surface">
      {hidden.map((entry) => (
        <EntryRow key={entry.key} {...props} entry={entry} hiddenBy={entry.hiddenBy} />
      ))}
    </ul>
  )
}

const COLUMNS = [
  'school_days',
  'holidays',
  'assessments',
  'activities',
  'effective_days',
  'effective_weeks',
] as const

function cells(totals: Totals) {
  return [
    totals.schoolDays,
    totals.holidays,
    totals.assessments,
    totals.activities,
    totals.effectiveDays,
    totals.effectiveWeeks.toLocaleString('id-ID', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  ]
}

function EffectiveTable({ effective, classes, selectedClass, year }: Props) {
  const t = useT()
  if (!effective) return null
  const base = year?.id ? `/kalender?tahun=${year.id}` : '/kalender'
  const join = base.includes('?') ? '&' : '?'

  return (
    <section className="mt-4" aria-labelledby="effective-title">
      <h2 id="effective-title" className="text-xl font-semibold">
        {t('calendar.effective.title')}
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">{t('calendar.effective.intro')}</p>

      {classes.length > 0 && (
        <nav aria-label={t('calendar.effective.for')} className="mt-3 flex flex-wrap gap-2">
          {[{ id: null, name: t('calendar.whole_school') }, ...classes].map((option) => (
            <Link
              key={option.id ?? 'all'}
              href={option.id ? `${base}${join}kelas=${option.id}` : base}
              preserveScroll
              only={['effective', 'selectedClass']}
              aria-current={option.id === selectedClass ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold',
                option.id === selectedClass
                  ? 'border-brand bg-brand-tint text-brand-strong'
                  : 'bg-surface text-muted'
              )}
            >
              {option.name}
            </Link>
          ))}
        </nav>
      )}

      {/* Phones: one card per month. */}
      <div className="mt-4 space-y-3 sm:hidden">
        {[1, 2].map((semester) => (
          <div key={semester} className="space-y-2">
            <h3 className="font-semibold">
              {t('calendar.effective.semester', { number: semester })}
            </h3>
            {effective.rows
              .filter((row) => row.semester === semester)
              .map((row) => (
                <MonthCard
                  key={`${row.semester}-${row.month}`}
                  title={formatMonth(row.month)}
                  totals={row}
                />
              ))}
            <MonthCard
              title={t('calendar.effective.semester_total', { number: semester })}
              totals={effective.semesters[semester - 1]}
              strong
            />
          </div>
        ))}
        <MonthCard title={t('calendar.effective.year_total')} totals={effective.total} strong />
      </div>

      {/* Larger screens: the D-259 table. */}
      <div className="mt-4 hidden overflow-hidden rounded-lg border bg-surface sm:block">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-page">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                {t('calendar.effective.month')}
              </th>
              {COLUMNS.map((column) => (
                <th key={column} scope="col" className="px-3 py-2 text-right font-semibold">
                  {t(`calendar.effective.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          {[1, 2].map((semester) => (
            <tbody key={semester} className="border-t">
              {effective.rows
                .filter((row) => row.semester === semester)
                .map((row) => (
                  <tr key={`${row.semester}-${row.month}`} className="border-t">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      {formatMonth(row.month)}
                    </th>
                    {cells(row).map((value, index) => (
                      <td key={index} className="px-3 py-2 text-right">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              <tr className="border-t bg-brand-tint/50 font-semibold">
                <th scope="row" className="px-3 py-2 text-left">
                  {t('calendar.effective.semester_total', { number: semester })}
                </th>
                {cells(effective.semesters[semester - 1]).map((value, index) => (
                  <td key={index} className="px-3 py-2 text-right">
                    {value}
                  </td>
                ))}
              </tr>
            </tbody>
          ))}
          <tfoot className="border-t-2 font-bold">
            <tr>
              <th scope="row" className="px-3 py-2 text-left">
                {t('calendar.effective.year_total')}
              </th>
              {cells(effective.total).map((value, index) => (
                <td key={index} className="px-3 py-2 text-right">
                  {value}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-sm text-muted">
        {t('calendar.effective.days_per_week', { days: effective.daysPerWeek })}
      </p>
    </section>
  )
}

function MonthCard({ title, totals, strong }: { title: string; totals: Totals; strong?: boolean }) {
  const t = useT()
  const values = cells(totals)
  return (
    <div
      className={cn(
        'rounded-lg border bg-surface p-3',
        strong && 'border-brand/40 bg-brand-tint/40'
      )}
    >
      <p className={cn('font-semibold', strong && 'text-brand-strong')}>{title}</p>
      <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums">
        {COLUMNS.map((column, index) => (
          <div key={column} className="flex justify-between gap-2">
            <dt className="text-muted">{t(`calendar.effective.${column}`)}</dt>
            <dd className={cn(column === 'effective_days' && 'font-bold')}>{values[index]}</dd>
          </div>
        ))}
      </dl>
    </div>
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
          <Skeleton className="h-4 w-40 sm:w-56" />
          <span className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-32" />
          </span>
        </li>
      ))}
    </ul>
  )
}
