import { Link } from '@inertiajs/react'
import { PageHeader } from '~/components/patterns/page_header'
import { Section } from '~/components/section'
import { HelpStatusChip } from '~/components/help/help_status_chip'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatDateTime, formatShortDate } from '~/lib/format'

type Props = {
  request: {
    publicId: string
    category: string
    status: string
    message: string
    pageUrl: string | null
    createdAt: string
  }
  entries: { kind: 'reply' | 'status'; body: string | null; status: string | null; at: string }[]
}

/**
 * /bantuan-saya/{id} (R2-06, D-320): one of the user's requests, its
 * status and Tim SIGRAK's replies and status changes in order.
 * Opening it marks the news as read.
 */
export default function HelpRequestPage({ request, entries }: Props) {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t(`help.categories.${request.category}`)}
        headTitle={t('help.request.title')}
        back={{ href: '/bantuan-saya', label: t('help.request.back') }}
        meta={t('help.request.sent_on', { date: formatShortDate(request.createdAt) })}
        actions={
          <Button asChild variant="outline">
            <Link href="/minta-bantuan">
              <Icon name="help" />
              {t('help.request.ask_again')}
            </Link>
          </Button>
        }
      >
        <div className="mt-3" data-testid="request-status">
          <HelpStatusChip status={request.status} />
        </div>
      </PageHeader>

      <div className="grid max-w-3xl gap-4">
        <Section title={t('help.request.your_message')}>
          <p className="break-words whitespace-pre-line">{request.message}</p>
          {request.pageUrl && (
            <p className="mt-3 text-sm text-muted">
              {t('help.request.page')}: <span className="break-all">{request.pageUrl}</span>
            </p>
          )}
        </Section>

        <Section title={t('help.request.timeline')}>
          {entries.length === 0 ? (
            <p className="text-muted">{t('help.request.empty')}</p>
          ) : (
            <ol className="space-y-3">
              {entries.map((entry, index) =>
                entry.kind === 'status' ? (
                  <li
                    key={index}
                    className="flex flex-wrap items-center gap-2 text-sm text-muted"
                    data-testid="timeline-status"
                  >
                    <Icon name="info" size={16} />
                    <span>
                      {t('help.request.status_changed', {
                        status: t(`help.statuses.${entry.status}`),
                      })}
                    </span>
                    <span>· {formatDateTime(entry.at)}</span>
                  </li>
                ) : (
                  <li
                    key={index}
                    className="rounded-md border bg-brand-tint/40 p-3"
                    data-testid="timeline-reply"
                  >
                    <p className="text-sm font-semibold">
                      {t('help.request.from_team')}{' '}
                      <span className="font-normal text-muted">· {formatDateTime(entry.at)}</span>
                    </p>
                    <p className="mt-1 break-words whitespace-pre-line">{entry.body}</p>
                  </li>
                )
              )}
            </ol>
          )}
        </Section>
      </div>
    </>
  )
}
