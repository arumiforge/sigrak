import type { ReactNode } from 'react'
import { Deferred } from '@inertiajs/react'
import { Skeleton } from '~/components/ui/skeleton'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

/**
 * Loading placeholders shaped like what comes, so the page does not
 * jump when data arrives (D-389). Screen readers hear "Memuat…" once.
 */

function LoadingLabel() {
  const t = useT()
  return <span className="sr-only">{t('common.status.loading')}</span>
}

/** Lines of text, the last one shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div role="status" className={cn('space-y-2', className)}>
      <LoadingLabel />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-4', index === lines - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  )
}

/** A list of rows (table rows on desktop, cards on phones). */
export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" className={cn('divide-y rounded-lg border bg-surface', className)}>
      <LoadingLabel />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 p-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Cards in a grid. */
export function SkeletonCards({ cards = 4, className }: { cards?: number; className?: string }) {
  return (
    <div role="status" className={cn('grid gap-3 sm:grid-cols-2', className)}>
      <LoadingLabel />
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className="space-y-3 rounded-lg border bg-surface p-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-9 w-28" />
        </div>
      ))}
    </div>
  )
}

/**
 * A deferred prop with its skeleton (D-389): the page renders at once
 * and this part fills in when the server sends the slow data.
 *
 *   <DeferredSection data="stats" fallback={<SkeletonCards />}>
 *     <Stats />
 *   </DeferredSection>
 */
export function DeferredSection({
  data,
  fallback = <SkeletonList />,
  children,
}: {
  data: string | string[]
  fallback?: ReactNode
  children: ReactNode
}) {
  return (
    <Deferred data={data} fallback={fallback}>
      {children}
    </Deferred>
  )
}
