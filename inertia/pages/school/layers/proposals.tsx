import { Form } from '@inertiajs/react'
import { Button } from '~/components/ui/button'
import { EmptyState } from '~/components/patterns/empty_state'
import { controlClass } from '~/components/patterns/form_field'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip, type StatusTone } from '~/components/patterns/status_chip'
import { formatDate } from '~/lib/dates'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

type Proposal = {
  id: string
  domain: string
  action: string
  label: string
  reason: string | null
  status: string
  proposedBy: string | null
  own: boolean
  decidedBy: string | null
  decisionNote: string | null
  createdOn: string
}

type Props = {
  canDecide: boolean
  waiting: Proposal[]
  decided: Proposal[]
}

const fieldClass = cn(controlClass, 'h-11')

/** Usulan statuses as chips (text plus colour, D-263). */
const statusTone: Record<string, StatusTone> = {
  submitted: 'info',
  returned: 'warn',
  approved: 'ok',
  rejected: 'danger',
}

/**
 * Usulan (D-380): the operator decides school proposals; teachers and
 * the principal follow their own.
 */
export default function Proposals({ canDecide, waiting, decided }: Props) {
  const t = useT()

  return (
    <>
      <PageHeader
        title={t('layers.proposals.title')}
        description={t(
          canDecide ? 'layers.proposals.intro_operator' : 'layers.proposals.intro_proposer'
        )}
      />

      <section aria-labelledby="waiting-title">
        <h2 id="waiting-title" className="text-lg font-bold">
          {t('layers.proposals.waiting_title')}
        </h2>
        {waiting.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon="proposals"
            description={t('layers.proposals.waiting_empty')}
          />
        ) : (
          <ul className="mt-3 space-y-3">
            {waiting.map((proposal) => (
              <li key={proposal.id} className="rounded-lg border bg-surface p-4">
                <Summary proposal={proposal} />
                {canDecide && !proposal.own && <Decide proposal={proposal} />}
                {proposal.own && (
                  <Form
                    action={`/usulan/${proposal.id}/tarik`}
                    method="post"
                    options={{ preserveScroll: true }}
                    className="mt-3"
                  >
                    {({ processing }) => (
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={processing}
                        className="w-full sm:w-auto"
                      >
                        {t('layers.proposals.withdraw')}
                      </Button>
                    )}
                  </Form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section aria-labelledby="decided-title" className="mt-8">
          <h2 id="decided-title" className="text-lg font-bold">
            {t('layers.proposals.decided_title')}
          </h2>
          <ul className="mt-3 space-y-3">
            {decided.map((proposal) => (
              <li key={proposal.id} className="rounded-lg border bg-surface p-4">
                <Summary proposal={proposal} />
                {proposal.decisionNote && <p className="mt-2 text-sm">{proposal.decisionNote}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function Summary({ proposal }: { proposal: Proposal }) {
  const t = useT()
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-bold break-words">
          {t(`layers.proposals.actions.${proposal.action}`, { label: proposal.label })}
        </h3>
        <StatusChip tone={statusTone[proposal.status] ?? 'neutral'}>
          {t(`layers.proposals.status.${proposal.status}`)}
        </StatusChip>
      </div>
      <p className="text-sm text-muted">
        {formatDate(proposal.createdOn)}
        {proposal.proposedBy ? ` · ${t('layers.proposals.by', { name: proposal.proposedBy })}` : ''}
      </p>
      {proposal.reason && (
        <p className="mt-2 text-sm">{t('layers.proposals.reason', { reason: proposal.reason })}</p>
      )}
    </>
  )
}

function Decide({ proposal }: { proposal: Proposal }) {
  const t = useT()
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <Form
        action={`/usulan/${proposal.id}/setujui`}
        method="post"
        options={{ preserveScroll: true }}
        className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end"
      >
        {({ processing }) => (
          <>
            <label className="flex-1 space-y-1.5 text-sm">
              <span className="block font-semibold">{t('layers.proposals.note')}</span>
              <input name="note" maxLength={500} className={fieldClass} />
            </label>
            <Button type="submit" disabled={processing} className="w-full sm:w-auto">
              {t('layers.proposals.approve')}
            </Button>
          </>
        )}
      </Form>
      <Form
        action={`/usulan/${proposal.id}/tolak`}
        method="post"
        options={{ preserveScroll: true }}
      >
        {({ processing }) => (
          <Button
            type="submit"
            variant="outline"
            disabled={processing}
            className="w-full sm:w-auto"
          >
            {t('layers.proposals.reject')}
          </Button>
        )}
      </Form>
    </div>
  )
}

