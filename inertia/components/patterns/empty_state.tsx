import type { ReactNode } from 'react'
import { Icon, type IconName } from '~/components/icon'
import { cn } from '~/lib/utils'

/**
 * "Nothing here yet" with the next step (design system: "Belum ada
 * murid. Tambahkan satu per satu atau impor dari Excel."). Plain: one
 * icon, one sentence or two, an optional action. Codex illustrations
 * can replace the icon later (D-390); the text stays.
 */
export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: IconName
  title?: string
  description: ReactNode
  action?: ReactNode
  /** Inside a card or list: less padding, no border. */
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 text-left sm:items-center sm:text-center',
        compact ? 'py-4' : 'rounded-lg border border-dashed bg-surface px-4 py-8 sm:px-8',
        className
      )}
      data-testid="empty-state"
    >
      <span
        aria-hidden
        className="inline-flex size-11 items-center justify-center rounded-full bg-brand-tint text-brand-strong"
      >
        <Icon name={icon} size={22} />
      </span>
      <div className="max-w-md space-y-1">
        {title && <p className="font-bold">{title}</p>}
        <p className="text-muted">{description}</p>
      </div>
      {action}
    </div>
  )
}
