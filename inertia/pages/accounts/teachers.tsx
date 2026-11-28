import { Form } from '@inertiajs/react'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { ConfirmAction } from '~/components/patterns/confirm_dialog'
import { DataTable, type DataColumn } from '~/components/patterns/data_table'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip, type StatusTone } from '~/components/patterns/status_chip'
import { useT } from '~/lib/i18n'
import { formatShortDate } from '~/lib/format'

type Teacher = { publicId: string; name: string; email: string; startedOn: string }

type Invitation = {
  publicId: string
  email: string
  state: 'open' | 'expired' | 'accepted'
  sentAt: string
  expiresAt: string
}

type Props = {
  teachers: Teacher[]
  invitations: Invitation[]
}

const stateTone: Record<Invitation['state'], StatusTone> = {
  open: 'neutral',
  expired: 'warn',
  accepted: 'ok',
}

/**
 * /guru (operator, D-182): invite teachers by email, send an invitation
 * again, cancel it, and see who has joined.
 */
export default function Teachers({ teachers, invitations }: Props) {
  const t = useT()

  const columns: DataColumn<Teacher>[] = [
    {
      id: 'name',
      header: t('auth.fields.name'),
      primary: true,
      cell: (teacher) => <span className="font-semibold">{teacher.name}</span>,
    },
    {
      id: 'email',
      header: t('auth.fields.email'),
      cell: (teacher) => <span className="break-all">{teacher.email}</span>,
    },
    {
      id: 'joined',
      header: t('accounts.teachers.joined_title'),
      cell: (teacher) => formatShortDate(teacher.startedOn),
    },
  ]

  return (
    <>
      <PageHeader title={t('accounts.teachers.title')} description={t('accounts.teachers.intro')} />

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
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
                <Button type="submit" disabled={processing} className="w-full sm:w-auto">
                  {processing
                    ? t('accounts.teachers.inviting')
                    : t('accounts.teachers.invite_action')}
                </Button>
              </>
            )}
          </Form>
        </Section>

        <div className="min-w-0 space-y-4">
          <Section title={t('accounts.teachers.invitations_title')}>
            {invitations.length === 0 ? (
              <EmptyState
                compact
                icon="mail"
                description={t('accounts.teachers.invitations_empty')}
              />
            ) : (
              <ul className="divide-y">
                {invitations.map((invitation) => (
                  <li
                    key={invitation.publicId}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-semibold break-all">{invitation.email}</p>
                      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                        <StatusChip tone={stateTone[invitation.state]}>
                          {t(`accounts.invitation_states.${invitation.state}`)}
                        </StatusChip>
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
                      <ConfirmAction
                        action={`/guru/undangan/${invitation.publicId}/batal`}
                        label={t('accounts.teachers.cancel')}
                        variant="ghost"
                        size="sm"
                        title={t('accounts.teachers.cancel_confirm', { email: invitation.email })}
                        description={t('accounts.teachers.cancel_confirm_body')}
                        confirmLabel={t('accounts.teachers.cancel_confirm_action')}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t('accounts.teachers.list_title')}>
            <DataTable
              rows={teachers}
              columns={columns}
              getRowId={(teacher) => teacher.publicId}
              caption={t('accounts.teachers.list_title')}
              empty={
                <EmptyState compact icon="teachers" description={t('accounts.teachers.empty')} />
              }
            />
          </Section>
        </div>
      </div>
    </>
  )
}
