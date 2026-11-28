import { Link, usePage } from '@inertiajs/react'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

export type RegionRef = {
  id: number
  name: string
  kind: 'province' | 'kabupaten' | 'kota' | 'district'
  code: string
}

/**
 * "Kabupaten Kudus", "Kecamatan Jati": the kind word comes from
 * regions.kinds.
 */
export function useRegionLabel() {
  const t = useT()
  return (region: RegionRef) => t(`regions.kinds.${region.kind}`, { name: region.name })
}

const items = [
  { href: '/direktori-sekolah', label: 'regions.nav.directory' },
  { href: '/perubahan-wilayah', label: 'regions.nav.changes' },
]

/**
 * Tabs between the two region pages of the staff console until the
 * console gets its own menu (R1-05).
 */
export function RegionNav() {
  const t = useT()
  const { url } = usePage()

  return (
    <nav aria-label={t('regions.nav.label')} className="mb-6 border-b">
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
