import { Link, router } from '@inertiajs/react'
import { DataTable, type DataColumn } from '~/components/patterns/data_table'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip, type StatusTone } from '~/components/patterns/status_chip'
import { Section, SelectField } from '~/components/section'
import { VersionStatus, type VersionSummary } from '~/components/curriculum/version_status'
import { useT } from '~/lib/i18n'
import { formatNumber } from '~/lib/format'
import { cn } from '~/lib/utils'

type ChangeKind = 'added' | 'removed' | 'changed'
type Area = 'allocation' | 'element' | 'outcome' | 'topic' | 'objective'
type Value = string | number | null

type Change = {
  area: Area
  kind: ChangeKind
  key: string
  label: string
  fields: { field: string; before: Value; after: Value }[]
}

type Group = {
  subjectCode: string
  grade: number | null
  phase: 'A' | 'B' | 'C' | null
  changes: Change[]
  jp: { before: number | null; after: number | null } | null
  topicJp: { before: number; after: number } | null
}

type SubjectRow = {
  code: string
  name: string
  added: number
  removed: number
  changed: number
  jpBefore: number
  jpAfter: number
}

type Props = {
  version: VersionSummary
  base: VersionSummary | null
  options: VersionSummary[]
  subject: string | null
  comparison: {
    summary: Record<Area, Record<ChangeKind, number>>
    subjects: SubjectRow[]
    groups: Group[]
  } | null
}

const AREAS: Area[] = ['allocation', 'element', 'outcome', 'topic', 'objective']
const KINDS: ChangeKind[] = ['added', 'removed', 'changed']
const kindTone: Record<ChangeKind, StatusTone> = { added: 'ok', removed: 'danger', changed: 'info' }
const PHASE_GRADES = { A: '1–2', B: '3–4', C: '5–6' } as const
/** Long text fields show the old and new text as two blocks. */
const LONG_FIELDS = new Set(['text', 'title', 'elements', 'name'])

/**
 * Konsol /kurikulum/{id}/bandingkan (R2-08, D-317): a version against
 * another of the same kind, by default the version it replaces. A
 * summary per area, a table per subject (changes and JP per year), and
 * the changes of one subject grouped by grade (CP by phase).
 * Ability `curriculum.view`.
 */
export default function CurriculumCompare({ version, base, options, subject, comparison }: Props) {
  const t = useT()
  const path = `/kurikulum/${version.id}/bandingkan`
  const query = (values: { dengan?: number; mapel?: string | null }) => {
    const params = new URLSearchParams()
    const dengan = values.dengan ?? base?.id
    if (dengan) params.set('dengan', String(dengan))
    if (values.mapel) params.set('mapel', values.mapel)
    return `${path}?${params.toString()}`
  }

  const subjectColumns: DataColumn<SubjectRow>[] = [
    {
      id: 'subject',
      header: t('curriculum.compare.subject'),
      primary: true,
      cell: (row) => (
        <Link
          href={query({ mapel: row.code })}
          preserveScroll
          aria-current={row.code === subject ? 'true' : undefined}
          className={cn(
            'font-semibold hover:underline',
            row.code === subject ? 'text-text' : 'text-brand-strong'
          )}
        >
          {row.name}
          {row.code === subject && (
            <span className="font-normal text-muted"> ({t('curriculum.compare.shown')})</span>
          )}
        </Link>
      ),
    },
    {
      id: 'changes',
      header: t('curriculum.compare.changes'),
      cell: (row) => <KindCounts counts={row} />,
    },
    {
      id: 'jp',
      header: t('curriculum.compare.jp_year'),
      cell: (row) => <BeforeAfter before={row.jpBefore} after={row.jpAfter} />,
    },
  ]

  return (
    <>
      <PageHeader
        title={t('curriculum.compare.title', { code: version.code })}
        back={{ href: `/kurikulum/${version.id}`, label: t('curriculum.compare.back') }}
        description={t('curriculum.compare.intro')}
        meta={<VersionStatus version={version} />}
      />

      {options.length === 0 || !comparison || !base ? (
        <EmptyState icon="curriculum" description={t('curriculum.compare.no_other')} />
      ) : (
        <div className="space-y-4">
          <Section title={t('curriculum.compare.against_title')}>
            <div className="max-w-xl">
              <SelectField
                key={base.id}
                label={t('curriculum.compare.against')}
                name="dengan"
                defaultValue={String(base.id)}
                onChange={(value) => router.get(query({ dengan: Number(value) }))}
                options={options.map((option) => ({
                  value: String(option.id),
                  label: `${option.code} (${t(`curriculum.statuses.${option.status}`)})`,
                }))}
              />
            </div>
            <p className="mt-2 text-sm text-muted">
              {t('curriculum.compare.direction', { base: base.code, target: version.code })}
            </p>
          </Section>

          <Section title={t('curriculum.compare.summary_title')}>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {AREAS.map((area) => (
                <div key={area} className="rounded-md border bg-page px-3 py-2">
                  <dt className="text-sm font-semibold">{t(`curriculum.areas.${area}`)}</dt>
                  <dd className="mt-1">
                    <KindCounts counts={comparison.summary[area]} />
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section
            title={t('curriculum.compare.subjects_title')}
            description={t('curriculum.compare.subjects_intro')}
          >
            <DataTable
              rows={comparison.subjects}
              columns={subjectColumns}
              getRowId={(row) => row.code}
              caption={t('curriculum.compare.subjects_title')}
              empty={<EmptyState compact description={t('curriculum.compare.no_subjects')} />}
            />
          </Section>

          {subject && (
            <Section
              title={t('curriculum.compare.detail_title', {
                subject: comparison.subjects.find((row) => row.code === subject)?.name ?? subject,
              })}
            >
              {comparison.groups.length === 0 ? (
                <p className="text-muted">{t('curriculum.compare.no_changes')}</p>
              ) : (
                <div className="space-y-6">
                  {comparison.groups.map((group) => (
                    <GroupBlock key={`${group.grade}-${group.phase}`} group={group} />
                  ))}
                </div>
              )}
            </Section>
          )}
        </div>
      )}
    </>
  )
}

function KindCounts({ counts }: { counts: Record<ChangeKind, number> }) {
  const t = useT()
  const shown = KINDS.filter((kind) => counts[kind] > 0)
  if (shown.length === 0)
    return <span className="text-sm text-muted">{t('curriculum.compare.same')}</span>
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((kind) => (
        <StatusChip key={kind} tone={kindTone[kind]}>
          {t(`curriculum.compare.count_${kind}`, { count: formatNumber(counts[kind]) })}
        </StatusChip>
      ))}
    </span>
  )
}

function BeforeAfter({ before, after }: { before: number | null; after: number | null }) {
  const t = useT()
  const show = (value: number | null) => (value === null ? '–' : formatNumber(value))
  if (before === after) return <span className="tabular-nums">{show(after)}</span>
  return (
    <span className="tabular-nums">
      <span className="text-muted line-through">{show(before)}</span>
      <span aria-hidden> → </span>
      <span className="sr-only"> {t('curriculum.compare.becomes')} </span>
      <span className="font-semibold">{show(after)}</span>
    </span>
  )
}

function GroupBlock({ group }: { group: Group }) {
  const t = useT()
  const title =
    group.grade !== null
      ? t('curriculum.compare.grade', { grade: group.grade })
      : group.phase
        ? t('curriculum.compare.phase', { phase: group.phase, grades: PHASE_GRADES[group.phase] })
        : t('curriculum.compare.elements')

  return (
    <div>
      <h3 className="text-base font-bold">{title}</h3>
      {(group.jp || group.topicJp) && (
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {group.jp && (
            <span>
              {t('curriculum.compare.jp_year')}:{' '}
              <BeforeAfter before={group.jp.before} after={group.jp.after} />
            </span>
          )}
          {group.topicJp && (
            <span>
              {t('curriculum.compare.jp_topics')}:{' '}
              <BeforeAfter before={group.topicJp.before} after={group.topicJp.after} />
            </span>
          )}
        </p>
      )}
      {group.changes.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t('curriculum.compare.no_changes_grade')}</p>
      ) : (
        <ul className="mt-2 divide-y rounded-md border">
          {group.changes.map((change) => (
            <ChangeItem key={`${change.area}-${change.key}`} change={change} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ChangeItem({ change }: { change: Change }) {
  const t = useT()
  return (
    <li className="space-y-1.5 px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={kindTone[change.kind]}>
          {t(`curriculum.compare.kind_${change.kind}`)}
        </StatusChip>
        <span className="font-semibold">{t(`curriculum.areas_one.${change.area}`)}</span>
        <code className="text-xs break-all text-muted">{change.key}</code>
      </div>
      <p className="break-words">{labelOf(t, change)}</p>
      {change.fields.length > 0 && (
        <dl className="space-y-1">
          {change.fields.map((field) => (
            <div key={field.field}>
              <dt className="text-xs font-semibold text-muted">
                {t(`curriculum.fields.${field.field}`)}
              </dt>
              {LONG_FIELDS.has(field.field) ? (
                <dd className="mt-0.5 grid gap-1 sm:grid-cols-2">
                  <span className="rounded-md border border-danger/30 bg-danger-tint px-2 py-1 break-words">
                    <span className="sr-only">{t('curriculum.compare.before')}: </span>
                    {valueOf(t, field.field, field.before)}
                  </span>
                  <span className="rounded-md border border-ok/30 bg-ok-tint px-2 py-1 break-words">
                    <span className="sr-only">{t('curriculum.compare.after')}: </span>
                    {valueOf(t, field.field, field.after)}
                  </span>
                </dd>
              ) : (
                <dd>
                  <span className="text-muted line-through">
                    {valueOf(t, field.field, field.before)}
                  </span>
                  <span aria-hidden> → </span>
                  <span className="sr-only"> {t('curriculum.compare.becomes')} </span>
                  <span className="font-semibold">{valueOf(t, field.field, field.after)}</span>
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}
    </li>
  )
}

type T = ReturnType<typeof useT>

/** Allocation rows carry `intracurricular` or `intracurricular|music` as their label. */
function labelOf(t: T, change: Change) {
  if (change.area !== 'allocation') return change.label
  const [type, branch] = change.label.split('|')
  const words = [t(`curriculum.values.learning_type.${type}`)]
  if (branch) words.push(t(`curriculum.values.art_branch.${branch}`))
  return words.join(', ')
}

function valueOf(t: T, field: string, value: Value) {
  if (value === null || value === '') return '–'
  if (field === 'status' || field === 'jp_target_set_by') {
    return t(`curriculum.values.${field}.${value}`)
  }
  if (typeof value === 'number') return formatNumber(value)
  if (value.startsWith('[')) {
    try {
      return (JSON.parse(value) as unknown[]).join(', ')
    } catch {
      return value
    }
  }
  return value
}
