import { Link } from '@inertiajs/react'
import { DataTable, type DataColumn } from '~/components/patterns/data_table'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { formatDateTime } from '~/lib/format'
import { useT } from '~/lib/i18n'

type Row = {
  id: number
  title: string
  status: 'draft' | 'published'
  past: boolean
  startsAt: string
  place: string | null
  online: boolean
}

/**
 * Konsol /acara (R2-05): webinars, workshops and visits for
 * sigrak.com/acara, newest date first. Ability `events.manage`.
 */
export default function ConsoleEvents({ events }: { events: Row[] }) {
  const t = useT()

  const columns: DataColumn<Row>[] = [
    {
      id: 'title',
      header: t('publishing.events.list.col_title'),
      primary: true,
      cell: (row) => (
        <Link
          href={`/acara/${row.id}`}
          prefetch
          className="font-semibold break-words text-brand-strong hover:underline"
        >
          {row.title}
        </Link>
      ),
    },
    {
      id: 'when',
      header: t('publishing.events.list.col_when'),
      cell: (row) => <span className="text-sm">{formatDateTime(row.startsAt)}</span>,
    },
    {
      id: 'where',
      header: t('publishing.events.list.col_where'),
      cell: (row) =>
        [row.place, row.online ? t('publishing.events.list.online') : null]
          .filter(Boolean)
          .join(' · '),
    },
    {
      id: 'status',
      header: t('publishing.events.list.col_status'),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          <StatusChip tone={row.status === 'published' ? 'ok' : 'neutral'}>
            {t(`publishing.statuses.${row.status}`)}
          </StatusChip>
          {row.past && <StatusChip tone="neutral">{t('publishing.events.list.past')}</StatusChip>}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('publishing.events.list.title')}
        description={t('publishing.events.list.intro')}
        actions={
          <Button asChild>
            <Link href="/acara/baru" prefetch>
              <Icon name="add" />
              {t('publishing.events.list.add')}
            </Link>
          </Button>
        }
      />
      <DataTable
        rows={events}
        columns={columns}
        getRowId={(row) => String(row.id)}
        caption={t('publishing.events.list.caption')}
        empty={<EmptyState icon="event" description={t('publishing.events.list.empty')} />}
        rowActions={(row) => (
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/acara/${row.id}`}
              prefetch
              aria-label={t('publishing.events.list.open_label', { title: row.title })}
            >
              {t('publishing.announcements.list.open')}
            </Link>
          </Button>
        )}
      />
    </>
  )
}
