import { PageHeader } from '~/components/patterns/page_header'
import { useT } from '~/lib/i18n'

type Props = {
  username: string
  sessionTitle: string
}

export default function ExamHome({ username, sessionTitle }: Props) {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('areas.exam.title')}
        description={t('areas.exam.greeting', { username })}
      />
      <section className="rounded-lg border bg-surface p-4 sm:p-6">
        <p className="font-semibold">{t('areas.exam.session', { title: sessionTitle })}</p>
        <p className="mt-2 text-muted">{t('areas.exam.waiting')}</p>
      </section>
    </>
  )
}
