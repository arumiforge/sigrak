import { useState } from 'react'
import { TextField } from '~/components/text_field'
import { useT } from '~/lib/i18n'
import { useLevelTerms } from '~/lib/level_terms'
import { Checkbox } from './fields'

/**
 * Parts of the Tahun Ajaran forms (D-241, D-242…D-246).
 */

export type YearDates = { startsOn: string; evenSemesterStartsOn: string; endsOn: string }

type Errors = Partial<Record<'starts_on' | 'even_semester_starts_on' | 'ends_on', string>>

/** `2027-07-01` → `2027/2028` (the name follows the start date). */
export function nameFromStart(startsOn: string) {
  const year = Number(startsOn.slice(0, 4))
  return Number.isFinite(year) && year > 0 ? `${year}/${year + 1}` : ''
}

/**
 * Start, semester 2 and end dates; the name is shown, never typed.
 */
export function YearDateFields({
  dates,
  errors,
  disabled,
}: {
  dates: YearDates
  errors: Errors
  disabled?: boolean
}) {
  const t = useT()
  const [startsOn, setStartsOn] = useState(dates.startsOn)
  const name = nameFromStart(startsOn)
  return (
    <div className="space-y-4">
      <TextField
        label={t('classes.fields.starts_on')}
        name="starts_on"
        type="date"
        required
        disabled={disabled}
        defaultValue={dates.startsOn}
        onChange={(event) => setStartsOn(event.target.value)}
        error={errors.starts_on}
        hint={name ? t('classes.years.name_hint', { name }) : undefined}
      />
      <TextField
        label={t('classes.fields.even_semester_starts_on')}
        name="even_semester_starts_on"
        type="date"
        required
        disabled={disabled}
        defaultValue={dates.evenSemesterStartsOn}
        error={errors.even_semester_starts_on}
      />
      <TextField
        label={t('classes.fields.ends_on')}
        name="ends_on"
        type="date"
        required
        disabled={disabled}
        defaultValue={dates.endsOn}
        error={errors.ends_on}
        hint={t('classes.years.length_hint')}
      />
    </div>
  )
}

export type CopyPreview = {
  sourceName: string
  withGradeOne: { name: string; grade: number }[]
  withoutGradeOne: { name: string; grade: number }[]
}

/**
 * The grade 1 checkbox (on by default, D-244) and the names the copy
 * makes, by grade.
 */
export function CopyOptions({
  preview,
  levelTerms,
}: {
  preview: CopyPreview
  levelTerms: { homeroomTeacherTerm: string }
}) {
  const t = useT()
  const terms = useLevelTerms(levelTerms)
  const [gradeOne, setGradeOne] = useState(true)
  const rows = gradeOne ? preview.withGradeOne : preview.withoutGradeOne
  const grades = [...new Set(rows.map((row) => row.grade))].sort((a, b) => a - b)
  return (
    <div className="space-y-3">
      <Checkbox
        label={t('classes.copy.grade_one')}
        name="include_grade_one"
        checked={gradeOne}
        onChange={setGradeOne}
        hint={t('classes.copy.grade_one_hint')}
      />
      <div className="rounded-md bg-page p-3 text-sm">
        <p className="font-semibold">{t('classes.copy.preview', { count: rows.length })}</p>
        <ul className="mt-1 space-y-0.5 text-muted">
          {grades.map((grade) => (
            <li key={grade}>
              {t('classes.copy.preview_grade', {
                grade,
                names: rows
                  .filter((row) => row.grade === grade)
                  .map((row) => row.name)
                  .join(', '),
              })}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">{t('classes.copy.no_teachers', terms)}</p>
      </div>
    </div>
  )
}
