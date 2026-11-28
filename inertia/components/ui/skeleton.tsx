import { cn } from '~/lib/utils'

/**
 * A placeholder block while data loads. It pulses softly; with reduced
 * motion it stays still (app.css).
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('animate-pulse rounded-md bg-line/70', className)}
      {...props}
    />
  )
}

export { Skeleton }
