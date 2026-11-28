import { Form, Link, router } from '@inertiajs/react'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { Section } from '~/components/section'
import { HelpStatusChip } from '~/components/help/help_status_chip'
import { StartSupportSession } from '~/components/help/start_support_session'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatDateTime } from '~/lib/format'
import { cn } from '~/lib/utils'

type Props = {
  request: {
    id: number
    category: string
    status: string
    message: string
    pageUrl: string | null
    createdAt: string
    statusChangedAt: string
    senderRole: string | null
    senderName: string | null
    senderEmail: string | null
    school: {
      id: number
      name: string
      npsn: string | null
      regionName: string | null
      regionKind: string
    } | null
    assigneeName: string | null
    assignedToMe: boolean
  }
  notes: {
    id: number
    kind: 'reply' | 'note' | 'status'
    body: string | null
    status: string | null
    emailed: boolean
    at: string
    staffName: string | null
  }[]
  statuses: string[]
  supportSessionHours: number
  can: { manage: boolean; openSchool: boolean; viewSchool: boolean; toProblem: boolean }
}

/**
 * Konsol /bantuan/{id} (R2-06, D-320): the request, its timeline
 * (replies, status changes, internal notes) and, with
 * `help_requests.manage`, reply (with an optional status change and
 * mail), internal note, status buttons and "Ambil". Support can open
 * the school read-only from here (D-341).
 */
export default function ConsoleHelpRequest({
  request,
  notes,
  statuses,
  supportSessionHours,
  can,
}: Props) {
  const t = useT()
  const base = `/bantuan/${request.id}`
  const nextStatus = request.status === 'new' ? 'in_progress' : request.status

  return (
    <>
      <PageHeader
        title={t('help.console.request_number', { number: request.id })}
        back={{ href: '/bantuan', label: t('help.console.back') }}
        meta={formatDateTime(request.createdAt)}
        actions={
          <>
            {can.openSchool && request.school && (
              <StartSupportSession
                schoolId={request.school.id}
                schoolName={request.school.name}
                hours={supportSessionHours}
              />
            )}
            {can.manage && !request.assignedToMe && (
              <Button
                variant="outline"
                onClick={() => router.post(`${base}/ambil`, {}, { preserveScroll: true })}
                data-testid="assign"
              >
                <Icon name="user" />
                {t('help.console.assign')}
              </Button>
            )}
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <HelpStatusChip status={request.status} />
          <StatusChip>{t(`help.categories.${request.category}`)}</StatusChip>
          {request.assignedToMe ? (
            <StatusChip tone="brand">{t('help.console.assigned_to_me')}</StatusChip>
          ) : (
            <span className="text-sm text-muted">
              {t('help.console.assignee')}: {request.assigneeName ?? t('help.console.no_assignee')}
            </span>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-4">
          <Section title={t('help.console.message')}>
            <p className="break-words whitespace-pre-line">{request.message}</p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
              <dt className="text-muted">{t('help.console.sender')}</dt>
              <dd className="min-w-0 break-words">
                {request.senderName ?? '–'}
                {request.senderRole &&
                  ` · ${t('help.console.sender_role', { role: t(`nav.roles.${request.senderRole}`).toLowerCase() })}`}
                {request.senderEmail && (
                  <span className="block break-all text-muted">{request.senderEmail}</span>
                )}
              </dd>
              <dt className="text-muted">{t('help.console.school')}</dt>
              <dd className="min-w-0 break-words">
                {request.school ? (
                  <>
                    {can.viewSchool ? (
                      <Link
                        href={`/sekolah/${request.school.id}`}
                        className="font-semibold text-brand-strong hover:underline"
                      >
                        {request.school.name}
                      </Link>
                    ) : (
                      request.school.name
                    )}
                    {request.school.regionName && (
                      <span className="block text-muted">
                        {t(`regions.kinds.${request.school.regionKind}`, {
                          name: request.school.regionName,
                        })}
                      </span>
                    )}
                  </>
                ) : (
                  t('help.console.no_school')
                )}
              </dd>
              <dt className="text-muted">{t('help.console.page_url')}</dt>
              <dd className="min-w-0 break-all">
                {request.pageUrl ?? (
                  <span className="text-muted">{t('help.console.no_page_url')}</span>
                )}
              </dd>
            </dl>
          </Section>

          <Section title={t('help.console.timeline')}>
            {notes.length === 0 ? (
              <p className="text-muted">{t('help.console.timeline_empty')}</p>
            ) : (
              <ol className="space-y-3">
                {notes.map((note) =>
                  note.kind === 'status' ? (
                    <li key={note.id} className="flex flex-wrap gap-x-2 text-sm text-muted">
                      <Icon name="info" size={16} className="mt-0.5" />
                      <span>
                        {t('help.console.kind_status', {
                          status: t(`help.statuses.${note.status}`),
                        })}
                      </span>
                      <span>
                        · {note.staffName ?? '–'} · {formatDateTime(note.at)}
                      </span>
                    </li>
                  ) : (
                    <li
                      key={note.id}
                      className={cn(
                        'rounded-md border p-3',
                        note.kind === 'note' ? 'border-warn/35 bg-warn-tint' : 'bg-brand-tint/40'
                      )}
                      data-testid={`note-${note.kind}`}
                    >
                      <p className="flex flex-wrap items-center gap-x-2 text-sm">
                        <span className="font-semibold">
                          {note.kind === 'note'
                            ? t('help.console.kind_note')
                            : t('help.console.kind_reply')}
                        </span>
                        <span className="text-muted">
                          {note.staffName ?? '–'} · {formatDateTime(note.at)}
                        </span>
                        {note.emailed && (
                          <span className="text-muted">· {t('help.console.emailed')}</span>
                        )}
                      </p>
                      <p className="mt-1 break-words whitespace-pre-line">{note.body}</p>
                    </li>
                  )
                )}
              </ol>
            )}
          </Section>
        </div>

        <div className="min-w-0 space-y-4">
          {!can.manage && (
            <p className="rounded-md border bg-surface p-4 text-sm text-muted">
              {t('help.console.read_only')}
            </p>
          )}

          {can.manage && (
            <Section
              title={t('help.console.reply_title')}
              description={t('help.console.reply_hint')}
            >
              <Form
                action={`${base}/balas`}
                method="post"
                resetOnSuccess
                options={{ preserveScroll: true }}
                className="space-y-3"
              >
                {({ errors, processing }) => (
                  <>
                    <FormField label={t('help.console.reply_body')} error={errors.body}>
                      {(field) => (
                        <textarea
                          {...field}
                          name="body"
                          required
                          maxLength={4000}
                          rows={5}
                          className={cn(controlClass, 'py-2.5')}
                        />
                      )}
                    </FormField>
                    <FormField label={t('help.console.reply_status')} error={errors.status}>
                      {(field) => (
                        <select
                          {...field}
                          name="status"
                          defaultValue={nextStatus}
                          className={controlClass}
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {t(`help.statuses.${status}`)}
                            </option>
                          ))}
                        </select>
                      )}
                    </FormField>
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input type="checkbox" name="email" value="1" className="size-5" />
                      {t('help.console.reply_email')}
                    </label>
                    <Button type="submit" disabled={processing}>
                      {t('help.console.reply_submit')}
                    </Button>
                  </>
                )}
              </Form>
            </Section>
          )}

          {can.manage && (
            <Section
              title={t('help.console.status_title')}
              description={t('help.console.status_hint')}
            >
              <div className="flex flex-wrap gap-2">
                {statuses
                  .filter((status) => status !== request.status)
                  .map((status) => (
                    <Button
                      key={status}
                      variant="outline"
                      onClick={() =>
                        router.post(`${base}/status`, { status }, { preserveScroll: true })
                      }
                    >
                      {t('help.console.set_status', { status: t(`help.statuses.${status}`) })}
                    </Button>
                  ))}
              </div>
            </Section>
          )}

          {can.manage && (
            <Section title={t('help.console.note_title')} description={t('help.console.note_hint')}>
              <Form
                action={`${base}/catatan`}
                method="post"
                resetOnSuccess
                options={{ preserveScroll: true }}
                className="space-y-3"
              >
                {({ errors, processing }) => (
                  <>
                    <FormField label={t('help.console.note_body')} error={errors.body}>
                      {(field) => (
                        <textarea
                          {...field}
                          name="body"
                          required
                          maxLength={4000}
                          rows={3}
                          className={cn(controlClass, 'py-2.5')}
                        />
                      )}
                    </FormField>
                    <Button type="submit" variant="outline" disabled={processing}>
                      {t('help.console.note_submit')}
                    </Button>
                  </>
                )}
              </Form>
            </Section>
          )}
        </div>
      </div>
    </>
  )
}
