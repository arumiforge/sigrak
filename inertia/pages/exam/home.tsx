import type { ReactNode } from 'react'
import { Head } from '@inertiajs/react'
import PlainLayout from '~/layouts/plain_layout'
import { useT } from '~/lib/i18n'

type Props = {
  username: string
  sessionTitle: string
}

export default function ExamHome({ username, sessionTitle }: Props) {
  const t = useT()

  return (
    <>
      <Head title={t('areas.exam.title')} />
      <h1 className="text-2xl font-bold">{t('areas.exam.title')}</h1>
      <p className="mt-2">{t('areas.exam.greeting', { username })}</p>
      <p className="mt-1 text-muted">{t('areas.exam.session', { title: sessionTitle })}</p>
      <p className="mt-4">{t('areas.exam.waiting')}</p>
    </>
  )
}

ExamHome.layout = (page: ReactNode) => <PlainLayout>{page}</PlainLayout>
