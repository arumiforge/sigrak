import { DataTable, type DataColumn } from '~/components/patterns/data_table'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { Section } from '~/components/section'
import { VersionStatus, type VersionSummary } from '~/components/curriculum/version_status'
import { useT } from '~/lib/i18n'
import { formatNumber } from '~/lib/format'

type Row = {
  level: string
  provinceName: string | null
  regionId: number | null
  regionName: string | null
  regionKind: string | null
  schools: number
  listed: boolean
  currentCode: string | null
}

type Props = {
  version: VersionSummary
  impact: {
    schoolYear: string
    upcoming: boolean
    rows: Row[]
    totals: { level: string; listed: number; other: number }[]
  }
}

/**
 * Konsol /kurikulum/{id}/dampak (R2-08, D-317): how many schools, per
 * level and kabupaten/kota, have this version in their Profil Jenjang
 * for the school year it applies to, and which version of the same line
 * they use today. Counts only, within the staff member's area. RPM
 * counts and the JP audit come with the RPM tables (R5).
 * Ability `curriculum.view`.
 */
export default function CurriculumImpact({ version, impact }: Props) {
  const t = useT()

  const columns: DataColumn<Row>[] = [
    {
      id: 'region',
      header: t('curriculum.impact.region'),
      primary: true,
      cell: (row) => (
        <span>
          <span className="font-semibold">
            {row.regionName
              ? `${t(`curriculum.impact.region_kinds.${row.regionKind ?? 'kabupaten'}`)} ${row.regionName}`
              : t('curriculum.impact.no_region')}
          </span>
          {row.provinceName && <span className="block text-sm text-muted">{row.provinceName}</span>}
        </span>
      ),
    },
    {
      id: 'level',
      header: t('curriculum.impact.level'),
      cell: (row) => t(`curriculum.impact.levels.${row.level}`),
    },
    {
      id: 'schools',
      header: t('curriculum.impact.schools'),
      align: 'right',
      cell: (row) => <span className="tabular-nums">{formatNumber(row.schools)}</span>,
    },
    {
      id: 'listed',
      header: t('curriculum.impact.uses'),
      cell: (row) =>
        row.listed ? (
          <StatusChip tone="brand">{t('curriculum.impact.listed')}</StatusChip>
        ) : (
          <StatusChip tone="neutral">{t('curriculum.impact.not_listed')}</StatusChip>
        ),
    },
    {
      id: 'current',
      header: t('curriculum.impact.current'),
      cell: (row) =>
        row.currentCode ? (
          <span className="break-all">{row.currentCode}</span>
        ) : (
          <span className="text-muted">{t('curriculum.impact.current_none')}</span>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('curriculum.impact.title', { code: version.code })}
        back={{ href: `/kurikulum/${version.id}`, label: t('curriculum.compare.back') }}
        description={t('curriculum.impact.intro')}
        meta={<VersionStatus version={version} />}
      />

      <div className="space-y-4">
        <Section title={t('curriculum.impact.totals_title')}>
          <p className="mb-3 text-sm text-muted">
            {impact.upcoming
              ? t('curriculum.impact.year_upcoming', { year: impact.schoolYear })
              : t('curriculum.impact.year_current', { year: impact.schoolYear })}
          </p>
          {impact.totals.length === 0 ? (
            <p className="text-muted">{t('curriculum.impact.no_schools')}</p>
          ) : (
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {impact.totals.map((total) => (
                <div key={total.level} className="rounded-md border bg-page px-3 py-2">
                  <dt className="text-sm font-semibold">
                    {t(`curriculum.impact.levels.${total.level}`)}
                  </dt>
                  <dd className="text-2xl font-bold tabular-nums">{formatNumber(total.listed)}</dd>
                  <dd className="text-sm text-muted">
                    {t('curriculum.impact.total_line', { other: formatNumber(total.other) })}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-3 text-sm text-muted">{t('curriculum.impact.rpm_later')}</p>
        </Section>

        <Section title={t('curriculum.impact.rows_title')}>
          <DataTable
            rows={impact.rows}
            columns={columns}
            getRowId={(row) => `${row.level}-${row.regionId ?? 'none'}`}
            caption={t('curriculum.impact.rows_title')}
            empty={
              <EmptyState compact icon="school" description={t('curriculum.impact.no_schools')} />
            }
          />
        </Section>
      </div>
    </>
  )
}
