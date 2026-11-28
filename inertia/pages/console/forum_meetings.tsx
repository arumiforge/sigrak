import { Form, Link } from '@inertiajs/react'
import { DataTable, type DataColumn } from '~/components/patterns/data_table'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatDate } from '~/lib/dates'

type Meeting = { id: number; heldOn: string; status: string; items: number; openItems: number }

type Props = {
  meetings: Meeting[]
  waiting: number
  today: string
  can: { manage: boolean }
}

/**
 * Konsol /forum (R2-07, D-439): the fortnightly Forum Masalah→Solusi
 * meetings, newest first, and how many analysed problems wait for a
 * decision. `forum.view` reads; `forum.manage` plans a meeting.
 */
export default function ConsoleForumMeetings({ meetings, waiting, today, can }: Props) {
  const t = useT()

  const columns: DataColumn<Meeting>[] = [
    {
      id: 'meeting',
      header: t('problems.forum.meeting'),
      primary: true,
      cell: (row) => (
        <Link
          href={`/forum/${row.id}`}
          className="block min-h-11 py-1 font-semibold text-brand-strong hover:underline sm:min-h-0 sm:py-0"
        >
          {t('problems.forum.meeting_title', { date: formatDate(row.heldOn) })}
        </Link>
      ),
    },
    {
      id: 'status',
      header: t('problems.list.status'),
      cell: (row) => (
        <StatusChip tone={row.status === 'held' ? 'ok' : 'info'} icon={row.status === 'held'}>
          {t(`problems.forum.statuses.${row.status}`)}
        </StatusChip>
      ),
    },
    {
      id: 'items',
      header: t('problems.forum.items'),
      cell: (row) =>
        row.openItems > 0
          ? t('problems.forum.items_open', { count: row.items, open: row.openItems })
          : t('problems.forum.items_count', { count: row.items }),
    },
  ]

  return (
    <>
      <PageHeader title={t('problems.forum.title')} description={t('problems.forum.intro')} />

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <p className="rounded-lg border bg-surface p-4" aria-live="polite">
          <span className="block text-2xl font-bold">{waiting}</span>
          <span className="text-sm text-muted">{t('problems.forum.waiting')}</span>
        </p>
        {can.manage && (
          <Section title={t('problems.forum.plan_title')}>
            <Form action="/forum" method="post" className="space-y-3">
              {({ errors, processing }) => (
                <>
                  <TextField
                    label={t('problems.forum.date')}
                    name="held_on"
                    type="date"
                    required
                    defaultValue={today}
                    error={errors.held_on}
                  />
                  <Button type="submit" disabled={processing} data-testid="plan-meeting">
                    {t('problems.forum.plan')}
                  </Button>
                </>
              )}
            </Form>
          </Section>
        )}
      </div>

      <DataTable
        rows={meetings}
        columns={columns}
        getRowId={(row) => String(row.id)}
        caption={t('problems.forum.caption')}
        empty={<EmptyState icon="forum" description={t('problems.forum.empty')} />}
      />
    </>
  )
}
