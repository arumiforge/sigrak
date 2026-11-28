import type { ReactNode } from 'react'
import { Form, Head } from '@inertiajs/react'
import AppLayout from '~/layouts/app_layout'
import { Button } from '~/components/ui/button'
import { LayerNav } from '~/components/layers/layer_nav'
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

const fieldClass =
  'block h-11 w-full rounded-md border bg-surface px-3 text-base outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30'

/**
 * Usulan (D-380): the operator decides school proposals; teachers and
 * the principal follow their own.
 */
export default function Proposals({ canDecide, waiting, decided }: Props) {
  const t = useT()

  return (
    <>
      <Head title={t('layers.proposals.title')} />
      <LayerNav />
      <h1 className="text-2xl font-bold">{t('layers.proposals.title')}</h1>
      <p className="mt-2 max-w-3xl text-muted">
        {t(canDecide ? 'layers.proposals.intro_operator' : 'layers.proposals.intro_proposer')}
      </p>

      <section aria-labelledby="waiting-title" className="mt-6">
        <h2 id="waiting-title" className="text-lg font-bold">
          {t('layers.proposals.waiting_title')}
        </h2>
        {waiting.length === 0 ? (
          <p className="mt-2 rounded-md border bg-surface p-4 text-muted">
            {t('layers.proposals.waiting_empty')}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {waiting.map((proposal) => (
              <li key={proposal.id} className="rounded-xl border bg-surface p-4">
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
              <li key={proposal.id} className="rounded-xl border bg-surface p-4">
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
        <span
          className={cn(
            'inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold',
            proposal.status === 'approved' && 'border-ok/30 bg-ok/10 text-ok',
            proposal.status === 'rejected' && 'border-danger/30 bg-danger/10 text-danger',
            proposal.status === 'submitted' && 'border-brand/30 bg-brand-tint text-brand-strong'
          )}
        >
          {t(`layers.proposals.status.${proposal.status}`)}
        </span>
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

Proposals.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>
