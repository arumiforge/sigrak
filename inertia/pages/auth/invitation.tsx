import { Form, Head, Link, usePage } from '@inertiajs/react'
import { TextField } from '~/components/text_field'
import { PasswordField } from '~/components/password_field'
import { SignOutButton } from '~/components/sign_out_button'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

type Role = 'principal' | 'operator' | 'teacher'

type Props = {
  /** Null for an unknown, used or expired link (one neutral page). */
  invitation: {
    mode: 'new_account' | 'sign_in' | 'join' | 'other_account'
    email: string
    schoolName: string
    role: Role
  } | null
}

/**
 * /undangan/{token} (D-182, D-459): accept an invitation with a new
 * account, with the existing account of the invited email (it keeps its
 * documents), or with the open session of that account.
 */
export default function Invitation({ invitation }: Props) {
  const t = useT()
  const { url } = usePage()

  if (!invitation) {
    return (
      <>
        <Head title={t('accounts.invitation.invalid_title')} />
        <h1 className="text-2xl font-bold">{t('accounts.invitation.invalid_title')}</h1>
        <p className="mt-2 text-muted">{t('accounts.invitation.invalid_body')}</p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link href="/masuk">{t('accounts.invitation.to_login')}</Link>
        </Button>
      </>
    )
  }

  const { mode, email, schoolName, role } = invitation
  const values = { school: schoolName, role: t(`accounts.roles.${role}`).toLowerCase(), email }

  return (
    <>
      <Head title={t('accounts.invitation.title')} />
      <h1 className="text-2xl font-bold">{t('accounts.invitation.title')}</h1>
      <p className="mt-2 text-lg">{t('accounts.invitation.intro', values)}</p>
      <p className="mt-1 text-sm text-muted">{t('accounts.invitation.for_email', values)}</p>

      {mode === 'other_account' ? (
        <div className="mt-6 space-y-4">
          <p>{t('accounts.invitation.other_account_body', values)}</p>
          <SignOutButton />
        </div>
      ) : (
        <Form
          action={url}
          method="post"
          resetOnError={['password', 'password_confirmation']}
          className="mt-6 space-y-4"
        >
          {({ errors, processing }) => (
            <>
              {mode === 'new_account' && (
                <>
                  <p>{t('accounts.invitation.new_account')}</p>
                  <input
                    type="email"
                    name="username"
                    value={email}
                    autoComplete="username"
                    readOnly
                    hidden
                  />
                  <TextField
                    label={t('auth.fields.name')}
                    name="name"
                    autoComplete="name"
                    required
                    autoFocus
                    error={errors.name}
                  />
                  <PasswordField
                    label={t('auth.fields.password')}
                    name="password"
                    autoComplete="new-password"
                    required
                    hint={t('auth.fields.password_hint')}
                    error={errors.password}
                  />
                  <PasswordField
                    label={t('auth.fields.password_confirmation')}
                    name="password_confirmation"
                    autoComplete="new-password"
                    required
                    error={errors.password_confirmation}
                  />
                </>
              )}
              {mode === 'sign_in' && (
                <>
                  <p>{t('accounts.invitation.sign_in')}</p>
                  <TextField
                    label={t('auth.fields.email')}
                    name="username"
                    type="email"
                    value={email}
                    autoComplete="username"
                    readOnly
                  />
                  <PasswordField
                    label={t('auth.fields.password')}
                    name="password"
                    autoComplete="current-password"
                    required
                    autoFocus
                    error={errors.password}
                  />
                </>
              )}
              {mode === 'join' && <p>{t('accounts.invitation.join', values)}</p>}

              <Button type="submit" className="w-full" disabled={processing}>
                {processing
                  ? t('accounts.invitation.accepting')
                  : mode === 'join'
                    ? t('accounts.invitation.join_action')
                    : t('accounts.invitation.accept')}
              </Button>
            </>
          )}
        </Form>
      )}

      {mode === 'sign_in' && (
        <p className="mt-6 text-sm">
          <Link href="/lupa-kata-sandi" className="font-semibold text-brand-strong underline">
            {t('auth.links.forgot_password')}
          </Link>
        </p>
      )}
    </>
  )
}

