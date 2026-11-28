import { useState, type ReactNode } from 'react'
import { Form, Head, Link } from '@inertiajs/react'
import AppLayout from '~/layouts/app_layout'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { Checkbox, Select } from '~/components/school_year/fields'
import { StatusLine, WEEKDAYS, YearChips, type YearChoice } from '~/components/timetable/parts'
import { formatDateTime } from '~/lib/format'
import { useT } from '~/lib/i18n'

type PreferenceKey = 'maxConsecutive' | 'pjokMorning' | 'coreEarly' | 'spreadWeek' | 'noSplitBreak'

type FrameDay = {
  weekday: number
  startsAt: string
  lessons: number
  opening: { kind: 'ceremony' | 'activity'; label: string | null; minutes: number } | null
}

type DraftSummary = {
  publicId: string
  status: 'queued' | 'running' | 'ready' | 'failed' | 'saved'
  createdAt: string | null
  classNames: string[]
  unplacedJp: number | null
}

type Props = {
  years: YearChoice[]
  year: { publicId: string; name: string; closed: boolean } | null
  frame: { days: FrameDay[]; breaks: { afterLesson: number; minutes: number }[] }
  preferences: Record<PreferenceKey, boolean>
  settingsSaved: boolean
  classes: { publicId: string; name: string }[]
  drafts: DraftSummary[]
}

/** Form field names of the switches. */
const PREFERENCE_FIELDS: Record<PreferenceKey, string> = {
  maxConsecutive: 'max_consecutive',
  pjokMorning: 'pjok_morning',
  coreEarly: 'core_early',
  spreadWeek: 'spread_week',
  noSplitBreak: 'no_split_break',
}

/**
 * /jadwal/susun-draf (operator, D-262): the day frame (start time, JP
 * per day, opening row, breaks), the five switches, a draft for one
 * class or all classes, and the latest drafts.
 */
export default function ComposeTimetable({
  years,
  year,
  frame,
  preferences,
  settingsSaved,
  classes,
  drafts,
}: Props) {
  const t = useT()
  return (
    <>
      <Head title={t('timetable.compose.title')} />
      <Link
        href={year ? `/jadwal?tahun=${year.publicId}` : '/jadwal'}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-strong"
      >
        {t('timetable.compose.back')}
      </Link>
      <h1 className="text-2xl font-bold">{t('timetable.compose.title')}</h1>
      <p className="mt-2 max-w-3xl text-muted">{t('timetable.compose.intro')}</p>
      {year && (
        <YearChips
          years={years}
          current={year.publicId}
          basePath="/jadwal/susun-draf"
          label={t('timetable.index.year_label')}
        />
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <SettingsForm frame={frame} preferences={preferences} saved={settingsSaved} />

        <div className="min-w-0 space-y-4 self-start">
          <Section title={t('timetable.compose.generate_title')}>
            {year === null ? (
              <p className="text-muted">{t('timetable.no_year')}</p>
            ) : year.closed ? (
              <p className="text-sm text-warn">{t('timetable.closed_note')}</p>
            ) : classes.length === 0 ? (
              <p className="text-muted">{t('timetable.compose.no_classes')}</p>
            ) : (
              <Form action="/jadwal/susun-draf" method="post" className="space-y-4">
                {({ errors, processing }) => (
                  <>
                    <input type="hidden" name="year" value={year.publicId} />
                    <Select
                      label={t('timetable.compose.target_label')}
                      name="target"
                      defaultValue="all"
                      options={[
                        {
                          value: 'all',
                          label: t('timetable.compose.target_all', { count: classes.length }),
                        },
                        ...classes.map((row) => ({ value: row.publicId, label: row.name })),
                      ]}
                      error={errors.target}
                      hint={t('timetable.compose.generate_hint')}
                    />
                    <Button type="submit" disabled={processing}>
                      {t('timetable.compose.generate_action')}
                    </Button>
                  </>
                )}
              </Form>
            )}
          </Section>

          <Section title={t('timetable.compose.drafts_title')}>
            {drafts.length === 0 ? (
              <p className="text-muted">{t('timetable.compose.drafts_empty')}</p>
            ) : (
              <ul className="divide-y">
                {drafts.map((draft) => (
                  <li key={draft.publicId} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{draft.classNames.join(', ')}</p>
                      <p className="text-xs text-muted">
                        {t(`timetable.draft.statuses.${draft.status}`)}
                        {draft.createdAt ? ` · ${formatDateTime(draft.createdAt)}` : ''}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/jadwal/draf/${draft.publicId}`}>
                        {t('timetable.compose.open_draft_action')}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  )
}

function SettingsForm({
  frame,
  preferences,
  saved,
}: {
  frame: Props['frame']
  preferences: Props['preferences']
  saved: boolean
}) {
  const t = useT()
  const [switches, setSwitches] = useState(preferences)
  const breakRows = [0, 1, 2].map((index) => frame.breaks[index] ?? null)

  return (
    <Form
      action="/jadwal/susun-draf/pengaturan"
      method="post"
      options={{ preserveScroll: true }}
      className="min-w-0 space-y-4"
    >
      {({ errors, processing }) => {
        const error = (field: string) => (errors as Record<string, string | undefined>)[field]
        return (
          <>
            <Section
              title={t('timetable.compose.frame_title')}
              description={t('timetable.compose.frame_intro')}
            >
              {!saved && (
                <div className="mb-4">
                  <StatusLine tone="info">
                    {t('timetable.compose.settings_default_note')}
                  </StatusLine>
                </div>
              )}
              <div className="space-y-4">
                {WEEKDAYS.map((weekday, index) => (
                  <DayFields
                    key={weekday}
                    index={index}
                    day={
                      frame.days.find((row) => row.weekday === weekday) ?? {
                        weekday,
                        startsAt: '07:00',
                        lessons: 0,
                        opening: null,
                      }
                    }
                    error={error}
                  />
                ))}
              </div>
            </Section>

            <Section
              title={t('timetable.compose.breaks_title')}
              description={t('timetable.compose.breaks_intro')}
            >
              <div className="space-y-3">
                {breakRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-2 gap-3">
                    <TextField
                      label={t('timetable.compose.break_after_label')}
                      name={`breaks[${index}][after_lesson]`}
                      type="number"
                      min={1}
                      max={11}
                      defaultValue={row?.afterLesson ?? ''}
                      error={error(`breaks.${index}.after_lesson`)}
                    />
                    <TextField
                      label={t('timetable.compose.break_minutes_label')}
                      name={`breaks[${index}][minutes]`}
                      type="number"
                      min={5}
                      max={60}
                      defaultValue={row?.minutes ?? ''}
                      error={error(`breaks.${index}.minutes`)}
                    />
                  </div>
                ))}
              </div>
            </Section>

            <Section
              title={t('timetable.compose.preferences_title')}
              description={t('timetable.compose.preferences_intro')}
            >
              <div className="space-y-3">
                {(Object.keys(PREFERENCE_FIELDS) as PreferenceKey[]).map((key) => (
                  <Checkbox
                    key={key}
                    name={PREFERENCE_FIELDS[key]}
                    label={t(`timetable.compose.preferences.${PREFERENCE_FIELDS[key]}`)}
                    checked={switches[key]}
                    onChange={(checked) => setSwitches({ ...switches, [key]: checked })}
                  />
                ))}
              </div>
            </Section>

            {error('days') && <p className="text-sm text-danger">{error('days')}</p>}
            <Button type="submit" disabled={processing}>
              {processing ? t('common.status.saving') : t('timetable.compose.settings_action')}
            </Button>
          </>
        )
      }}
    </Form>
  )
}

function DayFields({
  index,
  day,
  error,
}: {
  index: number
  day: FrameDay
  error: (field: string) => string | undefined
}) {
  const t = useT()
  const [opening, setOpening] = useState(day.opening?.kind ?? '')
  const name = (field: string) => `days[${index}][${field}]`
  return (
    <fieldset className="rounded-lg border p-3">
      <legend className="px-1 font-bold">{t(`timetable.weekdays.${day.weekday}`)}</legend>
      <input type="hidden" name={name('weekday')} value={day.weekday} />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          label={t('timetable.fields.starts_at')}
          name={name('starts_at')}
          type="time"
          required
          defaultValue={day.startsAt}
          error={error(`days.${index}.starts_at`)}
        />
        <TextField
          label={t('timetable.compose.lessons_label')}
          name={name('lessons')}
          type="number"
          min={0}
          max={12}
          required
          defaultValue={day.lessons}
          error={error(`days.${index}.lessons`)}
        />
        <Select
          label={t('timetable.compose.opening_label')}
          name={name('opening_kind')}
          value={opening}
          onChange={setOpening}
          options={[
            { value: '', label: t('timetable.compose.opening_none') },
            { value: 'ceremony', label: t('timetable.kinds.ceremony') },
            { value: 'activity', label: t('timetable.kinds.activity') },
          ]}
        />
      </div>
      {opening !== '' && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField
            label={t('timetable.compose.opening_minutes_label')}
            name={name('opening_minutes')}
            type="number"
            min={5}
            max={120}
            required
            defaultValue={day.opening?.minutes ?? 30}
            error={error(`days.${index}.opening_minutes`)}
          />
          {opening === 'activity' && (
            <TextField
              label={t('timetable.compose.opening_name_label')}
              name={name('opening_label')}
              maxLength={40}
              autoComplete="off"
              defaultValue={day.opening?.label ?? ''}
              hint={t('timetable.class.label_hint')}
            />
          )}
        </div>
      )}
    </fieldset>
  )
}

ComposeTimetable.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>
