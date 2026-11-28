import { Link } from '@inertiajs/react'
import { DataTable, type DataColumn } from '~/components/patterns/data_table'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip, type StatusTone } from '~/components/patterns/status_chip'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { formatDateTime } from '~/lib/format'
import { useT } from '~/lib/i18n'

type Row = {
  id: number
  title: string
  kind: string
  showInApp: boolean
  showPublic: boolean
  state: 'draft' | 'scheduled' | 'live' | 'ended'
  startsAt: string | null
  endsAt: string | null
  updatedAt: string
}

type Props = {
  announcements: Row[]
  can: { write: boolean }
}

const stateTone: Record<Row['state'], StatusTone> = {
  draft: 'neutral',
  scheduled: 'info',
  live: 'ok',
  ended: 'neutral',
}

/**
 * Konsol /kabar (R2-05): the Kabar this staff member may hold, newest
 * change first, with where each shows and its state. Abilities
 * `announcements.manage`, `announcements.write`, `announcements.public`.
 */
export default function ConsoleAnnouncements({ announcements, can }: Props) {
  const t = useT()

  const windowText = (row: Row) => {
    if (row.startsAt && row.endsAt) {
      return `${formatDateTime(row.startsAt)} – ${formatDateTime(row.endsAt)}`
    }
    if (row.startsAt) {
      return t('publishing.announcements.list.from', { date: formatDateTime(row.startsAt) })
    }
    if (row.endsAt) {
      return t('publishing.announcements.list.until', { date: formatDateTime(row.endsAt) })
    }
    return t('publishing.announcements.list.always')
  }

  const columns: DataColumn<Row>[] = [
    {
      id: 'title',
      header: t('publishing.announcements.list.col_title'),
      primary: true,
      cell: (row) => (
        <Link
          href={`/kabar/${row.id}`}
          prefetch
          className="font-semibold break-words text-brand-strong hover:underline"
        >
          {row.title}
        </Link>
      ),
    },
    {
      id: 'kind',
      header: t('publishing.announcements.list.col_kind'),
      cell: (row) => t(`publishing.kinds.${row.kind}`),
    },
    {
      id: 'where',
      header: t('publishing.announcements.list.col_where'),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.showInApp && (
            <StatusChip tone="brand">{t('publishing.announcements.list.where_app')}</StatusChip>
          )}
          {row.showPublic && (
            <StatusChip tone="info">{t('publishing.announcements.list.where_public')}</StatusChip>
          )}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('publishing.announcements.list.col_status'),
      cell: (row) => (
        <StatusChip tone={stateTone[row.state]}>{t(`publishing.statuses.${row.state}`)}</StatusChip>
      ),
    },
    {
      id: 'window',
      header: t('publishing.announcements.list.col_window'),
      cell: (row) => <span className="text-sm">{windowText(row)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title={t('publishing.announcements.list.title')}
        description={t('publishing.announcements.list.intro')}
        actions={
          can.write && (
            <Button asChild>
              <Link href="/kabar/baru" prefetch>
                <Icon name="add" />
                {t('publishing.announcements.list.add')}
              </Link>
            </Button>
          )
        }
      />
      <DataTable
        rows={announcements}
        columns={columns}
        getRowId={(row) => String(row.id)}
        caption={t('publishing.announcements.list.caption')}
        empty={<EmptyState icon="news" description={t('publishing.announcements.list.empty')} />}
        rowActions={(row) => (
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/kabar/${row.id}`}
              prefetch
              aria-label={t('publishing.announcements.list.open_label', { title: row.title })}
            >
              {t('publishing.announcements.list.open')}
            </Link>
          </Button>
        )}
      />
    </>
  )
}
