import type { ReactNode } from 'react'
import { Form, Head } from '@inertiajs/react'
import AppLayout from '~/layouts/app_layout'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatShortDate } from '~/lib/format'
import { cn } from '~/lib/utils'

type Props = {
  teachers: { publicId: string; name: string; email: string; startedOn: string }[]
  invitations: {
    publicId: string
    email: string
    state: 'open' | 'expired' | 'accepted'
    sentAt: string
    expiresAt: string
  }[]
}

/**
 * /guru (operator, D-182): invite teachers by email, send an invitation
 * again, cancel it, and see who has joined.
 */
export default function Teachers({ teachers, invitations }: Props) {
  const t = useT()

  return (
    <>
      <Head title={t('accounts.teachers.title')} />
      <h1 className="text-2xl font-bold">{t('accounts.teachers.title')}</h1>
      <p className="mt-2 text-muted">{t('accounts.teachers.intro')}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_3fr]">
        <Section title={t('accounts.teachers.invite_title')} className="self-start">
          <Form
            action="/guru/undangan"
            method="post"
            resetOnSuccess
            options={{ preserveScroll: true }}
            className="space-y-4"
          >
            {({ errors, processing }) => (
              <>
                <TextField
                  label={t('auth.fields.email')}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  required
                  hint={t('accounts.teachers.email_hint')}
                  error={errors.email}
                />
                <Button type="submit" disabled={processing}>
                  {processing
                    ? t('accounts.teachers.inviting')
                    : t('accounts.teachers.invite_action')}
                </Button>
              </>
            )}
          </Form>
        </Section>

        <div className="space-y-4">
          <Section title={t('accounts.teachers.invitations_title')}>
            {invitations.length === 0 ? (
              <p className="text-muted">{t('accounts.teachers.invitations_empty')}</p>
            ) : (
              <ul className="divide-y">
                {invitations.map((invitation) => (
                  <li
                    key={invitation.publicId}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold break-all">{invitation.email}</p>
                      <p className="text-sm text-muted">
                        <span
                          className={cn(
                            'font-semibold',
                            invitation.state === 'expired' ? 'text-warn' : 'text-text'
                          )}
                        >
                          {t(`accounts.invitation_states.${invitation.state}`)}
                        </span>
                        {' · '}
                        {invitation.state === 'expired'
                          ? t('accounts.teachers.sent_on', {
                              date: formatShortDate(invitation.sentAt),
                            })
                          : t('accounts.teachers.expires_on', {
                              date: formatShortDate(invitation.expiresAt),
                            })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Form
                        action={`/guru/undangan/${invitation.publicId}/kirim-ulang`}
                        method="post"
                        options={{ preserveScroll: true }}
                      >
                        {({ processing }) => (
                          <Button type="submit" variant="outline" size="sm" disabled={processing}>
                            {t('accounts.teachers.resend')}
                          </Button>
                        )}
                      </Form>
                      <Form
                        action={`/guru/undangan/${invitation.publicId}/batal`}
                        method="post"
                        options={{ preserveScroll: true }}
                        onBefore={() =>
                          window.confirm(
                            t('accounts.teachers.cancel_confirm', { email: invitation.email })
                          )
                        }
                      >
                        {({ processing }) => (
                          <Button type="submit" variant="ghost" size="sm" disabled={processing}>
                            {t('accounts.teachers.cancel')}
                          </Button>
                        )}
                      </Form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t('accounts.teachers.list_title')}>
            {teachers.length === 0 ? (
              <p className="text-muted">{t('accounts.teachers.empty')}</p>
            ) : (
              <ul className="divide-y">
                {teachers.map((teacher) => (
                  <li key={teacher.publicId} className="py-3">
                    <p className="font-semibold">{teacher.name}</p>
                    <p className="text-sm break-all text-muted">{teacher.email}</p>
                    <p className="text-xs text-muted">
                      {t('accounts.teachers.joined_on', {
                        date: formatShortDate(teacher.startedOn),
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  )
}

Teachers.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>
