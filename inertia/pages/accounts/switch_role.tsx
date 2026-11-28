import type { ReactNode } from 'react'
import { Form, Head } from '@inertiajs/react'
import AppLayout from '~/layouts/app_layout'
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
      <Head title={t('accounts.switch_role.title')} />
      <h1 className="text-2xl font-bold">{t('accounts.switch_role.title')}</h1>
      <p className="mt-2 text-muted">{t('accounts.switch_role.intro')}</p>

      {memberships.length === 0 ? (
        <p className="mt-6">{t('accounts.switch_role.none')}</p>
      ) : (
        <ul className="mt-6 max-w-xl space-y-3">
          {memberships.map((membership) => (
            <li
              key={membership.publicId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-surface p-4"
            >
              <div>
                <p className="font-semibold">{t(`accounts.roles.${membership.role}`)}</p>
                <p className="text-sm text-muted">{membership.schoolName}</p>
              </div>
              {membership.active ? (
                <span className="rounded-full bg-brand-tint px-3 py-1 text-sm font-semibold text-brand-strong">
                  {t('accounts.switch_role.current')}
                </span>
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

SwitchRole.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>
