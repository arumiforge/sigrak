import { useState } from 'react'
import { Link, router } from '@inertiajs/react'
import { ConfirmAction } from '~/components/patterns/confirm_dialog'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { PageHeader } from '~/components/patterns/page_header'
import { ResponsiveDialog } from '~/components/patterns/responsive_dialog'
import { StatusChip } from '~/components/patterns/status_chip'
import { Section } from '~/components/section'
import { ActionLabel } from '~/components/staff/action_label'
import { VersionStatus, type VersionSummary } from '~/components/curriculum/version_status'
import { Button } from '~/components/ui/button'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'
import { formatDateTime, formatNumber } from '~/lib/format'
import { cn } from '~/lib/utils'

type Refusal = 'own_import' | 'changed_since_signoff' | 'predecessor_unpublished'

type Props = {
  version: VersionSummary & {
    curatedSubjects: string[]
    files: string[]
    importedBy: string[]
    signOff: { by: string | null; at: string; note: string | null } | null
    published: { by: string | null; at: string } | null
  }
  counts: Record<'allocations' | 'elements' | 'outcomes' | 'topics' | 'objectives', number>
  predecessor: VersionSummary | null
  successors: VersionSummary[]
  history: {
    id: number
    action: string
    note: string | null
    file: string | null
    at: string
    by: string | null
  }[]
  can: {
    signOff: boolean
    withdraw: boolean
    publish: boolean
    rollback: boolean
    blocked: Refusal[]
  }
}

const STEPS = ['draft', 'signed_off', 'active'] as const

/**
 * Konsol /kurikulum/{id} (R2-08, D-317): one curriculum version, its
 * sign-off (validator, `curriculum.signoff`, never one's own import,
 * D-339), its publication and rollback (curriculum curator,
 * `curriculum.publish`), what it holds, the versions before and after
 * it, and its logged history. The server checks every action again.
 */
export default function CurriculumVersion({
  version,
  counts,
  predecessor,
  successors,
  history,
  can,
}: Props) {
  const t = useT()
  const base = `/kurikulum/${version.id}`
  const [signing, setSigning] = useState(false)
  const anyAction = can.signOff || can.withdraw || can.publish || can.rollback

  return (
    <>
      <PageHeader
        title={version.code}
        headTitle={t('curriculum.version.head_title', { code: version.code })}
        back={{ href: '/kurikulum', label: t('curriculum.version.back') }}
        description={version.name}
        meta={<VersionStatus version={version} />}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`${base}/bandingkan`} prefetch>
                {t('curriculum.version.compare')}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${base}/dampak`} prefetch>
                {t('curriculum.version.impact')}
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-4">
          <Section
            title={t('curriculum.version.review_title')}
            description={t('curriculum.version.review_intro')}
          >
            <Steps status={version.status} />

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-semibold">{t('curriculum.version.imported_by')}</dt>
                <dd className="text-muted">
                  {version.importedBy.length > 0
                    ? version.importedBy.join(', ')
                    : t('curriculum.version.imported_by_none')}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">{t('curriculum.version.signed_off')}</dt>
                <dd className="text-muted">
                  {version.signOff
                    ? t('curriculum.version.by_at', {
                        name: version.signOff.by ?? t('staff.audit.system'),
                        at: formatDateTime(version.signOff.at),
                      })
                    : t('curriculum.version.not_yet')}
                </dd>
                {version.signOff?.note && (
                  <dd className="mt-1 rounded-md border bg-page px-3 py-2 break-words whitespace-pre-line">
                    {version.signOff.note}
                  </dd>
                )}
              </div>
              <div>
                <dt className="font-semibold">{t('curriculum.version.published')}</dt>
                <dd className="text-muted">
                  {version.published
                    ? t('curriculum.version.by_at', {
                        name: version.published.by ?? t('staff.audit.system'),
                        at: formatDateTime(version.published.at),
                      })
                    : t('curriculum.version.not_yet')}
                </dd>
              </div>
            </dl>

            {can.blocked.length > 0 && (
              <ul className="mt-4 space-y-2" data-testid="blocked">
                {can.blocked.map((reason) => (
                  <li
                    key={reason}
                    className="flex gap-2 rounded-md border border-warn/35 bg-warn-tint px-3 py-2 text-sm text-warn"
                  >
                    <Icon name="warning" size={18} className="mt-0.5" />
                    <span>{t(`curriculum.blocked.${reason}`)}</span>
                  </li>
                ))}
              </ul>
            )}

            {anyAction ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {can.signOff && (
                  <Button onClick={() => setSigning(true)}>
                    {t('curriculum.version.sign_off')}
                  </Button>
                )}
                {can.publish && (
                  <ConfirmAction
                    action={`${base}/terbitkan`}
                    label={t('curriculum.version.publish')}
                    variant="default"
                    destructive={false}
                    title={t('curriculum.version.publish_title', { code: version.code })}
                    description={t('curriculum.version.publish_body')}
                    confirmLabel={t('curriculum.version.publish_confirm')}
                  />
                )}
                {can.withdraw && (
                  <ConfirmAction
                    action={`${base}/batalkan-pengesahan`}
                    label={t('curriculum.version.withdraw')}
                    title={t('curriculum.version.withdraw_title', { code: version.code })}
                    description={t('curriculum.version.withdraw_body')}
                    confirmLabel={t('curriculum.version.withdraw_confirm')}
                  />
                )}
                {can.rollback && (
                  <ConfirmAction
                    action={`${base}/kembalikan`}
                    label={t('curriculum.version.rollback')}
                    title={t('curriculum.version.rollback_title', { code: version.code })}
                    description={
                      predecessor
                        ? t('curriculum.version.rollback_body', { previous: predecessor.code })
                        : t('curriculum.version.rollback_body_first')
                    }
                    confirmLabel={t('curriculum.version.rollback_confirm')}
                  />
                )}
              </div>
            ) : (
              can.blocked.length === 0 && (
                <p className="mt-4 text-sm text-muted">{t('curriculum.version.view_only')}</p>
              )
            )}
          </Section>

          <Section title={t('curriculum.version.contents_title')}>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(Object.keys(counts) as (keyof Props['counts'])[]).map((key) => (
                <div key={key} className="rounded-md border bg-page px-3 py-2">
                  <dt className="text-xs text-muted">{t(`curriculum.counts.${key}`)}</dt>
                  <dd className="text-lg font-bold tabular-nums">{formatNumber(counts[key])}</dd>
                </div>
              ))}
            </dl>
            {version.kind === 'topics' && (
              <p className="mt-4 text-sm">
                <span className="font-semibold">{t('curriculum.version.curated')}: </span>
                {version.curatedSubjects.length > 0
                  ? version.curatedSubjects.join(', ')
                  : t('curriculum.version.curated_none')}
              </p>
            )}
            <div className="mt-4 text-sm">
              <p className="font-semibold">{t('curriculum.version.files')}</p>
              {version.files.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
                  {version.files.map((file) => (
                    <li key={file} className="break-all">
                      {file}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">{t('curriculum.version.files_none')}</p>
              )}
            </div>
            <p className="mt-4 text-sm text-muted">
              {t('curriculum.version.applies', {
                year: version.appliesFrom ?? t('curriculum.list.no_year'),
              })}
            </p>
          </Section>
        </div>

        <div className="min-w-0 space-y-4">
          <Section title={t('curriculum.version.line_title')}>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold">{t('curriculum.version.predecessor')}</p>
                {predecessor ? (
                  <VersionLink version={predecessor} />
                ) : (
                  <p className="text-muted">{t('curriculum.list.first_version')}</p>
                )}
              </div>
              <div>
                <p className="font-semibold">{t('curriculum.version.successors')}</p>
                {successors.length > 0 ? (
                  <ul className="space-y-1">
                    {successors.map((successor) => (
                      <li key={successor.id}>
                        <VersionLink version={successor} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">{t('curriculum.version.successors_none')}</p>
                )}
              </div>
            </div>
          </Section>

          <Section title={t('curriculum.version.history_title')}>
            {history.length === 0 ? (
              <p className="text-muted">{t('curriculum.version.history_empty')}</p>
            ) : (
              <ul className="space-y-3">
                {history.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <p className="font-medium">
                      <ActionLabel action={entry.action} />
                    </p>
                    <p className="text-muted">
                      {formatDateTime(entry.at)} · {entry.by ?? t('staff.audit.system')}
                    </p>
                    {entry.file && <p className="break-all text-muted">{entry.file}</p>}
                    {entry.note && (
                      <p className="mt-0.5 break-words whitespace-pre-line">{entry.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {can.signOff && (
        <SignOffDialog
          open={signing}
          onOpenChange={setSigning}
          action={`${base}/sahkan`}
          code={version.code}
        />
      )}
    </>
  )
}

function Steps({ status }: { status: VersionSummary['status'] }) {
  const t = useT()
  const reached = status === 'retired' ? -1 : STEPS.indexOf(status)
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {STEPS.map((step, index) => {
        const done = index <= reached
        return (
          <li key={step} className="flex items-center gap-2">
            {index > 0 && (
              <Icon name="chevron-right" size={16} className="hidden text-muted sm:block" />
            )}
            <span
              className={cn(
                'inline-flex size-7 items-center justify-center rounded-full border text-xs font-bold',
                done ? 'border-brand bg-brand text-on-brand' : 'bg-surface text-muted'
              )}
              aria-hidden
            >
              {done ? <Icon name="check" size={16} /> : index + 1}
            </span>
            <span className={cn('text-sm', done ? 'font-semibold' : 'text-muted')}>
              {t(`curriculum.steps.${step}`)}
              <span className="sr-only">
                {' '}
                ({done ? t('curriculum.steps.done') : t('curriculum.steps.todo')})
              </span>
            </span>
          </li>
        )
      })}
      {status === 'retired' && (
        <li>
          <StatusChip tone="neutral">{t('curriculum.statuses.retired')}</StatusChip>
        </li>
      )}
    </ol>
  )
}

function VersionLink({ version }: { version: VersionSummary }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Link
        href={`/kurikulum/${version.id}`}
        prefetch
        className="font-semibold break-all text-brand-strong hover:underline"
      >
        {version.code}
      </Link>
      <VersionStatus version={version} />
    </span>
  )
}

function SignOffDialog({
  open,
  onOpenChange,
  action,
  code,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: string
  code: string
}) {
  const t = useT()
  const [note, setNote] = useState('')
  const [processing, setProcessing] = useState(false)

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('curriculum.version.sign_off_title', { code })}
      description={t('curriculum.version.sign_off_body')}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            disabled={processing}
            data-testid="confirm-sign-off"
            onClick={() =>
              router.post(
                action,
                { note },
                {
                  preserveScroll: true,
                  onStart: () => setProcessing(true),
                  onFinish: () => setProcessing(false),
                  onSuccess: () => onOpenChange(false),
                }
              )
            }
          >
            {t('curriculum.version.sign_off_confirm')}
          </Button>
        </>
      }
    >
      <div className="px-4 pb-2 sm:px-0">
        <FormField
          label={t('curriculum.version.note')}
          optionalLabel={t('curriculum.version.optional')}
          hint={t('curriculum.version.note_hint')}
        >
          {(field) => (
            <textarea
              {...field}
              name="note"
              rows={4}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={cn(controlClass, 'py-2')}
            />
          )}
        </FormField>
      </div>
    </ResponsiveDialog>
  )
}
