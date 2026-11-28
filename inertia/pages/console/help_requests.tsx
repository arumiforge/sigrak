import { Form, Link } from '@inertiajs/react'
import { DataTable, type DataColumn } from '~/components/patterns/data_table'
import { EmptyState } from '~/components/patterns/empty_state'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { PageHeader } from '~/components/patterns/page_header'
import { HelpStatusChip } from '~/components/help/help_status_chip'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatDateTime } from '~/lib/format'

type Request = {
  id: number
  category: string
  status: string
  excerpt: string
  createdAt: string
  senderRole: string | null
  senderName: string | null
  schoolName: string | null
  assigneeName: string | null
}

type Props = {
  filters: { status: string; category: string; region: number | null; assignee: string }
  page: number
  lastPage: number
  total: number
  requests: Request[]
  regions: { id: number; name: string; kind: string }[]
  categories: string[]
  statuses: string[]
}

function pageHref(filters: Props['filters'], page: number) {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.category) params.set('jenis', filters.category)
  if (filters.region) params.set('wilayah', String(filters.region))
  if (filters.assignee) params.set('petugas', filters.assignee)
  if (page > 1) params.set('halaman', String(page))
  const query = params.toString()
  return query ? `/bantuan?${query}` : '/bantuan'
}

/**
 * Konsol /bantuan (R2-06, D-320): Minta Bantuan requests inside the
 * staff member's area, open ones first, filtered by status, category,
 * kabupaten/kota and who handles them. Ability `help_requests.view`.
 */
export default function ConsoleHelpRequests({
  filters,
  page,
  lastPage,
  total,
  requests,
  regions,
  categories,
  statuses,
}: Props) {
  const t = useT()
  const filtered = Boolean(filters.status || filters.category || filters.region || filters.assignee)

  const columns: DataColumn<Request>[] = [
    {
      id: 'request',
      header: t('help.console.message'),
      primary: true,
      cell: (row) => (
        <Link
          href={`/bantuan/${row.id}`}
          className="block min-h-11 py-1 font-semibold text-brand-strong hover:underline sm:min-h-0 sm:py-0"
        >
          <span className="block">
            {t('help.console.request_number', { number: row.id })} ·{' '}
            {t(`help.categories.${row.category}`)}
          </span>
          <span className="block max-w-md font-normal break-words text-text">{row.excerpt}</span>
        </Link>
      ),
    },
    {
      id: 'status',
      header: t('help.console.status'),
      cell: (row) => <HelpStatusChip status={row.status} />,
    },
    {
      id: 'sender',
      header: t('help.console.sender'),
      cell: (row) => (
        <span>
          <span className="block">{row.senderName ?? '–'}</span>
          <span className="block text-xs text-muted">
            {row.schoolName ?? t('help.console.no_school')}
            {row.senderRole ? ` · ${t(`nav.roles.${row.senderRole}`)}` : ''}
          </span>
        </span>
      ),
    },
    {
      id: 'assignee',
      header: t('help.console.assignee'),
      cell: (row) =>
        row.assigneeName ?? <span className="text-muted">{t('help.console.no_assignee')}</span>,
    },
    {
      id: 'sent',
      header: t('help.console.sent'),
      cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.createdAt)}</span>,
    },
  ]

  return (
    <>
      <PageHeader title={t('help.console.title')} description={t('help.console.intro')} />

      <Form
        action="/bantuan"
        method="get"
        className="mb-6 grid gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end"
      >
        <FormField label={t('help.console.filter_status')}>
          {(field) => (
            <select {...field} name="status" defaultValue={filters.status} className={controlClass}>
              <option value="">{t('help.console.all_statuses')}</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {t(`help.statuses.${status}`)}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label={t('help.console.filter_category')}>
          {(field) => (
            <select
              {...field}
              name="jenis"
              defaultValue={filters.category}
              className={controlClass}
            >
              <option value="">{t('help.console.all_categories')}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {t(`help.categories.${category}`)}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label={t('help.console.filter_region')}>
          {(field) => (
            <select
              {...field}
              name="wilayah"
              defaultValue={filters.region ? String(filters.region) : ''}
              className={controlClass}
            >
              <option value="">{t('help.console.all_regions')}</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {t(`regions.kinds.${region.kind}`, { name: region.name })}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label={t('help.console.filter_assignee')}>
          {(field) => (
            <select
              {...field}
              name="petugas"
              defaultValue={filters.assignee}
              className={controlClass}
            >
              <option value="">{t('help.console.all_assignees')}</option>
              <option value="saya">{t('help.console.mine')}</option>
              <option value="kosong">{t('help.console.unassigned')}</option>
            </select>
          )}
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{t('help.console.apply')}</Button>
          {filtered && (
            <Button asChild variant="ghost">
              <Link href="/bantuan">{t('help.console.reset')}</Link>
            </Button>
          )}
        </div>
      </Form>

      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {t('help.console.count', { count: total })}
      </p>

      <DataTable
        rows={requests}
        columns={columns}
        getRowId={(row) => String(row.id)}
        caption={t('help.console.caption')}
        empty={<EmptyState icon="support" description={t('help.console.empty')} />}
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
                <Link href={pageHref(filters, page - 1)}>{t('help.console.previous')}</Link>
              </Button>
            )}
            {page < lastPage && (
              <Button asChild variant="outline">
                <Link href={pageHref(filters, page + 1)}>{t('help.console.next')}</Link>
              </Button>
            )}
          </div>
        </nav>
      )}
    </>
  )
}
