import { useState } from 'react'
import { Form, Link, useForm } from '@inertiajs/react'
import { DataTable, type DataColumn } from '~/components/patterns/data_table'
import { EmptyState } from '~/components/patterns/empty_state'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { PageHeader } from '~/components/patterns/page_header'
import { ResponsiveDialog } from '~/components/patterns/responsive_dialog'
import { PlaceFields, type RegionOptions } from '~/components/problems/place_fields'
import { ProblemStatusChip, regionLabel } from '~/components/problems/problem_status_chip'
import { TextField } from '~/components/text_field'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatDateTime } from '~/lib/format'
import { cn } from '~/lib/utils'

type Problem = {
  id: number
  number: string
  title: string
  status: string
  source: string
  level: string | null
  region: { name: string; kind: string } | null
  reports: number
  updatedAt: string
}

type Filters = { status: string; source: string; search: string }

type Props = {
  filters: Filters
  page: number
  lastPage: number
  total: number
  counts: Record<string, number>
  problems: Problem[]
  statuses: string[]
  sources: string[]
  manualSources: string[]
  levels: string[]
  can: { record: boolean }
  recordRegions: RegionOptions | null
}

function listHref(filters: Filters, page = 1) {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.source) params.set('sumber', filters.source)
  if (filters.search) params.set('cari', filters.search)
  if (page > 1) params.set('halaman', String(page))
  const query = params.toString()
  return query ? `/bank-masalah?${query}` : '/bank-masalah'
}

/**
 * Konsol /bank-masalah (R2-07, D-439): every problem from the field,
 * open ones first, with status chips that count and filter, and
 * "Catat masalah" for Tim Lapangan. Abilities: `problems.view` (all
 * teams), `problems.record` to record.
 */
export default function ConsoleProblems({
  filters,
  page,
  lastPage,
  total,
  counts,
  problems,
  statuses,
  sources,
  manualSources,
  levels,
  can,
  recordRegions,
}: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const all = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const openCount = statuses
    .filter((status) => !['released', 'closed'].includes(status))
    .reduce((sum, status) => sum + (counts[status] ?? 0), 0)

  const chips: { value: string; label: string; count: number }[] = [
    { value: '', label: t('problems.list.all'), count: all },
    { value: 'open', label: t('problems.list.open'), count: openCount },
    ...statuses.map((status) => ({
      value: status,
      label: t(`problems.statuses.${status}`),
      count: counts[status] ?? 0,
    })),
  ]

  const columns: DataColumn<Problem>[] = [
    {
      id: 'problem',
      header: t('problems.list.problem'),
      primary: true,
      cell: (row) => (
        <Link
          href={`/bank-masalah/${row.id}`}
          className="block min-h-11 py-1 font-semibold text-brand-strong hover:underline sm:min-h-0 sm:py-0"
        >
          <span className="block text-xs font-normal text-muted">{row.number}</span>
          <span className="block max-w-md break-words">{row.title}</span>
        </Link>
      ),
    },
    {
      id: 'status',
      header: t('problems.list.status'),
      cell: (row) => <ProblemStatusChip status={row.status} />,
    },
    {
      id: 'source',
      header: t('problems.list.source'),
      cell: (row) => t(`problems.sources.${row.source}`),
    },
    {
      id: 'place',
      header: t('problems.list.place'),
      cell: (row) => (
        <span>
          <span className="block">{regionLabel(t, row.region)}</span>
          {row.level && (
            <span className="block text-xs text-muted">{t(`problems.levels.${row.level}`)}</span>
          )}
        </span>
      ),
    },
    {
      id: 'reports',
      header: t('problems.list.reports'),
      align: 'right',
      cell: (row) => row.reports,
    },
    {
      id: 'updated',
      header: t('problems.list.updated'),
      cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.updatedAt)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title={t('problems.list.title')}
        description={t('problems.list.intro')}
        actions={
          can.record &&
          recordRegions && (
            <Button onClick={() => setOpen(true)} data-testid="record-problem">
              <Icon name="add" />
              {t('problems.record.open')}
            </Button>
          )
        }
      />

      <nav
        aria-label={t('problems.list.status_filter')}
        className="-mx-4 mb-4 overflow-x-auto px-4"
      >
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {chips.map((chip) => {
            const active = filters.status === chip.value
            return (
              <li key={chip.value || 'all'}>
                <Link
                  href={listHref({ ...filters, status: chip.value })}
                  preserveScroll
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold whitespace-nowrap',
                    active
                      ? 'border-brand bg-brand-tint text-brand-strong'
                      : 'bg-surface text-text hover:border-brand'
                  )}
                >
                  {chip.label}
                  <span className="text-muted">{chip.count}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <Form
        action="/bank-masalah"
        method="get"
        className="mb-6 grid gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] lg:items-end"
      >
        {filters.status && <input type="hidden" name="status" value={filters.status} />}
        <TextField
          label={t('problems.list.search')}
          name="cari"
          type="search"
          defaultValue={filters.search}
          maxLength={100}
        />
        <FormField label={t('problems.list.source')}>
          {(field) => (
            <select {...field} name="sumber" defaultValue={filters.source} className={controlClass}>
              <option value="">{t('problems.list.all_sources')}</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {t(`problems.sources.${source}`)}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{t('problems.list.apply')}</Button>
          {(filters.source || filters.search) && (
            <Button asChild variant="ghost">
              <Link href={listHref({ ...filters, source: '', search: '' })}>
                {t('problems.list.reset')}
              </Link>
            </Button>
          )}
        </div>
      </Form>

      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {t('problems.list.count', { count: total })}
      </p>

      <DataTable
        rows={problems}
        columns={columns}
        getRowId={(row) => String(row.id)}
        caption={t('problems.list.caption')}
        empty={<EmptyState icon="problem" description={t('problems.list.empty')} />}
      />

      {lastPage > 1 && (
        <nav
          aria-label={t('problems.list.page', { page, last: lastPage })}
          className="mt-4 flex flex-wrap items-center justify-between gap-2"
        >
          <p className="text-sm text-muted">{t('problems.list.page', { page, last: lastPage })}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline">
                <Link href={listHref(filters, page - 1)}>{t('problems.list.previous')}</Link>
              </Button>
            )}
            {page < lastPage && (
              <Button asChild variant="outline">
                <Link href={listHref(filters, page + 1)}>{t('problems.list.next')}</Link>
              </Button>
            )}
          </div>
        </nav>
      )}

      {can.record && recordRegions && (
        <RecordDialog
          open={open}
          onOpenChange={setOpen}
          sources={manualSources}
          levels={levels}
          regions={recordRegions}
        />
      )}
    </>
  )
}

function RecordDialog({
  open,
  onOpenChange,
  sources,
  levels,
  regions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sources: string[]
  levels: string[]
  regions: RegionOptions
}) {
  const t = useT()
  const form = useForm<{
    title: string
    description: string
    source: string
    region_id: number | null
    level: string | null
  }>({
    title: '',
    description: '',
    source: sources[0] ?? 'field_note',
    region_id: null,
    level: null,
  })

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('problems.record.title')}
      description={t('problems.record.intro')}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" form="record-problem" disabled={form.processing}>
            {t('problems.record.submit')}
          </Button>
        </>
      }
    >
      <form
        id="record-problem"
        className="max-h-[60dvh] space-y-4 overflow-y-auto px-4 pb-2 sm:max-h-[65dvh] sm:px-0"
        onSubmit={(event) => {
          event.preventDefault()
          form.post('/bank-masalah', { onSuccess: () => onOpenChange(false) })
        }}
      >
        <TextField
          label={t('problems.fields.title')}
          hint={t('problems.fields.title_hint')}
          name="title"
          required
          maxLength={160}
          value={form.data.title}
          onChange={(event) => form.setData('title', event.target.value)}
          error={form.errors.title}
        />
        <FormField
          label={t('problems.fields.description')}
          hint={t('problems.fields.description_hint')}
          error={form.errors.description}
        >
          {(field) => (
            <textarea
              {...field}
              name="description"
              required
              maxLength={4000}
              rows={5}
              value={form.data.description}
              onChange={(event) => form.setData('description', event.target.value)}
              className={cn(controlClass, 'py-2.5')}
            />
          )}
        </FormField>
        <FormField label={t('problems.fields.source')} error={form.errors.source}>
          {(field) => (
            <select
              {...field}
              name="source"
              value={form.data.source}
              onChange={(event) => form.setData('source', event.target.value)}
              className={controlClass}
            >
              {sources.map((source) => (
                <option key={source} value={source}>
                  {t(`problems.sources.${source}`)}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <PlaceFields
          options={regions}
          levels={levels}
          regionId={form.data.region_id}
          level={form.data.level}
          errors={form.errors}
          onRegion={(value) => form.setData('region_id', value)}
          onLevel={(value) => form.setData('level', value)}
        />
      </form>
    </ResponsiveDialog>
  )
}
