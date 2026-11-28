import type { ReactNode } from 'react'
import { Form, Head, Link } from '@inertiajs/react'
import AppLayout from '~/layouts/app_layout'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { PasswordField } from '~/components/password_field'
import { Button } from '~/components/ui/button'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'
import { formatShortDate } from '~/lib/format'
import { cn } from '~/lib/utils'

type Role = 'principal' | 'operator' | 'teacher'

type Props = {
  profile: { name: string; email: string; nip: string | null; emailVerified: boolean }
  memberships: { publicId: string; role: Role; schoolName: string; active: boolean }[]
  trial: {
    started: boolean
    active: boolean
    days: number
    daysLeft: number
    endsAt: string | null
  }
}

/**
 * /akun: name and NIP, password, roles (with the switch) and the trial
 * (D-183, D-459). The email is shown read-only.
 */
export default function Account({ profile, memberships, trial }: Props) {
  const t = useT()

  return (
    <>
      <Head title={t('accounts.account.title')} />
      <h1 className="text-2xl font-bold">{t('accounts.account.title')}</h1>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Section title={t('accounts.account.profile_title')}>
          <Form
            action="/akun"
            method="post"
            className="space-y-4"
            options={{ preserveScroll: true }}
          >
            {({ errors, processing }) => (
              <>
                <TextField
                  label={t('auth.fields.name')}
                  name="name"
                  defaultValue={profile.name}
                  autoComplete="name"
                  required
                  error={errors.name}
                />
                <TextField
                  label={t('auth.fields.email')}
                  type="email"
                  value={profile.email}
                  readOnly
                  hint={
                    profile.emailVerified
                      ? t('accounts.account.email_hint')
                      : `${t('accounts.account.email_hint')} ${t('accounts.account.email_unverified')}`
                  }
                />
                <TextField
                  label={t('accounts.account.nip')}
                  name="nip"
                  defaultValue={profile.nip ?? ''}
                  inputMode="numeric"
                  maxLength={18}
                  hint={t('accounts.account.nip_hint')}
                  error={errors.nip}
                />
                <Button type="submit" disabled={processing}>
                  {t('accounts.account.save_profile')}
                </Button>
              </>
            )}
          </Form>
          {!profile.emailVerified && (
            <Form
              action="/akun/konfirmasi-email"
              method="post"
              options={{ preserveScroll: true }}
              className="mt-4 border-t pt-4"
            >
              {({ processing }) => (
                <Button type="submit" variant="outline" disabled={processing}>
                  <Icon name="mail" />
                  {processing ? t('auth.confirm.sending') : t('auth.confirm.resend')}
                </Button>
              )}
            </Form>
          )}
        </Section>

        <div className="space-y-4">
          <Section title={t('accounts.account.trial_title')}>
            <p data-testid="trial-status">
              {!trial.started || !trial.endsAt
                ? t('accounts.account.trial_not_started')
                : trial.active
                  ? t('accounts.account.trial_active', {
                      date: formatShortDate(trial.endsAt),
                      days: trial.daysLeft,
                    })
                  : t('accounts.account.trial_ended', { date: formatShortDate(trial.endsAt) })}
            </p>
          </Section>

          <Section title={t('accounts.account.roles_title')}>
            {memberships.length === 0 ? (
              <p className="text-muted">{t('accounts.account.no_roles')}</p>
            ) : (
              <>
                <ul className="divide-y">
                  {memberships.map((membership) => (
                    <li
                      key={membership.publicId}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span>
                        <span className="font-semibold">
                          {t(`accounts.roles.${membership.role}`)}
                        </span>
                        <span className="text-muted"> · {membership.schoolName}</span>
                      </span>
                      {membership.active && (
                        <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-strong">
                          {t('accounts.account.active_role')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {memberships.length > 1 && (
                  <Button asChild variant="outline" className="mt-4">
                    <Link href="/ganti-peran">
                      <Icon name="switch" />
                      {t('nav.switch_role')}
                    </Link>
                  </Button>
                )}
              </>
            )}
          </Section>
        </div>

        <Section title={t('accounts.account.password_title')} className={cn('lg:col-span-1')}>
          <Form
            action="/akun/kata-sandi"
            method="post"
            resetOnSuccess
            resetOnError={['current_password', 'password', 'password_confirmation']}
            options={{ preserveScroll: true }}
            className="space-y-4"
          >
            {({ errors, processing }) => (
              <>
                <input
                  type="email"
                  name="username"
                  value={profile.email}
                  autoComplete="username"
                  readOnly
                  hidden
                />
                <PasswordField
                  label={t('accounts.account.current_password')}
                  name="current_password"
                  autoComplete="current-password"
                  required
                  error={errors.current_password}
                />
                <PasswordField
                  label={t('auth.fields.new_password')}
                  name="password"
                  autoComplete="new-password"
                  required
                  hint={t('auth.fields.password_hint')}
                  error={errors.password}
                />
                <PasswordField
                  label={t('auth.fields.new_password_confirmation')}
                  name="password_confirmation"
                  autoComplete="new-password"
                  required
                  error={errors.password_confirmation}
                />
                <Button type="submit" disabled={processing}>
                  {t('accounts.account.save_password')}
                </Button>
              </>
            )}
          </Form>
        </Section>
      </div>
    </>
  )
}

Account.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>
