import { useState } from 'react'
import { Link } from '@inertiajs/react'
import { Icon } from '~/components/icon'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '~/components/ui/drawer'
import { useT } from '~/lib/i18n'
import { isActive, splitForBottomNav, type NavItem } from '~/lib/navigation'
import { cn } from '~/lib/utils'
import { SidebarNav } from './shell_parts'

const slot =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-xs font-semibold leading-tight transition-colors'

/**
 * The bottom navigation on phones and tablets (below 1024 px): at most
 * five slots, 24 px icons, the label under each icon, the active item
 * in the brand colour with its solid icon. When a role has more items
 * the fifth slot is "Lainnya", a bottom sheet with the rest.
 */
export function BottomNav({ items, url }: { items: NavItem[]; url: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const { primary, more } = splitForBottomNav(items)
  const moreActive = more.some((item) => isActive(item, url))

  if (items.length === 0) return null

  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex h-[var(--bottom-nav-height)] max-w-xl items-stretch gap-1 px-2 py-1">
        {primary.map((item) => {
          const active = isActive(item, url)
          return (
            <li key={item.key} className="flex min-w-0 flex-1">
              <Link
                href={item.href}
                prefetch={['hover', 'click']}
                aria-current={active ? 'page' : undefined}
                className={cn(slot, active ? 'text-brand-strong' : 'text-muted hover:text-text')}
              >
                <span
                  className={cn(
                    'inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                    active && 'bg-brand-tint'
                  )}
                >
                  <Icon name={item.icon} size={24} active={active} />
                </span>
                <span className="max-w-full truncate">{t(item.label)}</span>
              </Link>
            </li>
          )
        })}
        {more.length > 0 && (
          <li className="flex min-w-0 flex-1">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className={cn(slot, moreActive ? 'text-brand-strong' : 'text-muted hover:text-text')}
            >
              <span
                className={cn(
                  'inline-flex h-7 w-12 items-center justify-center rounded-full',
                  moreActive && 'bg-brand-tint'
                )}
              >
                <Icon name="more" size={24} />
              </span>
              <span className="max-w-full truncate">{t('nav.more')}</span>
            </button>
          </li>
        )}
      </ul>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerTitle className="px-3 pb-1">{t('nav.more_title')}</DrawerTitle>
          <DrawerDescription className="sr-only">{t('nav.label')}</DrawerDescription>
          <div className="pt-2">
            <SidebarNav
              items={more}
              url={url}
              label={t('nav.more_title')}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </nav>
  )
}
