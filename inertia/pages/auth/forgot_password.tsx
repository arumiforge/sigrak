import { Form, Head, Link } from '@inertiajs/react'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

/**
 * /lupa-kata-sandi: ask for a link to set a new password. The answer is
 * the same whether or not the email has an account (D-183).
 */
export default function ForgotPassword() {
  const t = useT()

  return (
    <>
      <Head title={t('auth.titles.forgot_password')} />
      <h1 className="text-2xl font-bold">{t('auth.titles.forgot_password')}</h1>
      <p className="mt-2 text-muted">{t('auth.forgot.intro')}</p>

      <Form action="/lupa-kata-sandi" method="post" className="mt-6 space-y-4">
        {({ errors, processing }) => (
          <>
            <TextField
              label={t('auth.fields.email')}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              autoFocus
              error={errors.email}
            />
            <Button type="submit" className="w-full" disabled={processing}>
              {processing ? t('auth.forgot.sending') : t('auth.forgot.submit')}
            </Button>
          </>
        )}
      </Form>

      <p className="mt-6 text-sm">
        <Link href="/masuk" className="font-semibold text-brand-strong underline">
          {t('auth.links.back_to_login')}
        </Link>
      </p>
    </>
  )
}

