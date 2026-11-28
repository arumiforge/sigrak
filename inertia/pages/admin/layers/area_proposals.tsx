import { useState } from 'react'
import { Form } from '@inertiajs/react'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { Button } from '~/components/ui/button'
import { TextField } from '~/components/text_field'
import { useSourceLabel } from '~/components/layers/source'
import { formatDate } from '~/lib/dates'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'

type Region = { id: number; level: string; name: string; kind: string; parent: string | null }
type PackageOption = { id: string; regionId: number; domain: string; name: string; kind: string }
type Evidence = {
  regulation_code?: string | null
  document_title?: string | null
  source_url?: string | null
  pages?: number[] | null
  checked_on?: string | null
} | null

type Proposal = {
  id: string
  domain: string
  action: string
  status: string
  label: string
  itemKey: string | null
  reason: string | null
  evidence: Evidence
  area: { name: string; kind: string } | null
  packageName: string | null
  proposedBy: string | null
  own: boolean
  decidedBy: string | null
  decisionNote: string | null
  schoolsAffected: number | null
  createdOn: string
}

type Props = {
  canApprove: boolean
  domains: string[]
  schoolYear: string
  regions: Region[]
  packages: PackageOption[]
  waiting: Proposal[]
  returned: Proposal[]
  decided: Proposal[]
}

const fieldClass =
  'block h-11 w-full rounded-md border bg-surface px-3 text-base outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30'

const ACTIONS = ['create_package', 'add', 'hide', 'retire_package'] as const

/**
 * Usulan wilayah (staff console, §6, §9.3): area proposals with their
 * evidence; the proposer never sees an approve button on their own.
 */
export default function AreaProposals(props: Props) {
  const t = useT()

  return (
    <>
      <PageHeader title={t('layers.console.title')} description={t('layers.console.intro')}>
        {!props.canApprove && (
          <p className="mt-2 text-sm text-muted">{t('layers.console.approver_note')}</p>
        )}
      </PageHeader>

      <ProposalSection
        id="waiting"
        title={t('layers.console.waiting_title')}
        empty={t('layers.console.waiting_empty')}
        proposals={props.waiting}
        canApprove={props.canApprove}
      />
      {props.returned.length > 0 && (
        <ProposalSection
          id="returned"
          title={t('layers.console.returned_title')}
          empty={t('layers.console.waiting_empty')}
          proposals={props.returned}
          canApprove={props.canApprove}
        />
      )}
      {props.decided.length > 0 && (
        <ProposalSection
          id="decided"
          title={t('layers.console.decided_title')}
          empty={t('layers.console.waiting_empty')}
          proposals={props.decided}
          canApprove={false}
        />
      )}

      <NewProposal {...props} />
    </>
  )
}

function useAreaLabel() {
  const label = useSourceLabel()
  return (area: { name: string; kind: string }) =>
    label({
      layer:
        area.kind === 'province' ? 'province' : area.kind === 'district' ? 'district' : 'regency',
      regionName: area.name,
      regionKind: area.kind,
      packageKind: 'official',
    })
}

function ProposalSection({
  id,
  title,
  empty,
  proposals,
  canApprove,
}: {
  id: string
  title: string
  empty: string
  proposals: Proposal[]
  canApprove: boolean
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="mt-8 first-of-type:mt-0">
      <h2 id={`${id}-title`} className="text-lg font-bold">
        {title}
      </h2>
      {proposals.length === 0 ? (
        <EmptyState className="mt-3" icon="proposals" description={empty} />
      ) : (
        <ul className="mt-3 space-y-3">
          {proposals.map((proposal) => (
            <li key={proposal.id} className="rounded-lg border bg-surface p-4">
              <ProposalCard proposal={proposal} canApprove={canApprove} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ProposalCard({ proposal, canApprove }: { proposal: Proposal; canApprove: boolean }) {
  const t = useT()
  const areaLabel = useAreaLabel()
  const evidence = proposal.evidence
  const evidenceText = evidence
    ? [
        evidence.regulation_code,
        evidence.document_title,
        evidence.pages && evidence.pages.length > 0
          ? t('layers.origin_sheet.pages', { pages: evidence.pages.join(', ') })
          : null,
      ]
        .filter(Boolean)
        .join(', ')
    : ''

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-bold break-words">
          {t(`layers.proposals.actions.${proposal.action}`, { label: proposal.label })}
        </h3>
        <span className="inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold">
          {t(`layers.proposals.status.${proposal.status}`)}
        </span>
      </div>
      <p className="text-sm text-muted break-words">
        {[
          proposal.area ? areaLabel(proposal.area) : null,
          proposal.packageName,
          formatDate(proposal.createdOn),
          proposal.proposedBy
            ? t('layers.console.proposed_by', { name: proposal.proposedBy })
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border p-3 text-sm">
          <p className="text-xs font-semibold text-muted uppercase">
            {t('layers.console.current')}
          </p>
          <p className="mt-1 break-words">
            {proposal.action === 'create_package' || proposal.action === 'add'
              ? t('layers.console.nothing')
              : (proposal.itemKey ?? proposal.packageName ?? '')}
          </p>
        </div>
        <div className="rounded-md bg-brand-tint p-3 text-sm">
          <p className="text-xs font-semibold text-muted uppercase">
            {t('layers.console.proposed')}
          </p>
          <p className="mt-1 font-semibold break-words">
            {t(`layers.proposals.actions.${proposal.action}`, { label: proposal.label })}
          </p>
        </div>
      </div>

      {proposal.reason && (
        <p className="mt-2 text-sm">{t('layers.proposals.reason', { reason: proposal.reason })}</p>
      )}
      {evidence && (
        <p className="mt-2 text-sm break-words">
          <span className="font-semibold">{t('layers.console.evidence_title')}: </span>
          {evidenceText}
          {evidence.source_url && (
            <>
              {' '}
              <a
                href={evidence.source_url}
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-brand-strong underline-offset-4 hover:underline"
              >
                {t('layers.origin_sheet.open_source')}
              </a>
            </>
          )}
        </p>
      )}
      {proposal.schoolsAffected !== null && (
        <p className="mt-2 text-sm text-muted">
          {t('layers.console.schools_affected', { count: proposal.schoolsAffected })}
        </p>
      )}
      {proposal.decidedBy && (
        <p className="mt-1 text-sm text-muted">
          {t('layers.console.decided_by', { name: proposal.decidedBy })}
          {proposal.decisionNote ? ` · ${proposal.decisionNote}` : ''}
        </p>
      )}

      {proposal.own && ['submitted', 'returned'].includes(proposal.status) && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <p className="text-sm text-muted sm:flex-1">{t('layers.console.own')}</p>
          {proposal.status === 'returned' && (
            <SimpleAction
              path={`/usulan-wilayah/${proposal.id}/kirim-ulang`}
              label={t('layers.console.resubmit')}
            />
          )}
          <SimpleAction
            path={`/usulan-wilayah/${proposal.id}/tarik`}
            label={t('layers.console.withdraw')}
            variant="outline"
          />
        </div>
      )}
      {canApprove && !proposal.own && proposal.status === 'submitted' && (
        <Decision proposal={proposal} />
      )}
    </>
  )
}

function SimpleAction({
  path,
  label,
  variant = 'default',
}: {
  path: string
  label: string
  variant?: 'default' | 'outline'
}) {
  return (
    <Form action={path} method="post" options={{ preserveScroll: true }}>
      {({ processing }) => (
        <Button type="submit" variant={variant} disabled={processing} className="w-full sm:w-auto">
          {label}
        </Button>
      )}
    </Form>
  )
}

function Decision({ proposal }: { proposal: Proposal }) {
  const t = useT()
  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <Form
        action={`/usulan-wilayah/${proposal.id}/setujui`}
        method="post"
        options={{ preserveScroll: true }}
        className="flex flex-col gap-3"
      >
        {({ processing }) => (
          <>
            {proposal.evidence && (
              <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
                <input type="checkbox" name="evidence_checked" value="true" className="size-5" />
                {t('layers.console.evidence_checked')}
              </label>
            )}
            <label className="space-y-1.5 text-sm">
              <span className="block font-semibold">{t('layers.console.note')}</span>
              <input name="note" maxLength={500} className={fieldClass} />
            </label>
            <Button type="submit" disabled={processing} className="w-full sm:w-auto sm:self-start">
              {t('layers.console.approve')}
            </Button>
          </>
        )}
      </Form>
      <div className="flex flex-col gap-2 sm:flex-row">
        <SimpleAction
          path={`/usulan-wilayah/${proposal.id}/kembalikan`}
          label={t('layers.console.return')}
          variant="outline"
        />
        <SimpleAction
          path={`/usulan-wilayah/${proposal.id}/tolak`}
          label={t('layers.console.reject')}
          variant="outline"
        />
      </div>
    </div>
  )
}

function NewProposal({ domains, regions, packages, schoolYear }: Props) {
  const t = useT()
  const areaLabel = useAreaLabel()
  const [action, setAction] = useState<(typeof ACTIONS)[number]>('create_package')
  const [regionId, setRegionId] = useState<number>(regions[0]?.id ?? 0)
  const [domain, setDomain] = useState(domains[0] ?? '')
  const region = regions.find((entry) => entry.id === regionId)
  const regionPackages = packages.filter(
    (pkg) => pkg.regionId === regionId && pkg.domain === domain
  )

  return (
    <section aria-labelledby="new-title" className="mt-10 rounded-lg border bg-surface p-4 sm:p-6">
      <h2 id="new-title" className="text-lg font-bold">
        {t('layers.console.new_title')}
      </h2>
      <Form
        action="/usulan-wilayah"
        method="post"
        options={{ preserveScroll: true }}
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        {({ processing, errors }) => (
          <>
            <label className="space-y-1.5 text-sm">
              <span className="block font-semibold">{t('layers.console.domain')}</span>
              <select
                name="domain"
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                className={fieldClass}
              >
                {domains.map((name) => (
                  <option key={name} value={name}>
                    {t(`layers.packages.domains.${name}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="block font-semibold">{t('layers.console.area')}</span>
              <select
                name="region_id"
                value={regionId}
                onChange={(event) => setRegionId(Number(event.target.value))}
                className={fieldClass}
              >
                {regions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {areaLabel(entry)}
                    {entry.parent && entry.level === 'district' ? ` (${entry.parent})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="block font-semibold">{t('layers.console.action')}</span>
              <select
                name="action"
                value={action}
                onChange={(event) => setAction(event.target.value as (typeof ACTIONS)[number])}
                className={fieldClass}
              >
                {ACTIONS.map((name) => (
                  <option key={name} value={name}>
                    {t(`layers.console.actions.${name}`)}
                  </option>
                ))}
              </select>
            </label>

            {action === 'create_package' ? (
              <>
                <label className="space-y-1.5 text-sm">
                  <span className="block font-semibold">{t('layers.console.package_kind')}</span>
                  <select name="kind" className={fieldClass} defaultValue="local_agreement">
                    {(region?.level === 'district'
                      ? ['local_agreement']
                      : ['official', 'local_agreement']
                    ).map((kind) => (
                      <option key={kind} value={kind}>
                        {t(`layers.package_kinds.${kind}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <TextField
                  name="name"
                  label={t('layers.console.package_name')}
                  maxLength={200}
                  required
                  error={errors.name}
                />
                <label className="space-y-1.5 text-sm">
                  <span className="block font-semibold">{t('layers.console.line')}</span>
                  <select name="line" className={fieldClass} defaultValue="all">
                    {['all', 'kemendikdasmen', 'kemenag'].map((line) => (
                      <option key={line} value={line}>
                        {t(`layers.lines.${line}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="block font-semibold">{t('layers.console.level_scope')}</span>
                  <select name="level_scope" className={fieldClass} defaultValue="both">
                    {['both', 'sd', 'mi'].map((scope) => (
                      <option key={scope} value={scope}>
                        {t(`layers.console.level_scopes.${scope}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <TextField
                  name="applies_from_school_year"
                  label={t('layers.console.from_year')}
                  defaultValue={schoolYear}
                  maxLength={9}
                  inputMode="numeric"
                />
              </>
            ) : (
              <label className="space-y-1.5 text-sm">
                <span className="block font-semibold">{t('layers.console.package')}</span>
                <select name="package_id" className={fieldClass} defaultValue="">
                  <option value="" disabled>
                    {t('layers.console.package_none')}
                  </option>
                  {regionPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {action === 'add' && (
              <TextField
                name="label"
                label={t('layers.console.item_label')}
                maxLength={160}
                required
              />
            )}
            {action === 'hide' && (
              <TextField
                name="item_key"
                label={t('layers.console.item_key')}
                maxLength={80}
                required
              />
            )}

            <div className="sm:col-span-2">
              <TextField name="reason" label={t('layers.console.reason')} maxLength={500} />
            </div>

            <fieldset className={cn('space-y-3 sm:col-span-2')}>
              <legend className="font-semibold">{t('layers.console.evidence_title')}</legend>
              <p className="text-sm text-muted">{t('layers.console.evidence_hint')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  name="evidence_regulation"
                  label={t('layers.console.evidence_regulation')}
                  maxLength={120}
                />
                <TextField
                  name="evidence_document"
                  label={t('layers.console.evidence_document')}
                  maxLength={200}
                />
                <TextField
                  name="evidence_url"
                  type="url"
                  label={t('layers.console.evidence_url')}
                  maxLength={500}
                  error={errors.evidence_url}
                />
                <TextField
                  name="evidence_pages"
                  label={t('layers.console.evidence_pages')}
                  maxLength={100}
                />
              </div>
            </fieldset>

            <div className="sm:col-span-2">
              <Button type="submit" disabled={processing} className="w-full sm:w-auto">
                {t('layers.console.submit')}
              </Button>
            </div>
          </>
        )}
      </Form>
    </section>
  )
}
