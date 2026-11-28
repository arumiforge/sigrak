import { Link } from '@inertiajs/react'
import { Icon } from '~/components/icon'
import { formatNumber } from '~/lib/format'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

/**
 * The Kabar link in the app header (R2-05): a bell with the number of
 * Kabar the user has not opened yet (shared prop `kabarUnread`). The
 * number is in the accessible name too, never in colour alone.
 */
export function KabarBell({ count, active }: { count: number; active: boolean }) {
  const t = useT()
  const label = count > 0 ? t('nav.news_unread', { count: formatNumber(count) }) : t('nav.news')
  return (
    <Link
      href="/kabar"
      prefetch
      aria-label={label}
      title={label}
      aria-current={active ? 'page' : undefined}
      data-testid="kabar-bell"
      className={cn(
        'relative inline-flex size-11 items-center justify-center rounded-md text-text hover:bg-surface-hover',
        active && 'bg-brand-tint text-brand-strong'
      )}
    >
      <Icon name="notification" size={22} />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute top-1 right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] leading-5 font-bold text-on-danger"
        >
          {count > 99 ? '99+' : formatNumber(count)}
        </span>
      )}
    </Link>
  )
}
