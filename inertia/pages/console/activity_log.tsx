import { Form, Link } from '@inertiajs/react'
import { DataTable, type DataColumn } from '~/components/patterns/data_table'
import { EmptyState } from '~/components/patterns/empty_state'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { PageHeader } from '~/components/patterns/page_header'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatDateTime } from '~/lib/format'
import { ActionLabel, actionText } from '~/components/staff/action_label'

type Entry = {
  id: number
  at: string
  staff: string | null
  action: string
  subjectType: string
  subjectId: string
  subjectName: string | null
  /** The logged role, for "Peran diberikan: Penjualan". */
  role: string | null
  /** The logged old and new values as indented JSON, or null. */
  details: string | null
}

type Props = {
  filters: { staff: number | null; action: string; from: string; to: string }
  page: number
  lastPage: number
  total: number
  entries: Entry[]
  staffOptions: { id: number; name: string }[]
  actions: string[]
}

/** The query string of a page with the current filters. */
function pageHref(filters: Props['filters'], page: number) {
  const params = new URLSearchParams()
  if (filters.staff) params.set('staf', String(filters.staff))
  if (filters.action) params.set('aksi', filters.action)
  if (filters.from) params.set('dari', filters.from)
  if (filters.to) params.set('sampai', filters.to)
  if (page > 1) params.set('halaman', String(page))
  const query = params.toString()
  return query ? `/log-aktivitas?${query}` : '/log-aktivitas'
}

/**
 * Konsol /log-aktivitas (R2-01): every logged staff change, newest
 * first, filtered by staff member, kind of change and WIB date.
 * Ability `audit.view`; read-only.
 */
export default function ConsoleActivityLog({
  filters,
  page,
  lastPage,
  total,
  entries,
  staffOptions,
  actions,
}: Props) {
  const t = useT()
  const filtered = Boolean(filters.staff || filters.action || filters.from || filters.to)

  const columns: DataColumn<Entry>[] = [
    {
      id: 'what',
      header: t('staff.audit.what'),
      primary: true,
      cell: (entry) => <ActionLabel action={entry.action} role={entry.role} />,
    },
    {
      id: 'when',
      header: t('staff.audit.when'),
      cell: (entry) => <span className="whitespace-nowrap">{formatDateTime(entry.at)}</span>,
    },
    {
      id: 'who',
      header: t('staff.audit.who'),
      cell: (entry) => entry.staff ?? <span className="text-muted">{t('staff.audit.system')}</span>,
    },
    {
      id: 'subject',
      header: t('staff.audit.subject'),
      cell: (entry) => (
        <span>
          <span className="text-muted">{t(`staff.audit.subjects.${entry.subjectType}`)}: </span>
          <span className="break-words">{entry.subjectName ?? entry.subjectId}</span>
        </span>
      ),
    },
    {
      id: 'details',
      header: t('staff.audit.details'),
      cell: (entry) =>
        entry.details === null ? (
          <span className="text-muted">–</span>
        ) : (
          <details>
            <summary className="min-h-11 cursor-pointer py-2 font-semibold text-brand-strong sm:min-h-0 sm:py-0">
              {t('staff.audit.details')}
            </summary>
            <pre className="mt-2 max-w-md overflow-x-auto rounded-md bg-page p-2 text-xs whitespace-pre-wrap">
              {entry.details}
            </pre>
          </details>
        ),
    },
  ]

  return (
    <>
      <PageHeader title={t('staff.audit.title')} description={t('staff.audit.intro')} />

      <Form
        action="/log-aktivitas"
        method="get"
        className="mb-6 grid gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end"
      >
        <FormField label={t('staff.audit.filter_staff')}>
          {(field) => (
            <select
              {...field}
              name="staf"
              defaultValue={filters.staff ? String(filters.staff) : ''}
              className={controlClass}
            >
              <option value="">{t('staff.audit.all_staff')}</option>
              {staffOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label={t('staff.audit.filter_action')}>
          {(field) => (
            <select {...field} name="aksi" defaultValue={filters.action} className={controlClass}>
              <option value="">{t('staff.audit.all_actions')}</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {/* An option holds text only, so the label is resolved here. */}
                  {actionText(t, action)}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label={t('staff.audit.filter_from')}>
          {(field) => (
            <input
              {...field}
              type="date"
              name="dari"
              defaultValue={filters.from}
              className={controlClass}
            />
          )}
        </FormField>
        <FormField label={t('staff.audit.filter_to')}>
          {(field) => (
            <input
              {...field}
              type="date"
              name="sampai"
              defaultValue={filters.to}
              className={controlClass}
            />
          )}
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{t('staff.audit.apply')}</Button>
          {filtered && (
            <Button asChild variant="ghost">
              <Link href="/log-aktivitas">{t('staff.audit.reset')}</Link>
            </Button>
          )}
        </div>
      </Form>

      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {t('staff.audit.count', { count: total })}
      </p>

      <DataTable
        rows={entries}
        columns={columns}
        getRowId={(entry) => String(entry.id)}
        caption={t('staff.audit.caption')}
        empty={<EmptyState icon="activity" description={t('staff.audit.empty')} />}
      />

      {lastPage > 1 && (
        <nav
          aria-label={t('staff.audit.page', { page, last: lastPage })}
          className="mt-4 flex flex-wrap items-center justify-between gap-2"
        >
          <p className="text-sm text-muted">{t('staff.audit.page', { page, last: lastPage })}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline">
                <Link href={pageHref(filters, page - 1)} preserveScroll={false}>
                  {t('staff.audit.previous')}
                </Link>
              </Button>
            )}
            {page < lastPage && (
              <Button asChild variant="outline">
                <Link href={pageHref(filters, page + 1)}>{t('staff.audit.next')}</Link>
              </Button>
            )}
          </div>
        </nav>
      )}
    </>
  )
}
