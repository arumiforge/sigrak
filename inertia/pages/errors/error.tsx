import { Head } from '@inertiajs/react'
import { useT } from '~/lib/i18n'

type Props = {
  kind: 'forbidden' | 'not_found' | 'server_error'
}

/**
 * Friendly error page with a way back (Fondasi web-baseline §10).
 */
export default function ErrorPage({ kind }: Props) {
  const t = useT()

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Head title={t(`errors.${kind}.title`)} />
      <h1 className="text-2xl font-bold">{t(`errors.${kind}.title`)}</h1>
      <p className="mt-2 text-muted">{t(`errors.${kind}.body`)}</p>
      <a
        href="/"
        className="mt-6 inline-flex min-h-11 items-center font-semibold text-brand underline"
      >
        {t('errors.home')}
      </a>
    </main>
  )
}
