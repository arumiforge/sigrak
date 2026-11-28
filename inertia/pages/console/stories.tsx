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
  schoolName: string
  status: 'draft' | 'published'
  updatedAt: string
}

/**
 * Konsol /cerita-sekolah (R2-05): school stories for sigrak.com, newest
 * change first. Ability `stories.manage`.
 */
export default function ConsoleStories({ stories }: { stories: Row[] }) {
  const t = useT()

  const columns: DataColumn<Row>[] = [
    {
      id: 'title',
      header: t('publishing.stories.list.col_title'),
      primary: true,
      cell: (row) => (
        <Link
          href={`/cerita-sekolah/${row.id}`}
          prefetch
          className="font-semibold break-words text-brand-strong hover:underline"
        >
          {row.title}
        </Link>
      ),
    },
    {
      id: 'school',
      header: t('publishing.stories.list.col_school'),
      cell: (row) => <span className="break-words">{row.schoolName}</span>,
    },
    {
      id: 'status',
      header: t('publishing.stories.list.col_status'),
      cell: (row) => (
        <StatusChip tone={row.status === 'published' ? 'ok' : 'neutral'}>
          {t(`publishing.statuses.${row.status}`)}
        </StatusChip>
      ),
    },
    {
      id: 'updated',
      header: t('publishing.stories.list.col_updated'),
      cell: (row) => <span className="text-sm">{formatDateTime(row.updatedAt)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title={t('publishing.stories.list.title')}
        description={t('publishing.stories.list.intro')}
        actions={
          <Button asChild>
            <Link href="/cerita-sekolah/baru" prefetch>
              <Icon name="add" />
              {t('publishing.stories.list.add')}
            </Link>
          </Button>
        }
      />
      <DataTable
        rows={stories}
        columns={columns}
        getRowId={(row) => String(row.id)}
        caption={t('publishing.stories.list.caption')}
        empty={<EmptyState icon="story" description={t('publishing.stories.list.empty')} />}
        rowActions={(row) => (
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/cerita-sekolah/${row.id}`}
              prefetch
              aria-label={t('publishing.stories.list.open_label', { title: row.title })}
            >
              {t('publishing.announcements.list.open')}
            </Link>
          </Button>
        )}
      />
    </>
  )
}
