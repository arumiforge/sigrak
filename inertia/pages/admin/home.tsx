import { Link, usePage } from '@inertiajs/react'
import { Icon } from '~/components/icon'
import { PageHeader } from '~/components/patterns/page_header'
import { useT } from '~/lib/i18n'
import { consoleNav } from '~/lib/navigation'

export default function AdminHome() {
  const t = useT()
  const { viewer } = usePage().props
  const shortcuts = consoleNav().filter((item) => item.href !== '/')

  return (
    <>
      <PageHeader
        title={t('areas.admin.title')}
        description={t('areas.admin.greeting', { name: viewer?.name ?? '' })}
      >
        <p className="mt-1 max-w-3xl text-muted">{t('console.home.intro')}</p>
      </PageHeader>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              prefetch
              className="flex min-h-16 items-center gap-3 rounded-lg border bg-surface p-4 font-semibold hover:border-brand hover:bg-brand-tint hover:text-brand-strong"
            >
              <Icon name={item.icon} />
              {t(item.label)}
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
