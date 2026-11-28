import { Link } from '@inertiajs/react'
import { DataTable, type DataColumn } from '~/components/patterns/data_table'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatDateTime } from '~/lib/format'

type Session = {
  id: number
  staffName: string
  schoolId: number
  schoolName: string
  startedAt: string
  endedAt: string | null
}

type Props = { page: number; lastPage: number; total: number; sessions: Session[] }

/**
 * Konsol /sesi-bantuan (R2-06, D-341): one row per support session
 * (staff member, school, start, end), newest first. Internal only;
 * ability `support_sessions.view`.
 */
export default function SupportSessions({ page, lastPage, total, sessions }: Props) {
  const t = useT()

  const columns: DataColumn<Session>[] = [
    {
      id: 'school',
      header: t('help.support.school'),
      primary: true,
      cell: (row) => <span className="break-words">{row.schoolName}</span>,
    },
    { id: 'staff', header: t('help.support.staff'), cell: (row) => row.staffName },
    {
      id: 'started',
      header: t('help.support.started'),
      cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.startedAt)}</span>,
    },
    {
      id: 'ended',
      header: t('help.support.ended_at'),
      cell: (row) =>
        row.endedAt ? (
          <span className="whitespace-nowrap">{formatDateTime(row.endedAt)}</span>
        ) : (
          <StatusChip tone="info">{t('help.support.running')}</StatusChip>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('help.support.history_title')}
        description={t('help.support.history_intro')}
      />
      <p className="mb-3 text-sm text-muted">{t('help.support.history_count', { count: total })}</p>
      <DataTable
        rows={sessions}
        columns={columns}
        getRowId={(row) => String(row.id)}
        caption={t('help.support.history_caption')}
        empty={<EmptyState icon="school-view" description={t('help.support.history_empty')} />}
      />
      {lastPage > 1 && (
        <nav
          aria-label={t('help.console.page', { page, last: lastPage })}
          className="mt-4 flex flex-wrap items-center justify-between gap-2"
        >
          <p className="text-sm text-muted">{t('help.console.page', { page, last: lastPage })}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline">
                <Link href={`/sesi-bantuan?halaman=${page - 1}`}>{t('help.console.previous')}</Link>
              </Button>
            )}
            {page < lastPage && (
              <Button asChild variant="outline">
                <Link href={`/sesi-bantuan?halaman=${page + 1}`}>{t('help.console.next')}</Link>
              </Button>
            )}
          </div>
        </nav>
      )}
    </>
  )
}
