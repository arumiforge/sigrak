import { Link, router } from '@inertiajs/react'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { formatDateTime } from '~/lib/format'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

type Item = {
  slug: string
  title: string
  summary: string
  kind: string
  shownAt: string
  unread: boolean
}

/**
 * App /kabar (R2-05, D-319): Kabar from Tim SIGRAK for the signed-in
 * user, newest first; unread ones are marked and counted in the header
 * badge. Opening a Kabar marks it read.
 */
export default function Announcements({ announcements }: { announcements: Item[] }) {
  const t = useT()
  const unread = announcements.some((item) => item.unread)

  return (
    <>
      <PageHeader
        title={t('publishing.app.title')}
        description={t('publishing.app.intro')}
        actions={
          unread && (
            <Button
              variant="outline"
              onClick={() => router.post('/kabar/tandai-dibaca', {}, { preserveScroll: true })}
            >
              <Icon name="check" />
              {t('publishing.app.mark_all')}
            </Button>
          )
        }
      />
      {announcements.length === 0 ? (
        <EmptyState icon="news" description={t('publishing.app.empty')} />
      ) : (
        <ul className="space-y-3" aria-label={t('publishing.app.caption')}>
          {announcements.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/kabar/${item.slug}`}
                prefetch
                className={cn(
                  'block rounded-lg border bg-surface p-4 transition-colors hover:border-brand sm:p-5',
                  item.unread && 'border-brand/40'
                )}
              >
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  {item.unread && (
                    <StatusChip tone="brand">{t('publishing.app.unread')}</StatusChip>
                  )}
                  <span>{t(`publishing.kinds.${item.kind}`)}</span>
                  <span aria-hidden>·</span>
                  <time dateTime={item.shownAt}>{formatDateTime(item.shownAt)}</time>
                </div>
                <h2
                  className={cn(
                    'mt-2 text-lg break-words',
                    item.unread ? 'font-bold' : 'font-semibold'
                  )}
                >
                  {item.title}
                </h2>
                <p className="mt-1 break-words text-muted">{item.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
