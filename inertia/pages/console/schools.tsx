import type { ReactNode } from 'react'
import { Form, Head, Link } from '@inertiajs/react'
import ConsoleLayout from '~/layouts/console_layout'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'

type Props = {
  q: string
  schools: {
    id: number
    name: string
    npsn: string | null
    level: 'sd' | 'mi'
    trialDays: number | null
    members: number
  }[]
}

/**
 * Konsol /sekolah: find a school by name or NPSN.
 */
export default function ConsoleSchools({ q, schools }: Props) {
  const t = useT()

  return (
    <>
      <Head title={t('console.schools.title')} />
      <h1 className="text-2xl font-bold">{t('console.schools.title')}</h1>
      <p className="mt-2 text-muted">{t('console.schools.intro')}</p>

      <Form action="/sekolah" method="get" className="mt-4 flex max-w-xl items-end gap-2">
        <div className="flex-1">
          <TextField
            label={t('console.schools.search_label')}
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t('console.schools.search_placeholder')}
          />
        </div>
        <Button type="submit" variant="outline">
          <Icon name="search" />
          {t('console.search.submit')}
        </Button>
      </Form>

      {schools.length === 0 ? (
        <p className="mt-6 text-muted">{t('console.schools.empty')}</p>
      ) : (
        <ul className="mt-6 divide-y rounded-xl border bg-surface">
          {schools.map((school) => (
            <li key={school.id}>
              <Link
                href={`/sekolah/${school.id}`}
                className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-brand-tint"
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{school.name}</span>
                  <span className="block text-sm text-muted">
                    {t(`console.levels.${school.level}`)} ·{' '}
                    {school.npsn
                      ? t('console.schools.npsn', { npsn: school.npsn })
                      : t('console.schools.no_npsn')}
                  </span>
                </span>
                <span className="text-sm text-muted">
                  {t('console.schools.members', { count: school.members })} ·{' '}
                  {school.trialDays
                    ? t('console.schools.trial_days', { days: school.trialDays })
                    : t('console.schools.trial_default')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

ConsoleSchools.layout = (page: ReactNode) => <ConsoleLayout>{page}</ConsoleLayout>
