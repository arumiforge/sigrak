import type { ReactNode } from 'react'
import { Form, Head, Link, usePage } from '@inertiajs/react'
import AuthLayout from '~/layouts/auth_layout'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

type Props = {
  valid: boolean
  email: string | null
  signedIn: boolean
}

/**
 * /konfirmasi-email/{token}: confirm the sign-up email with one press
 * (D-469). An unknown, used or expired link shows one neutral message.
 */
export default function ConfirmEmail({ valid, email, signedIn }: Props) {
  const t = useT()
  const { url } = usePage()

  if (!valid) {
    return (
      <>
        <Head title={t('auth.confirm.invalid_title')} />
        <h1 className="text-2xl font-bold">{t('auth.confirm.invalid_title')}</h1>
        <p className="mt-2 text-muted">{t('auth.confirm.invalid_body')}</p>
        <Button asChild className="mt-6 w-full">
          <Link href={signedIn ? '/akun' : '/masuk'}>
            {signedIn ? t('nav.account') : t('auth.links.login')}
          </Link>
        </Button>
      </>
    )
  }

  return (
    <>
      <Head title={t('auth.confirm.title')} />
      <h1 className="text-2xl font-bold">{t('auth.confirm.title')}</h1>
      <p className="mt-2 text-muted">{t('auth.confirm.intro', { email: email ?? '' })}</p>

      <Form action={url} method="post" className="mt-6">
        {({ processing }) => (
          <Button type="submit" className="w-full" disabled={processing}>
            {processing ? t('auth.confirm.submitting') : t('auth.confirm.submit')}
          </Button>
        )}
      </Form>
    </>
  )
}

ConfirmEmail.layout = (page: ReactNode) => <AuthLayout>{page}</AuthLayout>
