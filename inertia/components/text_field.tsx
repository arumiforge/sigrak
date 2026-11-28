import type { InputHTMLAttributes, ReactNode } from 'react'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { cn } from '~/lib/utils'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: ReactNode
  /** Extra control inside the field, e.g. a show-password button. */
  trailing?: ReactNode
}

/**
 * A labelled input with its hint and error under it (FormField): never
 * placeholder-only, aria-invalid plus aria-describedby when there is an
 * error.
 */
export function TextField({ label, error, hint, trailing, className, ...props }: TextFieldProps) {
  return (
    <FormField label={label} hint={hint} error={error}>
      {(field) => (
        <div className="relative">
          <input
            {...field}
            className={cn(controlClass, 'h-11', trailing ? 'pr-12' : null, className)}
            {...props}
          />
          {trailing && (
            <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div>
          )}
        </div>
      )}
    </FormField>
  )
}
