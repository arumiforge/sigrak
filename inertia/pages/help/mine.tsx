import { Link } from '@inertiajs/react'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { HelpStatusChip } from '~/components/help/help_status_chip'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatShortDate } from '~/lib/format'

type Props = {
  requests: {
    publicId: string
    category: string
    status: string
    excerpt: string
    createdAt: string
    unread: boolean
    replies: number
  }[]
}

/**
 * /bantuan-saya (R2-06, D-320): the user's own requests with their
 * status chip (Baru, Diproses, Selesai) and a mark on those with news
 * they have not opened.
 */
export default function MyHelp({ requests }: Props) {
  const t = useT()
  const ask = (
    <Button asChild>
      <Link href="/minta-bantuan">
        <Icon name="help" />
        {t('help.mine.ask')}
      </Link>
    </Button>
  )

  return (
    <>
      <PageHeader title={t('help.mine.title')} description={t('help.mine.intro')} actions={ask} />

      {requests.length === 0 ? (
        <EmptyState icon="inbox" description={t('help.mine.empty')} />
      ) : (
        <ul aria-label={t('help.mine.caption')} className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.publicId}>
              <Link
                href={`/bantuan-saya/${request.publicId}`}
                className="block rounded-lg border bg-surface p-4 hover:border-brand hover:bg-brand-tint/40"
                data-testid="help-request"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <HelpStatusChip status={request.status} />
                  {request.unread && (
                    <StatusChip tone="brand" icon="info">
                      {t('help.mine.unread')}
                    </StatusChip>
                  )}
                  <span className="text-sm font-semibold">
                    {t(`help.categories.${request.category}`)}
                  </span>
                </div>
                <p className="mt-2 break-words">{request.excerpt}</p>
                <p className="mt-2 text-sm text-muted">
                  {t('help.mine.sent_on', { date: formatShortDate(request.createdAt) })} ·{' '}
                  {request.replies > 0
                    ? t('help.mine.replies', { count: request.replies })
                    : t('help.mine.no_replies')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
