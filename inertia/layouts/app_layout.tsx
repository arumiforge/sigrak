import type { ReactNode } from 'react'
import { usePage } from '@inertiajs/react'
import FlashToasts from '~/components/flash_toasts'
import { EmailConfirmationBanner } from '~/components/email_confirmation_banner'
import { AccountMenu, RoleSwitch } from '~/components/shell/account_menu'
import { BottomNav } from '~/components/shell/bottom_nav'
import { SidebarNav, SkipLink, Wordmark } from '~/components/shell/shell_parts'
import { useT } from '~/lib/i18n'
import { appNavFor } from '~/lib/navigation'

/**
 * Persistent shell of app. (school users, D-389, D-473): the sidebar
 * from 1024 px, the bottom navigation below it (at most five slots),
 * and a header with the role switch, the account menu and the
 * email-confirmation banner. The menu comes from lib/navigation.ts for
 * the role the request runs as. Inertia keeps this layout mounted
 * between pages, so only the page content changes.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const t = useT()
  const {
    props: { viewer, role },
    url,
  } = usePage()
  const items = appNavFor(role)

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      <SkipLink />
      <aside className="hidden border-r bg-surface lg:block">
        <div className="sticky top-0 flex h-dvh flex-col gap-6 overflow-y-auto px-3 py-3">
          <Wordmark href="/" label={t('common.app_name')} className="px-3" />
          <SidebarNav items={items} url={url} label={t('nav.label')} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b bg-surface">
          <div className="mx-auto flex h-[var(--header-height)] max-w-6xl items-center gap-2 px-4 lg:px-6">
            <Wordmark href="/" label={t('common.app_name')} className="lg:hidden" />
            <div className="flex-1" />
            {role && <RoleSwitch role={role} />}
            {viewer && (
              <AccountMenu
                name={viewer.name}
                role={role}
                accountHref="/akun"
                canSwitchRole={role !== null}
              />
            )}
          </div>
        </header>
        <EmailConfirmationBanner />
        <main
          id="isi"
          tabIndex={-1}
          data-page-content
          className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-[calc(var(--bottom-nav-height)+2rem+env(safe-area-inset-bottom))] outline-none sm:pt-6 lg:px-6 lg:pb-12"
        >
          {children}
        </main>
      </div>

      <BottomNav items={items} url={url} />
      <FlashToasts />
    </div>
  )
}
