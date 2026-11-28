import { useState, type ReactNode } from 'react'
import { usePage } from '@inertiajs/react'
import FlashToasts from '~/components/flash_toasts'
import { Icon } from '~/components/icon'
import { AccountMenu } from '~/components/shell/account_menu'
import { SidebarNav, SkipLink, Wordmark } from '~/components/shell/shell_parts'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '~/components/ui/drawer'
import { useT } from '~/lib/i18n'
import { consoleNav } from '~/lib/navigation'

/**
 * Persistent shell of the staff console on admin. (laptop first, still
 * usable on a phone): the sidebar from 1024 px; below it a menu button
 * opens the same list as a bottom sheet. The console may have its own
 * look but keeps the brand colour (design system, Stack mapping).
 */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const {
    props: { viewer, staffAbilities },
    url,
  } = usePage()
  const items = consoleNav(staffAbilities)

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
      <SkipLink />
      <aside className="hidden border-r bg-surface lg:block">
        <div className="sticky top-0 flex h-dvh flex-col gap-6 overflow-y-auto px-3 py-3">
          <Wordmark href="/" label={t('common.areas.admin')} className="px-3" />
          <SidebarNav items={items} url={url} label={t('nav.console.label')} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b bg-surface">
          <div className="mx-auto flex h-[var(--header-height)] max-w-6xl items-center gap-1 px-2 sm:px-4 lg:px-6">
            <button
              type="button"
              aria-label={t('nav.open_menu')}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="inline-flex size-11 items-center justify-center rounded-md text-text hover:bg-surface-hover lg:hidden"
            >
              <Icon name="menu" />
            </button>
            <Wordmark href="/" label={t('common.areas.admin')} className="lg:hidden" />
            <div className="flex-1" />
            {viewer && <AccountMenu name={viewer.name} accountHref="/akun" />}
          </div>
        </header>
        <main
          id="isi"
          tabIndex={-1}
          data-page-content
          className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-12 outline-none sm:pt-6 lg:px-6"
        >
          {children}
        </main>
      </div>

      <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
        <DrawerContent>
          <DrawerTitle className="px-3 pb-1">{t('nav.console.label')}</DrawerTitle>
          <DrawerDescription className="sr-only">{t('common.areas.admin')}</DrawerDescription>
          <div className="pt-2">
            <SidebarNav
              items={items}
              url={url}
              label={t('nav.console.label')}
              onNavigate={() => setMenuOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
      <FlashToasts />
    </div>
  )
}
