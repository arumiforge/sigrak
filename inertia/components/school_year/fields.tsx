import { useId, useState, type ReactNode } from 'react'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

/**
 * Form parts of the Tahun Ajaran and Kelas pages (R1-06).
 */

export type Option = { value: string; label: string }

const controlClass = cn(
  'block h-11 w-full rounded-md border bg-surface px-3 text-base text-text outline-none',
  'focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30',
  'disabled:opacity-60'
)

/** A labelled native select with hint and error. */
export function Select({
  label,
  name,
  options,
  value,
  defaultValue,
  onChange,
  error,
  hint,
  disabled,
  srOnlyLabel,
}: {
  label: string
  name: string
  options: Option[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  error?: string
  hint?: ReactNode
  disabled?: boolean
  srOnlyLabel?: boolean
}) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ')
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={cn('block text-sm font-semibold', srOnlyLabel && 'sr-only')}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange?.(event.target.value)}
        className={cn(controlClass, error && 'border-danger')}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/** A checkbox with its label; sends "on" when ticked. */
export function Checkbox({
  label,
  name,
  checked,
  onChange,
  hint,
}: {
  label: string
  name: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex gap-3">
      <input
        id={id}
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-brand"
      />
      <div>
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  )
}

type ArtBranchOption = { artBranch: string; hasTopics: boolean }

/**
 * The Seni dan Budaya branch of a class (D-458). Tari and Teater can be
 * picked without SIGRAK topics (D-464); the option says so.
 */
export function ArtBranchSelect({
  options,
  defaultValue,
  error,
  disabled,
}: {
  options: ArtBranchOption[]
  defaultValue: string | null
  error?: string
  disabled?: boolean
}) {
  const t = useT()
  if (options.length === 0) return null
  const known = options.some((option) => option.artBranch === defaultValue)
  const anyWithoutTopics = options.some((option) => !option.hasTopics)
  return (
    <Select
      key={options.map((option) => option.artBranch).join()}
      label={t('classes.fields.art_branch')}
      name="art_branch"
      defaultValue={known && defaultValue ? defaultValue : ''}
      disabled={disabled}
      error={error}
      hint={anyWithoutTopics ? t('classes.art_branch_hint') : undefined}
      options={[
        { value: '', label: t('classes.art_branch_none') },
        ...options.map((option) => ({
          value: option.artBranch,
          label: option.hasTopics
            ? t(`classes.art_branches.${option.artBranch}`)
            : t('classes.art_branch_without_topics', {
                branch: t(`classes.art_branches.${option.artBranch}`),
              }),
        })),
      ]}
    />
  )
}

export type TeacherChoice = { value: string; name: string; active: boolean } | null

/**
 * Teacher options for a select: none, the school's active teachers,
 * and the current teacher when they are no longer active (kept as is).
 */
export function teacherOptions(
  t: ReturnType<typeof useT>,
  teachers: { publicId: string; name: string }[],
  current: TeacherChoice,
  noneLabel: string
): Option[] {
  return [
    { value: '', label: noneLabel },
    ...(current && !current.active
      ? [{ value: current.value, label: t('classes.teacher_inactive', { name: current.name }) }]
      : []),
    ...teachers.map((teacher) => ({ value: teacher.publicId, label: teacher.name })),
  ]
}

/** Grade options 1–6. */
export function gradeOptions(t: ReturnType<typeof useT>): Option[] {
  return [1, 2, 3, 4, 5, 6].map((grade) => ({
    value: String(grade),
    label: t('classes.grade_label', { grade }),
  }))
}

/** A grade picked in a form, for fields that follow it. */
export function useGrade(initial: number) {
  return useState(String(initial))
}
