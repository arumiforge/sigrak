import { Form } from '@inertiajs/react'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { TextField } from '~/components/text_field'
import { TrialForm } from '~/components/trial_form'
import { Button } from '~/components/ui/button'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'
import { formatShortDate } from '~/lib/format'

type Props = {
  q: string
  users: {
    id: number
    name: string
    email: string
    trial: {
      started: boolean
      active: boolean
      days: number
      source: 'user' | 'school' | 'default'
      endsAt: string | null
    }
  }[]
  can: { manageTrials: boolean }
}

/**
 * Konsol /pengguna: find a school user and change their own trial
 * (D-459).
 */
export default function ConsoleUsers({ q, users, can }: Props) {
  const t = useT()

  return (
    <>
      <PageHeader title={t('console.users.title')} description={t('console.users.intro')} />

      <Form action="/pengguna" method="get" className="flex max-w-xl items-end gap-2">
        <div className="flex-1">
          <TextField
            label={t('console.users.search_label')}
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t('console.users.search_placeholder')}
          />
        </div>
        <Button type="submit" variant="outline">
          <Icon name="search" />
          {t('console.search.submit')}
        </Button>
      </Form>

      {!q ? (
        <EmptyState className="mt-6" icon="search" description={t('console.users.hint')} />
      ) : users.length === 0 ? (
        <EmptyState className="mt-6" icon="users" description={t('console.users.empty')} />
      ) : (
        <ul className="mt-6 space-y-3">
          {users.map((user) => (
            <li key={user.id} className="rounded-lg border bg-surface p-4">
              <p className="font-semibold">{user.name}</p>
              <p className="text-sm break-all text-muted">{user.email}</p>
              <p className="mt-2 text-sm" data-testid="user-trial">
                <span className="font-semibold">{t('console.trial.title')}: </span>
                {!user.trial.started || !user.trial.endsAt
                  ? t('console.trial.status_not_started')
                  : user.trial.active
                    ? t('console.trial.status_active', {
                        date: formatShortDate(user.trial.endsAt),
                      })
                    : t('console.trial.status_ended', { date: formatShortDate(user.trial.endsAt) })}
                {' · '}
                {t('console.trial.length', {
                  days: user.trial.days,
                  source: t(`console.trial.sources.${user.trial.source}`),
                })}
              </p>
              {can.manageTrials && (
                <div className="mt-3 border-t pt-3">
                  <p className="mb-3 text-sm text-muted">{t('console.trial.user_intro')}</p>
                  <TrialForm action={`/pengguna/${user.id}/uji-coba`} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

