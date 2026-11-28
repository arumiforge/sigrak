import { Link } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import { Icon } from '~/components/icon'
import { DataTable, type DataColumn } from '~/components/patterns/data_table'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { YearChips, type YearChoice } from '~/components/timetable/parts'
import { useT } from '~/lib/i18n'

type ClassRow = {
  publicId: string
  name: string
  grade: number
  rowCount: number
  complete: boolean
  countedTotal: number
  countedComplete: number
  warningCount: number
}

type Props = {
  years: YearChoice[]
  year: { publicId: string; name: string; closed: boolean } | null
  classes: ClassRow[]
}

/**
 * /jadwal (operator): every class of the year with the state of its
 * timetable (D-250), warnings (D-248), and the way to Susun draf jadwal
 * (D-262). A table on desktop, cards on phones.
 */
export default function TimetableIndex({ years, year, classes }: Props) {
  const t = useT()

  const columns: DataColumn<ClassRow>[] = [
    {
      id: 'name',
      header: t('timetable.index.class_column'),
      primary: true,
      cell: (row) => <span className="font-bold">{row.name}</span>,
    },
    {
      id: 'status',
      header: t('timetable.index.status_column'),
      cell: (row) =>
        row.rowCount === 0 ? (
          <StatusChip>{t('timetable.index.empty_class')}</StatusChip>
        ) : row.complete ? (
          <StatusChip tone="ok" icon>
            {t('timetable.index.complete')}
          </StatusChip>
        ) : (
          <StatusChip tone="info">
            {t('timetable.index.progress', {
              done: row.countedComplete,
              total: row.countedTotal,
            })}
          </StatusChip>
        ),
    },
    {
      id: 'warnings',
      header: t('timetable.index.warnings_column'),
      cell: (row) =>
        row.warningCount > 0 ? (
          <StatusChip tone="warn" icon>
            {t('timetable.index.warnings', { count: row.warningCount })}
          </StatusChip>
        ) : (
          <span className="text-muted">{t('timetable.index.no_warnings')}</span>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('timetable.index.title')}
        meta={year ? t('timetable.index.year_meta', { year: year.name }) : undefined}
        description={t('timetable.index.intro')}
        actions={
          year && !year.closed && classes.length > 0 ? (
            <Button asChild className="w-full sm:w-auto">
              <Link href={`/jadwal/susun-draf?tahun=${year.publicId}`} prefetch>
                <Icon name="timetable" />
                {t('timetable.index.compose_action')}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {year === null ? (
        <EmptyState icon="school-years" description={t('timetable.no_year')} />
      ) : (
        <>
          <YearChips
            years={years}
            current={year.publicId}
            basePath="/jadwal"
            label={t('timetable.index.year_label')}
          />
          {year.closed && (
            <p className="mt-4 rounded-md border border-warn/35 bg-warn-tint p-3 text-sm">
              {t('timetable.closed_note')}
            </p>
          )}
          <DataTable
            className="mt-6"
            rows={classes}
            columns={columns}
            getRowId={(row) => row.publicId}
            caption={t('timetable.index.table_caption', { year: year.name })}
            empty={<EmptyState icon="classes" description={t('timetable.index.no_classes')} />}
            rowActions={(row) => (
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                <Link
                  href={`/kelas/${row.publicId}/jadwal`}
                  prefetch
                  aria-label={t('timetable.index.open_label', { name: row.name })}
                >
                  {t('timetable.index.open_action')}
                </Link>
              </Button>
            )}
          />
        </>
      )}
    </>
  )
}
