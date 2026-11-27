import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '~/lib/utils'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: ReactNode
  /** Extra control inside the field, e.g. a show-password button. */
  trailing?: ReactNode
}

/**
 * A labelled input with its hint and error under it (Fondasi ui.md,
 * feedback.md tier 3): never placeholder-only, aria-invalid plus
 * aria-describedby when there is an error.
 */
export function TextField({ label, error, hint, trailing, className, ...props }: TextFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            'block h-11 w-full rounded-md border bg-surface px-3 text-base text-text outline-none',
            'focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30',
            error && 'border-danger',
            trailing ? 'pr-12' : null,
            className
          )}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div>}
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
