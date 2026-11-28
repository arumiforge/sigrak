import { Form, Link } from '@inertiajs/react'
import { PageHeader } from '~/components/patterns/page_header'
import { EmptyState } from '~/components/patterns/empty_state'
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
      <PageHeader title={t('console.schools.title')} description={t('console.schools.intro')} />

      <Form action="/sekolah" method="get" className="flex max-w-xl items-end gap-2">
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
        <EmptyState className="mt-6" icon="school" description={t('console.schools.empty')} />
      ) : (
        <ul className="mt-6 divide-y rounded-lg border bg-surface">
          {schools.map((school) => (
            <li key={school.id}>
              <Link
                href={`/sekolah/${school.id}`}
                prefetch
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 p-4 first:rounded-t-lg last:rounded-b-lg hover:bg-brand-tint"
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

