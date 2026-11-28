import { Form } from '@inertiajs/react'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { EmptyState } from '~/components/patterns/empty_state'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

type Props = {
  memberships: {
    publicId: string
    role: 'principal' | 'operator' | 'teacher'
    schoolName: string
    active: boolean
  }[]
}

/**
 * /ganti-peran: pick the role to work as (a principal who also teaches,
 * a teacher in two schools). Only public ids reach the page (D-182).
 */
export default function SwitchRole({ memberships }: Props) {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('accounts.switch_role.title')}
        description={t('accounts.switch_role.intro')}
      />

      {memberships.length === 0 ? (
        <EmptyState icon="switch" description={t('accounts.switch_role.none')} />
      ) : (
        <ul className="max-w-xl space-y-3">
          {memberships.map((membership) => (
            <li
              key={membership.publicId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface p-4"
            >
              <div>
                <p className="font-semibold">{t(`accounts.roles.${membership.role}`)}</p>
                <p className="text-sm text-muted">{membership.schoolName}</p>
              </div>
              {membership.active ? (
                <StatusChip tone="brand" icon="check">
                  {t('accounts.switch_role.current')}
                </StatusChip>
              ) : (
                <Form action="/ganti-peran" method="post">
                  {({ processing }) => (
                    <>
                      <input type="hidden" name="membership" value={membership.publicId} />
                      <Button type="submit" variant="outline" disabled={processing}>
                        {t('accounts.switch_role.use')}
                      </Button>
                    </>
                  )}
                </Form>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
