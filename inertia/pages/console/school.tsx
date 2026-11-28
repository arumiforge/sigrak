import { Form } from '@inertiajs/react'
import { ConfirmAction } from '~/components/patterns/confirm_dialog'
import { PageHeader } from '~/components/patterns/page_header'
import { Section, SelectField } from '~/components/section'
import { TextField } from '~/components/text_field'
import { TrialForm } from '~/components/trial_form'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatShortDate } from '~/lib/format'

type Role = 'principal' | 'operator' | 'teacher'

type Props = {
  school: {
    id: number
    name: string
    npsn: string | null
    level: 'sd' | 'mi'
    trialDays: number | null
    trialExtendedUntil: string | null
  }
  defaultTrialDays: number
  members: {
    publicId: string
    name: string
    email: string
    role: Role
    status: 'active' | 'ended'
    startedOn: string
  }[]
  invitations: {
    publicId: string
    email: string
    role: Role
    state: 'open' | 'expired' | 'accepted'
    sentAt: string
    expiresAt: string
  }[]
  can: { manageInvitations: boolean; manageTrials: boolean }
}

/**
 * Konsol /sekolah/{id}: members, invitations (invite any role, send
 * again, cancel) and the school's trial length (D-182, D-459).
 */
export default function ConsoleSchool({
  school,
  defaultTrialDays,
  members,
  invitations,
  can,
}: Props) {
  const t = useT()
  const base = `/sekolah/${school.id}`

  return (
    <>
      <PageHeader
        title={school.name}
        back={{ href: '/sekolah', label: t('console.school.back') }}
        description={`${t(`console.levels.${school.level}`)} · ${
          school.npsn
            ? t('console.schools.npsn', { npsn: school.npsn })
            : t('console.schools.no_npsn')
        }`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t('console.school.members_title')}>
          {members.length === 0 ? (
            <p className="text-muted">{t('console.school.members_empty')}</p>
          ) : (
            <ul className="divide-y">
              {members.map((member) => (
                <li key={member.publicId} className="py-3">
                  <p className="font-semibold">{member.name}</p>
                  <p className="text-sm break-all text-muted">{member.email}</p>
                  <p className="text-xs text-muted">
                    {t(`accounts.roles.${member.role}`)} · {t(`accounts.statuses.${member.status}`)}{' '}
                    · {t('console.school.since', { date: formatShortDate(member.startedOn) })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="space-y-4">
          {can.manageInvitations && (
            <Section
              title={t('console.school.invite_title')}
              description={t('console.school.invite_intro')}
            >
              <Form
                action={`${base}/undangan`}
                method="post"
                resetOnSuccess
                options={{ preserveScroll: true }}
                className="space-y-3"
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
                      error={errors.email}
                    />
                    <SelectField
                      label={t('console.school.role_label')}
                      name="role"
                      defaultValue="operator"
                      error={errors.role}
                      options={(['operator', 'principal', 'teacher'] as const).map((role) => ({
                        value: role,
                        label: t(`accounts.roles.${role}`),
                      }))}
                    />
                    <Button type="submit" disabled={processing}>
                      {t('console.school.invite_action')}
                    </Button>
                  </>
                )}
              </Form>
            </Section>
          )}

          <Section title={t('console.school.invitations_title')}>
            {invitations.length === 0 ? (
              <p className="text-muted">{t('console.school.invitations_empty')}</p>
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
                        {t(`accounts.roles.${invitation.role}`)} ·{' '}
                        {t(`accounts.invitation_states.${invitation.state}`)} ·{' '}
                        {t('accounts.teachers.expires_on', {
                          date: formatShortDate(invitation.expiresAt),
                        })}
                      </p>
                    </div>
                    {can.manageInvitations && (
                      <div className="flex gap-2">
                        <Form
                          action={`${base}/undangan/${invitation.publicId}/kirim-ulang`}
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
                          action={`${base}/undangan/${invitation.publicId}/batal`}
                          label={t('accounts.teachers.cancel')}
                          variant="ghost"
                          size="sm"
                          title={t('accounts.teachers.cancel_confirm', { email: invitation.email })}
                          description={t('accounts.teachers.cancel_confirm_body')}
                          confirmLabel={t('accounts.teachers.cancel_confirm_action')}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t('console.trial.title')} description={t('console.trial.school_intro')}>
            <p className="mb-3" data-testid="school-trial">
              {school.trialDays
                ? t('console.trial.current_school', { days: school.trialDays })
                : t('console.trial.current_default', { days: defaultTrialDays })}
            </p>
            {school.trialExtendedUntil && (
              <p className="mb-3" data-testid="school-trial-extension">
                {new Date(school.trialExtendedUntil) > new Date()
                  ? t('accounts.trial.school_extended', {
                      date: formatShortDate(school.trialExtendedUntil),
                    })
                  : t('accounts.trial.school_extension_ended', {
                      date: formatShortDate(school.trialExtendedUntil),
                    })}
              </p>
            )}
            {can.manageTrials && (
              <p className="mb-3 text-sm text-muted">{t('accounts.trial.school_extend_hint')}</p>
            )}
            {can.manageTrials && <TrialForm action={`${base}/uji-coba`} />}
          </Section>
        </div>
      </div>
    </>
  )
}

