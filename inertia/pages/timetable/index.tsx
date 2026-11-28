import type { ReactNode } from 'react'
import { Head, Link } from '@inertiajs/react'
import AppLayout from '~/layouts/app_layout'
import { Section } from '~/components/section'
import { Button } from '~/components/ui/button'
import { StatusLine, YearChips, type YearChoice } from '~/components/timetable/parts'
import { useT } from '~/lib/i18n'

type Props = {
  years: YearChoice[]
  year: { publicId: string; name: string; closed: boolean } | null
  classes: {
    publicId: string
    name: string
    grade: number
    rowCount: number
    complete: boolean
    countedTotal: number
    countedComplete: number
    warningCount: number
  }[]
}

/**
 * /jadwal (operator): every class of the year with the state of its
 * timetable (D-250), warnings (D-248), and the way to Susun draf jadwal
 * (D-262).
 */
export default function TimetableIndex({ years, year, classes }: Props) {
  const t = useT()
  return (
    <>
      <Head title={t('timetable.index.title')} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{t('timetable.index.title')}</h1>
          <p className="mt-2 max-w-2xl text-muted">{t('timetable.index.intro')}</p>
        </div>
        {year && !year.closed && classes.length > 0 && (
          <Button asChild>
            <Link href={`/jadwal/susun-draf?tahun=${year.publicId}`}>
              {t('timetable.index.compose_action')}
            </Link>
          </Button>
        )}
      </div>

      {year === null ? (
        <p className="mt-6 text-muted">{t('timetable.no_year')}</p>
      ) : (
        <>
          <YearChips
            years={years}
            current={year.publicId}
            basePath="/jadwal"
            label={t('timetable.index.year_label')}
          />
          {year.closed && <p className="mt-3 text-sm text-warn">{t('timetable.closed_note')}</p>}
          {classes.length === 0 ? (
            <p className="mt-6 text-muted">{t('timetable.index.no_classes')}</p>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((row) => (
                <li key={row.publicId}>
                  <Section title={row.name} className="h-full">
                    <div className="space-y-2">
                      {row.rowCount === 0 ? (
                        <StatusLine tone="info">{t('timetable.index.empty_class')}</StatusLine>
                      ) : row.complete ? (
                        <StatusLine tone="ok">{t('timetable.index.complete')}</StatusLine>
                      ) : (
                        <StatusLine tone="info">
                          {t('timetable.index.progress', {
                            done: row.countedComplete,
                            total: row.countedTotal,
                          })}
                        </StatusLine>
                      )}
                      {row.warningCount > 0 && (
                        <StatusLine tone="warn">
                          {t('timetable.index.warnings', { count: row.warningCount })}
                        </StatusLine>
                      )}
                    </div>
                    <Button asChild variant="outline" className="mt-4">
                      <Link href={`/kelas/${row.publicId}/jadwal`}>
                        {t('timetable.index.open_action')}
                      </Link>
                    </Button>
                  </Section>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}

TimetableIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>
