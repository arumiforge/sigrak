import { useState } from 'react'
import { Form, Head, Link, usePage } from '@inertiajs/react'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'

type Props = {
  /** email: app. and admin.; exam_card: ujian. */
  kind: 'email' | 'exam_card'
}

/**
 * /masuk on each host. The form posts to the same host, so a login only
 * ever opens the area of that host.
 */
export default function Login({ kind }: Props) {
  const t = useT()
  const { area } = usePage().props
  const [showPassword, setShowPassword] = useState(false)

  const titleKey =
    area === 'admin'
      ? 'auth.titles.staff_login'
      : area === 'exam'
        ? 'auth.titles.exam_login'
        : 'auth.titles.login'
  const introKey =
    area === 'admin'
      ? 'auth.intro.staff_login'
      : area === 'exam'
        ? 'auth.intro.exam_login'
        : 'auth.intro.login'

  return (
    <>
      <Head title={t(titleKey)} />
      <h1 className="text-2xl font-bold">{t(titleKey)}</h1>
      <p className="mt-2 text-muted">{t(introKey)}</p>

      <Form
        action="/masuk"
        method="post"
        resetOnError={['password']}
        setDefaultsOnSuccess
        className="mt-6 space-y-4"
        onError={(errors) => {
          const first = Object.keys(errors)[0]
          if (first) {
            document.querySelector<HTMLInputElement>(`input[name="${first}"]`)?.focus()
          }
        }}
      >
        {({ errors, processing }) => (
          <>
            {kind === 'email' ? (
              <TextField
                label={t('auth.fields.email')}
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                required
                autoFocus
                error={errors.email}
              />
            ) : (
              <TextField
                label={t('auth.fields.username')}
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
                error={errors.username}
              />
            )}
            <TextField
              label={t('auth.fields.password')}
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              error={errors.password}
              trailing={
                <button
                  type="button"
                  className="flex size-11 items-center justify-center text-muted hover:text-text"
                  aria-label={
                    showPassword ? t('auth.actions.hide_password') : t('auth.actions.show_password')
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} />
                </button>
              }
            />
            <Button type="submit" className="w-full" disabled={processing}>
              {processing ? t('auth.actions.logging_in') : t('auth.actions.login')}
            </Button>
          </>
        )}
      </Form>

      {area === 'app' && (
        <div className="mt-6 space-y-3 text-sm">
          <p>
            <Link href="/lupa-kata-sandi" className="font-semibold text-brand-strong underline">
              {t('auth.links.forgot_password')}
            </Link>
          </p>
          <p className="text-muted">
            {t('auth.links.no_account')}{' '}
            <Link href="/daftar" className="font-semibold text-brand-strong underline">
              {t('auth.links.sign_up')}
            </Link>
          </p>
        </div>
      )}
    </>
  )
}
