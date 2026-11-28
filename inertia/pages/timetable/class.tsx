import { useState, type ReactNode } from 'react'
import { Form, Head, Link } from '@inertiajs/react'
import AppLayout from '~/layouts/app_layout'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { Select } from '~/components/school_year/fields'
import {
  DayGroups,
  StatusLine,
  WEEKDAYS,
  minutesOf,
  rowTitle,
  type Row,
} from '~/components/timetable/parts'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

type SubjectStatus = 'complete' | 'under' | 'over' | 'no_allocation' | 'not_counted'

type Props = {
  schoolClass: { publicId: string; name: string; grade: number }
  year: { publicId: string; name: string; closed: boolean }
  rows: Row[]
  summary: {
    subjects: {
      code: string
      name: string
      religion: string | null
      teacherName: string | null
      allocated: number | null
      scheduled: number
      status: SubjectStatus
    }[]
    stale: { code: string; name: string; scheduled: number }[]
    complete: boolean
    countedTotal: number
    countedComplete: number
  }
  subjectOptions: { code: string; name: string; hasTeacher: boolean }[]
  warnings: string[]
}

const STATUS_TONE: Record<SubjectStatus, string> = {
  complete: 'bg-ok/10 text-ok',
  under: 'bg-warn/10 text-warn',
  over: 'bg-danger/10 text-danger',
  no_allocation: 'bg-brand-tint text-brand-strong',
  not_counted: 'bg-line/40 text-muted',
}

function addMinutes(value: string, minutes: number) {
  const total = (minutesOf(value) ?? 420) + minutes
  const clamped = Math.min(total, 23 * 60 + 59)
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

function suggestedJp(start: string, end: string) {
  const from = minutesOf(start)
  const to = minutesOf(end)
  if (from === null || to === null || to <= from) return null
  return Math.min(4, Math.max(1, Math.round((to - from) / 35)))
}

/** A new row starts where the day's last row ends (or at 07.00). */
function newRowDefaults(rows: Row[], weekday: number): Row {
  const last = rows.filter((row) => row.weekday === weekday).at(-1)
  const startsAt = last ? last.endsAt.slice(0, 5) : '07:00'
  return {
    publicId: null,
    weekday,
    periodNo: null,
    startsAt,
    endsAt: addMinutes(startsAt, 35),
    kind: 'lesson',
    label: null,
    subjectCode: null,
    subjectName: null,
    teacherName: null,
    jp: 1,
    locked: false,
    notTaught: false,
  }
}

/**
 * /kelas/{class}/jadwal (operator, D-247…D-251): rows per day with their
 * teacher (through the teaching assignments), JP per subject against
 * the allocation, warnings for clashes, add/change/delete rows and the
 * lock for the draft timetable (D-262).
 */
export default function ClassTimetable({
  schoolClass,
  year,
  rows,
  summary,
  subjectOptions,
  warnings,
}: Props) {
  const t = useT()
  const readOnly = year.closed
  const [editing, setEditing] = useState<string | null>(null)
  const editRow = rows.find((row) => row.publicId === editing)

  return (
    <>
      <Head title={t('timetable.class.title', { name: schoolClass.name })} />
      <div className="flex flex-wrap gap-x-4">
        <Link
          href={`/kelas/${schoolClass.publicId}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-strong"
        >
          {t('timetable.class.back', { name: schoolClass.name })}
        </Link>
        <Link
          href={`/jadwal?tahun=${year.publicId}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-strong"
        >
          {t('timetable.class.all_classes')}
        </Link>
      </div>
      <h1 className="text-2xl font-bold">
        {t('timetable.class.title', { name: schoolClass.name })}
      </h1>
      <p className="mt-1 text-muted">
        {t('timetable.class.subtitle', { grade: schoolClass.grade, year: year.name })}
      </p>
      {readOnly && <p className="mt-2 text-sm text-warn">{t('timetable.closed_note')}</p>}

      {warnings.length > 0 && (
        <Section title={t('timetable.class.warnings_title')} className="mt-6 border-warn">
          <ul className="space-y-2">
            {warnings.map((warning) => (
              <li key={warning}>
                <StatusLine tone="warn">{warning}</StatusLine>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="min-w-0 space-y-4">
          <Section
            title={t('timetable.class.days_title')}
            description={t('timetable.class.lock_hint')}
          >
            <DayGroups
              rows={rows}
              dense
              renderActions={
                readOnly
                  ? undefined
                  : (row) => (
                      <RowActions
                        row={row}
                        classId={schoolClass.publicId}
                        onEdit={() => setEditing(row.publicId)}
                      />
                    )
              }
            />
          </Section>
        </div>

        <div className="min-w-0 space-y-4 self-start">
          {!readOnly && (
            <Section
              title={editRow ? t('timetable.class.edit_title') : t('timetable.class.add_title')}
            >
              <SlotForm
                key={editRow?.publicId ?? 'new'}
                row={editRow ?? newRowDefaults(rows, 1)}
                rows={rows}
                action={
                  editRow
                    ? `/kelas/${schoolClass.publicId}/jadwal/${editRow.publicId}/ubah`
                    : `/kelas/${schoolClass.publicId}/jadwal`
                }
                subjectOptions={subjectOptions}
                editing={Boolean(editRow)}
                onDone={() => setEditing(null)}
              />
            </Section>
          )}

          <Section
            title={t('timetable.class.summary_title')}
            description={
              summary.subjects.length === 0
                ? t('timetable.class.summary_empty')
                : summary.complete
                  ? t('timetable.class.summary_complete')
                  : t('timetable.class.summary_progress', {
                      done: summary.countedComplete,
                      total: summary.countedTotal,
                    })
            }
          >
            <ul className="divide-y" data-testid="jp-summary">
              {summary.subjects.map((subject) => (
                <li key={subject.code} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{subject.name}</p>
                    <p className="text-xs text-muted">
                      {subject.allocated === null
                        ? t('timetable.class.scheduled_only', { scheduled: subject.scheduled })
                        : t('timetable.class.scheduled_of', {
                            scheduled: subject.scheduled,
                            allocated: subject.allocated,
                          })}
                      {' · '}
                      {subject.teacherName ?? t('timetable.no_teacher')}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                      STATUS_TONE[subject.status]
                    )}
                  >
                    {t(`timetable.class.statuses.${subject.status}`)}
                  </span>
                </li>
              ))}
            </ul>
            {summary.subjects.some((subject) => subject.status === 'not_counted') && (
              <p className="mt-2 text-xs text-muted">{t('timetable.class.not_counted_hint')}</p>
            )}
            {summary.stale.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-bold">{t('timetable.class.stale_title')}</h3>
                <ul className="mt-1 text-sm text-muted">
                  {summary.stale.map((subject) => (
                    <li key={subject.code}>
                      {subject.name} · {t('timetable.jp_count', { count: subject.scheduled })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  )
}

function RowActions({ row, classId, onEdit }: { row: Row; classId: string; onEdit: () => void }) {
  const t = useT()
  const title = rowTitle(t, row)
  const base = `/kelas/${classId}/jadwal/${row.publicId}`
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onEdit}
        aria-label={`${t('timetable.class.edit_action')} ${title}`}
      >
        {t('timetable.class.edit_action')}
      </Button>
      <Form action={`${base}/kunci`} method="post" options={{ preserveScroll: true }}>
        {({ processing }) => (
          <>
            <input type="hidden" name="locked" value={row.locked ? '0' : '1'} />
            <Button type="submit" variant="outline" size="sm" disabled={processing}>
              {row.locked ? t('timetable.class.unlock_action') : t('timetable.class.lock_action')}
            </Button>
          </>
        )}
      </Form>
      <Form
        action={`${base}/hapus`}
        method="post"
        options={{ preserveScroll: true }}
        onBefore={() => window.confirm(t('timetable.class.delete_confirm'))}
      >
        {({ processing }) => (
          <Button type="submit" variant="ghost" size="sm" disabled={processing}>
            {t('timetable.class.delete_action')}
          </Button>
        )}
      </Form>
    </>
  )
}

function SlotForm({
  row,
  rows,
  action,
  subjectOptions,
  editing,
  onDone,
}: {
  row: Row
  rows: Row[]
  action: string
  subjectOptions: Props['subjectOptions']
  editing: boolean
  onDone: () => void
}) {
  const t = useT()
  const [weekday, setWeekday] = useState(String(row.weekday))
  const [kind, setKind] = useState<Row['kind']>(row.kind)
  const [startsAt, setStartsAt] = useState(row.startsAt.slice(0, 5))
  const [endsAt, setEndsAt] = useState(row.endsAt.slice(0, 5))
  const [jp, setJp] = useState(String(row.jp || 1))
  const suggestion = suggestedJp(startsAt, endsAt)

  function changeDay(value: string) {
    setWeekday(value)
    if (!editing) {
      const next = newRowDefaults(rows, Number(value))
      setStartsAt(next.startsAt)
      setEndsAt(next.endsAt)
    }
  }

  function changeEnd(value: string) {
    setEndsAt(value)
    const next = suggestedJp(startsAt, value)
    if (next !== null) setJp(String(next))
  }

  return (
    <Form
      action={action}
      method="post"
      options={{ preserveScroll: true, preserveState: true }}
      onSuccess={onDone}
      className="space-y-4"
    >
      {({ errors, processing }) => (
        <>
          <Select
            label={t('timetable.fields.weekday')}
            name="weekday"
            value={weekday}
            onChange={changeDay}
            options={WEEKDAYS.map((day) => ({
              value: String(day),
              label: t(`timetable.weekdays.${day}`),
            }))}
            error={errors.weekday}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t('timetable.fields.starts_at')}
              name="starts_at"
              type="time"
              required
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              error={errors.starts_at}
            />
            <TextField
              label={t('timetable.fields.ends_at')}
              name="ends_at"
              type="time"
              required
              value={endsAt}
              onChange={(event) => changeEnd(event.target.value)}
              error={errors.ends_at}
            />
          </div>
          <Select
            label={t('timetable.fields.kind')}
            name="kind"
            value={kind}
            onChange={(value) => setKind(value as Row['kind'])}
            options={(['lesson', 'break', 'ceremony', 'activity'] as const).map((value) => ({
              value,
              label: t(`timetable.kinds.${value}`),
            }))}
            error={errors.kind}
          />
          {kind === 'lesson' ? (
            <>
              <Select
                label={t('timetable.fields.subject')}
                name="subject"
                defaultValue={row.subjectCode ?? ''}
                options={[
                  { value: '', label: t('timetable.class.subject_pick') },
                  ...subjectOptions.map((subject) => ({
                    value: subject.code,
                    label: subject.hasTeacher
                      ? subject.name
                      : t('timetable.class.subject_no_teacher', { name: subject.name }),
                  })),
                ]}
                error={errors.subject}
              />
              <TextField
                label={t('timetable.fields.jp')}
                name="jp"
                type="number"
                min={1}
                max={4}
                required
                value={jp}
                onChange={(event) => setJp(event.target.value)}
                error={errors.jp}
                hint={
                  suggestion === null
                    ? undefined
                    : t('timetable.class.jp_hint', { count: suggestion })
                }
              />
            </>
          ) : (
            <TextField
              label={t('timetable.fields.label')}
              name="label"
              maxLength={40}
              autoComplete="off"
              defaultValue={row.label ?? ''}
              error={errors.label}
              hint={t('timetable.class.label_hint')}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={processing}>
              {processing
                ? t('common.status.saving')
                : editing
                  ? t('timetable.class.save_action')
                  : t('timetable.class.add_action')}
            </Button>
            {editing && (
              <Button type="button" variant="outline" onClick={onDone}>
                {t('timetable.class.cancel_action')}
              </Button>
            )}
          </div>
        </>
      )}
    </Form>
  )
}

ClassTimetable.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>
