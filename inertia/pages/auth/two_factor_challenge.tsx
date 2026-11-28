import { Form, Head, Link } from '@inertiajs/react'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

/**
 * admin. /masuk/kode (R2-02, D-343): after a right password, the
 * 6-digit code from the authenticator app. There are no recovery
 * codes; a lost phone goes to an admin.
 */
export default function TwoFactorChallenge() {
  const t = useT()

  return (
    <>
      <Head title={t('two_factor.challenge.title')} />
      <h1 className="text-2xl font-bold">{t('two_factor.challenge.title')}</h1>
      <p className="mt-2 text-muted">{t('two_factor.challenge.intro')}</p>

      <Form
        action="/masuk/kode"
        method="post"
        resetOnError={['code']}
        className="mt-6 space-y-4"
        onError={() => document.querySelector<HTMLInputElement>('input[name="code"]')?.focus()}
      >
        {({ errors, processing }) => (
          <>
            <TextField
              label={t('two_factor.challenge.code')}
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              required
              autoFocus
              className="text-lg tracking-[0.3em] tabular-nums"
              hint={t('two_factor.challenge.code_hint')}
              error={errors.code}
            />
            <Button type="submit" className="w-full" disabled={processing}>
              {processing ? t('two_factor.challenge.submitting') : t('two_factor.challenge.submit')}
            </Button>
          </>
        )}
      </Form>

      <div className="mt-6 space-y-3 text-sm">
        <p className="text-muted">{t('two_factor.challenge.lost')}</p>
        <p>
          <Link href="/masuk" className="font-semibold text-brand-strong underline">
            {t('two_factor.challenge.other_account')}
          </Link>
        </p>
      </div>
    </>
  )
}
