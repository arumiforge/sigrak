import { useId, type ReactNode } from 'react'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { cn } from '~/lib/utils'

/**
 * A titled block on a page: a card with a 1 px line and 10 px radius
 * (design system), its heading wired to the section for screen readers.
 */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: ReactNode
  /** Small actions on the right of the heading. */
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn('min-w-0 rounded-lg border bg-surface p-4 sm:p-6', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-lg font-bold">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions}
      </div>
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
  disabled,
  onChange,
}: {
  label: string
  name: string
  options: { value: string; label: string }[]
  defaultValue?: string
  error?: string
  disabled?: boolean
  onChange?: (value: string) => void
}) {
  return (
    <FormField label={label} error={error}>
      {(field) => (
        <select
          {...field}
          name={name}
          defaultValue={defaultValue}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
          className={controlClass}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  )
}
