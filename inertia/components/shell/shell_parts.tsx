import { Link } from '@inertiajs/react'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'
import { groupBySection, isActive, type NavItem } from '~/lib/navigation'
import { cn } from '~/lib/utils'

/**
 * Pieces every layout shares: the skip link, the wordmark and the
 * sidebar list. The logo waits for the owner's choice (D-462, D-473);
 * until then the wordmark is the product name in text.
 */

export function SkipLink() {
  const t = useT()
  return (
    <a
      href="#isi"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-surface focus:px-4 focus:font-semibold focus:shadow-float"
    >
      {t('nav.skip_to_content')}
    </a>
  )
}

export function Wordmark({
  href,
  label,
  className,
}: {
  href?: string
  label: string
  className?: string
}) {
  const content = (
    <span className="truncate text-lg font-extrabold tracking-tight text-brand-strong">
      {label}
    </span>
  )
  const classes = cn('inline-flex min-h-11 min-w-0 items-center rounded-md', className)
  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  )
}

/**
 * The sidebar list: groups with an optional heading, the active item
 * marked with the brand tint, a solid icon and aria-current. Links
 * prefetch on hover so the next page opens at once (D-389).
 */
export function SidebarNav({
  items,
  url,
  label,
  onNavigate,
}: {
  items: NavItem[]
  url: string
  label: string
  onNavigate?: () => void
}) {
  const t = useT()
  return (
    <nav aria-label={label} className="flex flex-col gap-4">
      {groupBySection(items).map((group, index) => (
        <div key={`${group.section ?? 'main'}-${index}`} className="flex flex-col gap-0.5">
          {group.section ? (
            <p className="px-3 pt-1 pb-1.5 text-xs font-semibold text-muted">{t(group.section)}</p>
          ) : index > 0 ? (
            <div aria-hidden className="mx-3 mb-2 h-px bg-line" />
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(item, url)
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    prefetch
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors',
                      active
                        ? 'bg-brand-tint text-brand-strong'
                        : 'text-muted hover:bg-surface-hover hover:text-text'
                    )}
                  >
                    <Icon name={item.icon} active={active} />
                    <span className="min-w-0 truncate">{t(item.label)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
