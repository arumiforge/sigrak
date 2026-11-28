import { PageHeader } from '~/components/patterns/page_header'
import { RichText } from '~/components/publishing/rich_text'
import { formatDateTime } from '~/lib/format'
import { useT } from '~/lib/i18n'

type Props = {
  announcement: {
    slug: string
    title: string
    kind: string
    shownAt: string
    html: string
  }
}

/**
 * App /kabar/{slug} (R2-05): one Kabar, rendered on the server by the
 * safe Markdown renderer. Opening it marks it read.
 */
export default function Announcement({ announcement }: Props) {
  const t = useT()
  return (
    <article>
      <PageHeader
        title={announcement.title}
        back={{ href: '/kabar', label: t('publishing.app.back') }}
        description={
          <>
            {t('publishing.app.from_team')} · {t(`publishing.kinds.${announcement.kind}`)} ·{' '}
            <time dateTime={announcement.shownAt}>{formatDateTime(announcement.shownAt)}</time>
          </>
        }
      />
      <div className="rounded-lg border bg-surface p-4 sm:p-6">
        <RichText html={announcement.html} />
      </div>
    </article>
  )
}
