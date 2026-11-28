import { useId, type ReactNode } from 'react'
import { cn } from '~/lib/utils'

/**
 * Label, control, hint and error in one block (Fondasi ui.md and
 * feedback.md tier 3): never a placeholder-only field; the hint and the
 * error are tied to the control with aria-describedby, and the control
 * gets aria-invalid while there is an error. The control comes from the
 * render prop, so any input, select or textarea fits.
 *
 *   <FormField label="Nama kelas" hint="…" error={errors.class_name}>
 *     {(field) => <input {...field} name="class_name" className={controlClass} />}
 *   </FormField>
 */
export type FieldProps = {
  'id': string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

export function FormField({
  label,
  hint,
  error,
  srOnlyLabel = false,
  optionalLabel,
  className,
  children,
}: {
  label: string
  hint?: ReactNode
  error?: string
  srOnlyLabel?: boolean
  /** "(opsional)" after the label. */
  optionalLabel?: string
  className?: string
  children: (field: FieldProps) => ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className={cn('block text-sm font-semibold', srOnlyLabel && 'sr-only')}>
        {label}
        {optionalLabel && <span className="font-normal text-muted"> ({optionalLabel})</span>}
      </label>
      {children({
        'id': id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/** The look of every text input, select and textarea (44 px, 6 px radius). */
export const controlClass = cn(
  'block min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-text outline-none',
  'transition-colors placeholder:text-muted hover:border-text/70',
  'focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/25',
  'disabled:cursor-not-allowed disabled:bg-page disabled:opacity-70',
  'aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/20'
)
