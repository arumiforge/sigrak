import { Form, Head, Link, usePage } from '@inertiajs/react'
import { PasswordField } from '~/components/password_field'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

type Props = {
  valid: boolean
  email: string | null
}

/**
 * /kata-sandi-baru/{token}: set a new password from the mailed link.
 * An unknown, used or expired link shows one neutral message.
 */
export default function ResetPassword({ valid, email }: Props) {
  const t = useT()
  const { url } = usePage()

  if (!valid) {
    return (
      <>
        <Head title={t('auth.reset.invalid_title')} />
        <h1 className="text-2xl font-bold">{t('auth.reset.invalid_title')}</h1>
        <p className="mt-2 text-muted">{t('auth.reset.invalid_body')}</p>
        <Button asChild className="mt-6 w-full">
          <Link href="/lupa-kata-sandi">{t('auth.reset.request_new')}</Link>
        </Button>
      </>
    )
  }

  return (
    <>
      <Head title={t('auth.titles.reset_password')} />
      <h1 className="text-2xl font-bold">{t('auth.titles.reset_password')}</h1>
      <p className="mt-2 text-muted">{t('auth.reset.intro', { email: email ?? '' })}</p>

      <Form
        action={url}
        method="post"
        resetOnError={['password', 'password_confirmation']}
        className="mt-6 space-y-4"
      >
        {({ errors, processing }) => (
          <>
            {/* Lets password managers save the new password for the right account. */}
            <input
              type="email"
              name="username"
              value={email ?? ''}
              autoComplete="username"
              readOnly
              hidden
            />
            <PasswordField
              label={t('auth.fields.new_password')}
              name="password"
              autoComplete="new-password"
              required
              autoFocus
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
            <Button type="submit" className="w-full" disabled={processing}>
              {processing ? t('auth.reset.saving') : t('auth.reset.submit')}
            </Button>
          </>
        )}
      </Form>
    </>
  )
}

