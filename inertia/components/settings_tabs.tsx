import { Link, usePage } from '@inertiajs/react'
import { pathOf } from '~/lib/navigation'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

/**
 * The parts of the console's Pengaturan area (R2-03): Umum, Integrasi
 * and Model AI, each shown only to staff with its ability. Hidden when
 * a staff member can open only one part.
 */
const TABS = [
  { href: '/pengaturan', label: 'nav.settings_tabs.general', ability: 'settings.view' },
  {
    href: '/pengaturan/integrasi',
    label: 'nav.settings_tabs.integrations',
    ability: 'integrations.view',
  },
  { href: '/pengaturan/model-ai', label: 'nav.settings_tabs.ai_models', ability: 'ai_models.view' },
] as const

export function SettingsTabs() {
  const t = useT()
  const { url, props } = usePage()
  const path = pathOf(url)
  const tabs = TABS.filter((tab) => props.staffAbilities.includes(tab.ability))
  if (tabs.length < 2) return null

  return (
    <nav aria-label={t('nav.settings_tabs.label')} className="-mt-2 mb-6 overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b">
        {tabs.map((tab) => {
          const current = path === tab.href
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                prefetch
                aria-current={current ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold',
                  current
                    ? 'border-brand text-brand-strong'
                    : 'border-transparent text-muted hover:text-text'
                )}
              >
                {t(tab.label)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
