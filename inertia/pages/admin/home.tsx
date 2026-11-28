import type { ReactNode } from 'react'
import { Head, usePage } from '@inertiajs/react'
import ConsoleLayout from '~/layouts/console_layout'
import { useT } from '~/lib/i18n'

export default function AdminHome() {
  const t = useT()
  const { viewer } = usePage().props

  return (
    <>
      <Head title={t('areas.admin.title')} />
      <h1 className="text-2xl font-bold">{t('areas.admin.title')}</h1>
      <p className="mt-2">{t('areas.admin.greeting', { name: viewer?.name ?? '' })}</p>
      <p className="mt-2 text-muted">{t('console.home.intro')}</p>
    </>
  )
}

AdminHome.layout = (page: ReactNode) => <ConsoleLayout>{page}</ConsoleLayout>
