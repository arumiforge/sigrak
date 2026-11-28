import { Link, usePage } from '@inertiajs/react'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

const items = [
  { href: '/ekstrakurikuler', label: 'layers.nav.extracurricular' },
  { href: '/paket-daerah', label: 'layers.nav.packages' },
  { href: '/usulan', label: 'layers.nav.proposals' },
]

/**
 * Tabs between the layer pages of the school app until the app menus
 * arrive with their slices.
 */
export function LayerNav() {
  const t = useT()
  const { url } = usePage()

  return (
    <nav aria-label={t('layers.nav.label')} className="mb-6 border-b">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = url.startsWith(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-semibold whitespace-nowrap text-muted hover:text-text',
                  active && 'border-brand text-brand-strong'
                )}
              >
                {t(item.label)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
