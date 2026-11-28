import { Head } from '@inertiajs/react'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

type Props = {
  kind: 'forbidden' | 'not_found' | 'server_error'
}

/**
 * Friendly error page with a way back (Fondasi web-baseline §10). A
 * plain link, not an Inertia visit, so the home page loads afresh.
 */
export default function ErrorPage({ kind }: Props) {
  const t = useT()

  return (
    <>
      <Head title={t(`errors.${kind}.title`)} />
      <span
        aria-hidden
        className="inline-flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand-strong"
      >
        <Icon name={kind === 'server_error' ? 'warning' : 'info'} size={24} />
      </span>
      <h1 className="mt-4 text-2xl font-bold sm:text-3xl">{t(`errors.${kind}.title`)}</h1>
      <p className="mt-2 text-muted">{t(`errors.${kind}.body`)}</p>
      <Button asChild className="mt-6">
        <a href="/">{t('errors.home')}</a>
      </Button>
    </>
  )
}
