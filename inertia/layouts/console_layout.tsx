import type { ReactNode } from 'react'
import { Link, usePage } from '@inertiajs/react'
import FlashToasts from '~/components/flash_toasts'
import { SignOutButton } from '~/components/sign_out_button'
import { Icon, type IconName } from '~/components/icon'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

const navItems: { href: string; label: string; icon: IconName }[] = [
  { href: '/sekolah', label: 'console.nav.schools', icon: 'school' },
  { href: '/pengguna', label: 'console.nav.users', icon: 'users' },
  { href: '/pengaturan', label: 'console.nav.settings', icon: 'settings' },
]

/**
 * Persistent shell of the staff console on admin. (laptop first, still
 * usable on a phone).
 */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  const t = useT()
  const {
    props: { viewer },
    url,
  } = usePage()

  return (
    <div className="min-h-dvh">
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 sm:gap-4">
          <Link href="/" className="hidden text-lg font-bold text-brand-strong md:inline">
            {t('common.areas.admin')}
          </Link>
          <nav aria-label={t('console.nav.label')} className="min-w-0 flex-1 overflow-x-auto">
            <ul className="flex items-center gap-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
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
          {viewer && <span className="hidden text-sm text-muted lg:inline">{viewer.name}</span>}
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <FlashToasts />
    </div>
  )
}
