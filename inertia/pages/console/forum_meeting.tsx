import { useState } from 'react'
import { Form, Link, router } from '@inertiajs/react'
import { ConfirmAction } from '~/components/patterns/confirm_dialog'
import { EmptyState } from '~/components/patterns/empty_state'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { ProblemStatusChip } from '~/components/problems/problem_status_chip'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatDate } from '~/lib/dates'
import { formatDateTime } from '~/lib/format'
import { cn } from '~/lib/utils'

type Item = {
  problemId: number
  number: string
  title: string
  problemStatus: string
  reports: number
  analyses: number
  outcome: string | null
  note: string | null
  decidedBy: string | null
  decidedAt: string | null
}

type Props = {
  meeting: {
    id: number
    heldOn: string
    status: string
    notes: string | null
    heldAt: string | null
    createdBy: string | null
  }
  items: Item[]
  candidates: { id: number; number: string; title: string }[]
  outcomes: string[]
  can: { manage: boolean; notes: boolean; decide: boolean; viewProblems: boolean }
}

const outcomeTone = { go: 'ok', decline: 'neutral', defer: 'warn' } as const

/**
 * Konsol /forum/{id} (R2-07, D-439): one Forum Masalah→Solusi
 * meeting. `forum.manage` builds the agenda from analysed problems
 * (add, order, remove), writes the notes and closes the meeting; the
 * owner (`problems.decide`) records go ahead, not pursued or later on
 * each item.
 */
export default function ConsoleForumMeeting({ meeting, items, candidates, outcomes, can }: Props) {
  const t = useT()
  const base = `/forum/${meeting.id}`
  const title = t('problems.forum.meeting_title', { date: formatDate(meeting.heldOn) })
  const open = items.filter((item) => !item.outcome).length

  return (
    <>
      <PageHeader
        title={title}
        back={{ href: '/forum', label: t('problems.forum.back') }}
        actions={
          can.manage && (
            <ConfirmAction
              action={`${base}/selesai`}
              label={t('problems.forum.mark_held')}
              title={t('problems.forum.mark_held')}
              description={
                open > 0
                  ? t('problems.forum.mark_held_open', { count: open })
                  : t('problems.forum.mark_held_hint')
              }
              confirmLabel={t('problems.forum.mark_held')}
              destructive={false}
              variant="outline"
              icon={<Icon name="check" />}
            />
          )
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusChip
            tone={meeting.status === 'held' ? 'ok' : 'info'}
            icon={meeting.status === 'held'}
          >
            {t(`problems.forum.statuses.${meeting.status}`)}
          </StatusChip>
          {meeting.heldAt && (
            <span className="text-sm text-muted">{formatDateTime(meeting.heldAt)}</span>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-4">
          <Section
            title={t('problems.forum.agenda')}
            description={
              can.decide ? t('problems.forum.agenda_decide_hint') : t('problems.forum.agenda_hint')
            }
          >
            {items.length === 0 ? (
              <EmptyState compact icon="forum" description={t('problems.forum.agenda_empty')} />
            ) : (
              <ol className="space-y-3">
                {items.map((item, index) => (
                  <AgendaItem
                    key={item.problemId}
                    base={base}
                    item={item}
                    index={index}
                    last={index === items.length - 1}
                    outcomes={outcomes}
                    can={can}
                  />
                ))}
              </ol>
            )}
          </Section>
        </div>

        <div className="min-w-0 space-y-4">
          {can.manage && (
            <Section
              title={t('problems.forum.add_title')}
              description={t('problems.forum.add_hint')}
            >
              {candidates.length === 0 ? (
                <p className="text-sm text-muted">{t('problems.forum.no_candidates')}</p>
              ) : (
                <Form
                  action={`${base}/agenda`}
                  method="post"
                  options={{ preserveScroll: true }}
                  className="space-y-3"
                >
                  {({ errors, processing }) => (
                    <>
                      <FormField label={t('problems.forum.problem')} error={errors.problem_id}>
                        {(field) => (
                          <select {...field} name="problem_id" required className={controlClass}>
                            {candidates.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.number} · {candidate.title}
                              </option>
                            ))}
                          </select>
                        )}
                      </FormField>
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={processing}
                        data-testid="add-item"
                      >
                        <Icon name="add" />
                        {t('problems.forum.add')}
                      </Button>
                    </>
                  )}
                </Form>
              )}
            </Section>
          )}

          <Section title={t('problems.forum.notes')} description={t('problems.forum.notes_hint')}>
            {can.notes ? (
              <Form
                action={`${base}/ubah`}
                method="post"
                options={{ preserveScroll: true }}
                className="space-y-3"
              >
                {({ errors, processing }) => (
                  <>
                    {meeting.status === 'planned' ? (
                      <TextField
                        label={t('problems.forum.date')}
                        name="held_on"
                        type="date"
                        required
                        defaultValue={meeting.heldOn}
                        error={errors.held_on}
                      />
                    ) : (
                      <input type="hidden" name="held_on" value={meeting.heldOn} />
                    )}
                    <FormField label={t('problems.forum.notes')} error={errors.notes}>
                      {(field) => (
                        <textarea
                          {...field}
                          name="notes"
                          maxLength={8000}
                          rows={6}
                          defaultValue={meeting.notes ?? ''}
                          className={cn(controlClass, 'py-2.5')}
                        />
                      )}
                    </FormField>
                    <Button type="submit" variant="outline" disabled={processing}>
                      {t('problems.forum.save_notes')}
                    </Button>
                  </>
                )}
              </Form>
            ) : meeting.notes ? (
              <p className="break-words whitespace-pre-line">{meeting.notes}</p>
            ) : (
              <p className="text-sm text-muted">{t('problems.forum.no_notes')}</p>
            )}
          </Section>
        </div>
      </div>
    </>
  )
}

function AgendaItem({
  base,
  item,
  index,
  last,
  outcomes,
  can,
}: {
  base: string
  item: Item
  index: number
  last: boolean
  outcomes: string[]
  can: Props['can']
}) {
  const t = useT()
  const [outcome, setOutcome] = useState(outcomes[0] ?? 'go')
  const move = (direction: 'up' | 'down') =>
    router.post(
      `${base}/agenda/pindah`,
      { problem_id: item.problemId, direction },
      { preserveScroll: true }
    )

  return (
    <li className="rounded-md border p-3" data-testid="agenda-item">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            {index + 1}. {item.number}
          </p>
          {can.viewProblems ? (
            <Link
              href={`/bank-masalah/${item.problemId}`}
              className="font-semibold break-words text-brand-strong hover:underline"
            >
              {item.title}
            </Link>
          ) : (
            <p className="font-semibold break-words">{item.title}</p>
          )}
          <p className="mt-1 text-sm text-muted">
            {t('problems.forum.item_facts', { reports: item.reports, analyses: item.analyses })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProblemStatusChip status={item.problemStatus} />
          {item.outcome && (
            <StatusChip tone={outcomeTone[item.outcome as keyof typeof outcomeTone] ?? 'neutral'}>
              {t(`problems.forum.outcomes.${item.outcome}`)}
            </StatusChip>
          )}
        </div>
      </div>

      {item.outcome && (
        <p className="mt-2 text-sm text-muted">
          {t('problems.forum.decided_by', { name: item.decidedBy ?? '–' })}
          {item.decidedAt && ` · ${formatDateTime(item.decidedAt)}`}
          {item.note && <span className="block break-words text-text">{item.note}</span>}
        </p>
      )}

      {can.manage && !item.outcome && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={index === 0}
            aria-label={t('problems.forum.move_up', { number: item.number })}
            onClick={() => move('up')}
          >
            <Icon name="chevron-up" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={last}
            aria-label={t('problems.forum.move_down', { number: item.number })}
            onClick={() => move('down')}
          >
            <Icon name="chevron-down" />
          </Button>
          <ConfirmAction
            action={`${base}/agenda/hapus`}
            data={{ problem_id: item.problemId }}
            label={t('problems.forum.remove')}
            ariaLabel={t('problems.forum.remove_named', { number: item.number })}
            title={t('problems.forum.remove_named', { number: item.number })}
            description={t('problems.forum.remove_hint')}
            confirmLabel={t('problems.forum.remove')}
            variant="ghost"
            size="sm"
          />
        </div>
      )}

      {can.decide && !item.outcome && (
        <Form
          action={`${base}/keputusan`}
          method="post"
          options={{ preserveScroll: true }}
          className="mt-3 space-y-3 border-t pt-3"
        >
          {({ errors, processing }) => (
            <>
              <input type="hidden" name="problem_id" value={item.problemId} />
              <fieldset>
                <legend className="text-sm font-semibold">{t('problems.forum.decision')}</legend>
                <div className="mt-1 flex flex-wrap gap-x-4">
                  {outcomes.map((value) => (
                    <label key={value} className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="outcome"
                        value={value}
                        checked={outcome === value}
                        onChange={() => setOutcome(value)}
                        className="size-5"
                      />
                      {t(`problems.forum.outcomes.${value}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <FormField
                label={t('problems.forum.decision_note')}
                optionalLabel={t('problems.fields.optional')}
                error={errors.note}
              >
                {(field) => (
                  <textarea
                    {...field}
                    name="note"
                    maxLength={1000}
                    rows={2}
                    className={cn(controlClass, 'py-2.5')}
                  />
                )}
              </FormField>
              <Button type="submit" disabled={processing} data-testid="decide">
                {t('problems.forum.save_decision')}
              </Button>
            </>
          )}
        </Form>
      )}
    </li>
  )
}
