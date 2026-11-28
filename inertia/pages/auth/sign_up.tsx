import { Form, Head, Link } from '@inertiajs/react'
import { TextField } from '~/components/text_field'
import { PasswordField } from '~/components/password_field'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

/**
 * /daftar (D-459): a teacher signs up alone and starts the free trial.
 */
export default function SignUp() {
  const t = useT()

  return (
    <>
      <Head title={t('auth.titles.sign_up')} />
      <h1 className="text-2xl font-bold">{t('auth.titles.sign_up')}</h1>
      <p className="mt-2 text-muted">{t('auth.sign_up.intro')}</p>

      <Form
        action="/daftar"
        method="post"
        resetOnError={['password', 'password_confirmation']}
        className="mt-6 space-y-4"
      >
        {({ errors, processing }) => (
          <>
            <TextField
              label={t('auth.fields.name')}
              name="name"
              autoComplete="name"
              required
              autoFocus
              error={errors.name}
            />
            <TextField
              label={t('auth.fields.email')}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              error={errors.email}
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
            <Button type="submit" className="w-full" disabled={processing}>
              {processing ? t('auth.sign_up.submitting') : t('auth.sign_up.submit')}
            </Button>
          </>
        )}
      </Form>

      <p className="mt-6 text-sm text-muted">
        {t('auth.links.has_account')}{' '}
        <Link href="/masuk" className="font-semibold text-brand-strong underline">
          {t('auth.links.login')}
        </Link>
      </p>
    </>
  )
}
