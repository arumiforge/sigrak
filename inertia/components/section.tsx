import { useId, type ReactNode } from 'react'
import { cn } from '~/lib/utils'

/**
 * A titled block on a page (a card on wide screens, flat on phones).
 */
export function Section({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border bg-surface p-4 sm:p-6', className)}>
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/**
 * A native select with its label and error, styled like TextField.
 */
export function SelectField({
  label,
  name,
  options,
  defaultValue,
  error,
  onChange,
}: {
  label: string
  name: string
  options: { value: string; label: string }[]
  defaultValue?: string
  error?: string
  onChange?: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange?.(event.target.value)}
        className={cn(
          'block h-11 w-full rounded-md border bg-surface px-3 text-base text-text outline-none',
          'focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30',
          error && 'border-danger'
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
