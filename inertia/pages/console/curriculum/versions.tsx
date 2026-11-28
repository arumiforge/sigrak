import { Link } from '@inertiajs/react'
import { DataTable, type DataColumn } from '~/components/patterns/data_table'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { VersionStatus, type VersionSummary } from '~/components/curriculum/version_status'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

type Version = VersionSummary & {
  supersedes: string | null
  subjects: number
  curatedSubjects: number
}

/**
 * Konsol /kurikulum (R2-08, D-317): every curriculum version (structure
 * and JP, CP, SIGRAK topics) with its status. A version reaches schools
 * after a validator signs it off and the curriculum curator publishes
 * it. Ability `curriculum.view`.
 */
export default function CurriculumVersions({ versions }: { versions: Version[] }) {
  const t = useT()

  const columns: DataColumn<Version>[] = [
    {
      id: 'version',
      header: t('curriculum.list.version'),
      primary: true,
      cell: (version) => (
        <span className="block min-w-0">
          <Link
            href={`/kurikulum/${version.id}`}
            prefetch
            className="font-semibold break-all text-brand-strong hover:underline"
          >
            {version.code}
          </Link>
          <span className="block text-sm text-muted">{version.name}</span>
        </span>
      ),
    },
    {
      id: 'kind',
      header: t('curriculum.list.kind'),
      cell: (version) => t(`curriculum.kinds.${version.kind}`),
    },
    {
      id: 'status',
      header: t('curriculum.list.status'),
      cell: (version) => <VersionStatus version={version} />,
    },
    {
      id: 'applies_from',
      header: t('curriculum.list.applies_from'),
      cell: (version) => version.appliesFrom ?? t('curriculum.list.no_year'),
    },
    {
      id: 'subjects',
      header: t('curriculum.list.subjects'),
      cell: (version) => (
        <span>
          {t('curriculum.list.subjects_count', { count: version.subjects })}
          {version.kind === 'topics' && (
            <span className="block text-sm text-muted">
              {t('curriculum.list.curated_count', { count: version.curatedSubjects })}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'supersedes',
      header: t('curriculum.list.supersedes'),
      cell: (version) =>
        version.supersedes ? (
          <span className="break-all">{version.supersedes}</span>
        ) : (
          <span className="text-muted">{t('curriculum.list.first_version')}</span>
        ),
    },
  ]

  return (
    <>
      <PageHeader title={t('curriculum.list.title')} description={t('curriculum.list.intro')} />
      <DataTable
        rows={versions}
        columns={columns}
        getRowId={(version) => String(version.id)}
        caption={t('curriculum.list.caption')}
        empty={<EmptyState icon="curriculum" description={t('curriculum.list.empty')} />}
        rowActions={(version) => (
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/kurikulum/${version.id}`}
              prefetch
              aria-label={t('curriculum.list.open_label', { code: version.code })}
            >
              {t('curriculum.list.open')}
            </Link>
          </Button>
        )}
      />
    </>
  )
}
