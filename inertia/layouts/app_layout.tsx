import type { ReactNode } from 'react'
import { Link, usePage } from '@inertiajs/react'
import FlashToasts from '~/components/flash_toasts'
import { SignOutButton } from '~/components/sign_out_button'
import { Icon, type IconName } from '~/components/icon'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

const navItems: { href: string; label: string; icon: IconName }[] = [
  { href: '/kalender', label: 'common.nav.calendar', icon: 'calendar' },
  { href: '/coba-ai', label: 'common.nav.ai_demo', icon: 'lab' },
]

/**
 * Persistent shell of app. (school users). Kalender and the Coba AI
 * spike exist so far; the five teacher menus (bottom nav on phones,
 * sidebar on laptops) come with their slices.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const t = useT()
  const {
    props: { viewer },
    url,
  } = usePage()

  return (
    <div className="min-h-dvh">
      <a
        href="#isi"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
      >
        {t('common.nav.skip_to_content')}
      </a>
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:gap-4">
          <Link href="/kalender" className="text-lg font-bold text-brand-strong">
            {t('common.app_name')}
          </Link>
          <nav aria-label={t('common.nav.label')} className="flex-1">
            <ul className="flex items-center gap-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch
                    aria-current={url.startsWith(item.href) ? 'page' : undefined}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-semibold whitespace-nowrap text-muted hover:text-text sm:px-3',
                      url.startsWith(item.href) && 'bg-brand-tint text-brand-strong'
                    )}
                  >
                    <Icon name={item.icon} className="hidden sm:block" />
                    {t(item.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {viewer && (
            <span className="hidden text-sm text-muted sm:inline" data-testid="viewer-name">
              {viewer.name}
            </span>
          )}
          <SignOutButton />
        </div>
      </header>
      <main id="isi" className="mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>
      <FlashToasts />
    </div>
  )
}
