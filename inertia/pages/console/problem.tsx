import { useState } from 'react'
import { Form, Link, router, useForm } from '@inertiajs/react'
import { ConfirmAction, ConfirmDialog } from '~/components/patterns/confirm_dialog'
import { FormField, controlClass } from '~/components/patterns/form_field'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { PlaceFields, type RegionOptions } from '~/components/problems/place_fields'
import { ProblemStatusChip, regionLabel } from '~/components/problems/problem_status_chip'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatDate } from '~/lib/dates'
import { formatDateTime } from '~/lib/format'
import { cn } from '~/lib/utils'

type Ref = { id: number; number: string; title: string }

type Props = {
  problem: {
    id: number
    number: string
    title: string
    description: string
    source: string
    status: string
    level: string | null
    regionId: number | null
    region: { name: string; kind: string } | null
    releaseNote: string | null
    recordedBy: string | null
    createdAt: string
    statusChangedAt: string
    mergedInto: { id: number; number: string } | null
  }
  reports: {
    id: number
    helpRequestId: number | null
    schoolName: string | null
    region: { name: string; kind: string } | null
    role: string | null
    notifiedAt: string | null
    linkedAt: string
  }[]
  analyses: {
    id: number
    rootCause: string
    regulations: string | null
    evidenceLinks: string[]
    author: string | null
    credits: string[]
    createdAt: string
  }[]
  forum: { meetingId: number; heldOn: string; outcome: string | null; note: string | null }[]
  practices: { id: number; title: string; type: string; authors: string[]; link: string | null }[]
  merged: Ref[]
  moves: string[]
  can: { triage: boolean; analyse: boolean; forum: boolean }
  regions: RegionOptions | null
  levels: string[]
  researchers: { id: number; name: string }[]
  mergeTargets: Ref[]
}

/**
 * Konsol /bank-masalah/{id} (R2-07, D-439): the problem, its reporters
 * (school and role), analyses with credited researchers, forum
 * decisions and related good practices. Status buttons follow the
 * team whose step it is (`problems.triage`, `.analyse`, `.deliver`);
 * Diputuskan comes from the forum. Triage edits and merges duplicates.
 */
export default function ConsoleProblem(props: Props) {
  const { problem, reports, analyses, forum, practices, merged, moves, can } = props
  const t = useT()
  const base = `/bank-masalah/${problem.id}`

  return (
    <>
      <PageHeader
        title={problem.title}
        headTitle={`${problem.number} · ${problem.title}`}
        back={{ href: '/bank-masalah', label: t('problems.detail.back') }}
        meta={problem.number}
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ProblemStatusChip status={problem.status} />
          <StatusChip>{t(`problems.sources.${problem.source}`)}</StatusChip>
          {problem.level && <StatusChip>{t(`problems.levels.${problem.level}`)}</StatusChip>}
          <span className="text-sm text-muted">
            {t('problems.detail.since', { date: formatDateTime(problem.statusChangedAt) })}
          </span>
        </div>
      </PageHeader>

      {problem.mergedInto && (
        <p className="mb-4 rounded-md border border-info/30 bg-info-tint p-4 text-sm">
          {t('problems.detail.merged_into')}{' '}
          <Link
            href={`/bank-masalah/${problem.mergedInto.id}`}
            className="font-semibold text-brand-strong hover:underline"
          >
            {problem.mergedInto.number}
          </Link>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-4">
          <Section title={t('problems.detail.description')}>
            <p className="break-words whitespace-pre-line">{problem.description}</p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
              <dt className="text-muted">{t('problems.fields.region')}</dt>
              <dd>{regionLabel(t, problem.region)}</dd>
              <dt className="text-muted">{t('problems.detail.recorded_by')}</dt>
              <dd className="break-words">
                {problem.recordedBy ?? '–'} · {formatDateTime(problem.createdAt)}
              </dd>
              {problem.releaseNote && (
                <>
                  <dt className="text-muted">{t('problems.fields.release_note')}</dt>
                  <dd className="break-words whitespace-pre-line">{problem.releaseNote}</dd>
                </>
              )}
            </dl>
            {merged.length > 0 && (
              <div className="mt-4 text-sm">
                <p className="text-muted">{t('problems.detail.merged_here')}</p>
                <ul className="mt-1 space-y-1">
                  {merged.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/bank-masalah/${item.id}`}
                        className="font-semibold text-brand-strong hover:underline"
                      >
                        {item.number}
                      </Link>{' '}
                      <span className="break-words">{item.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section
            title={t('problems.detail.analyses')}
            description={t('problems.detail.analyses_hint')}
          >
            {analyses.length === 0 ? (
              <p className="text-muted">{t('problems.detail.no_analyses')}</p>
            ) : (
              <ol className="space-y-4">
                {analyses.map((analysis) => (
                  <li key={analysis.id} className="rounded-md border p-3" data-testid="analysis">
                    <p className="text-sm font-semibold">{t('problems.fields.root_cause')}</p>
                    <p className="break-words whitespace-pre-line">{analysis.rootCause}</p>
                    {analysis.regulations && (
                      <>
                        <p className="mt-3 text-sm font-semibold">
                          {t('problems.fields.regulations')}
                        </p>
                        <p className="break-words whitespace-pre-line">{analysis.regulations}</p>
                      </>
                    )}
                    {analysis.evidenceLinks.length > 0 && (
                      <>
                        <p className="mt-3 text-sm font-semibold">
                          {t('problems.fields.evidence_links')}
                        </p>
                        <ul className="mt-1 space-y-1">
                          {analysis.evidenceLinks.map((url) => (
                            <li key={url} className="break-all">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-11 items-center gap-1 text-brand-strong hover:underline sm:min-h-0"
                              >
                                {url}
                                <Icon name="external" size={14} />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    <p className="mt-3 text-sm text-muted">
                      {t('problems.detail.credits', { names: analysis.credits.join(', ') })} ·{' '}
                      {formatDateTime(analysis.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
            {can.analyse && (
              <AnalysisForm action={`${base}/analisis`} researchers={props.researchers} />
            )}
          </Section>

          <Section
            title={t('problems.detail.reports', { count: reports.length })}
            description={t('problems.detail.reports_hint')}
          >
            {reports.length === 0 ? (
              <p className="text-muted">{t('problems.detail.no_reports')}</p>
            ) : (
              <ul className="divide-y">
                {reports.map((report) => (
                  <li
                    key={report.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block break-words">
                        {report.schoolName ?? t('problems.detail.no_school')}
                        {report.role && ` · ${t(`nav.roles.${report.role}`)}`}
                      </span>
                      <span className="block text-xs text-muted">
                        {regionLabel(t, report.region)} · {formatDateTime(report.linkedAt)}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {report.notifiedAt && (
                        <StatusChip tone="ok" icon>
                          {t('problems.detail.notified')}
                        </StatusChip>
                      )}
                      {report.helpRequestId && (
                        <Link
                          href={`/bantuan/${report.helpRequestId}`}
                          className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-strong hover:underline"
                        >
                          {t('problems.detail.open_request', { number: report.helpRequestId })}
                        </Link>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {forum.length > 0 && (
            <Section title={t('problems.detail.forum')}>
              <ul className="space-y-2">
                {forum.map((item) => (
                  <li key={item.meetingId} className="text-sm">
                    {can.forum ? (
                      <Link
                        href={`/forum/${item.meetingId}`}
                        className="font-semibold text-brand-strong hover:underline"
                      >
                        {t('problems.forum.meeting_title', { date: formatDate(item.heldOn) })}
                      </Link>
                    ) : (
                      t('problems.forum.meeting_title', { date: formatDate(item.heldOn) })
                    )}
                    {' · '}
                    {item.outcome
                      ? t(`problems.forum.outcomes.${item.outcome}`)
                      : t('problems.forum.on_agenda')}
                    {item.note && <span className="block break-words text-muted">{item.note}</span>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {practices.length > 0 && (
            <Section title={t('problems.detail.practices')}>
              <ul className="space-y-2">
                {practices.map((practice) => (
                  <li key={practice.id} className="text-sm">
                    <span className="font-semibold break-words">{practice.title}</span> ·{' '}
                    {t(`problems.practices.types.${practice.type}`)}
                    <span className="block text-muted">
                      {t('problems.practices.by', { names: practice.authors.join(', ') })}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <StatusSection base={base} status={problem.status} moves={moves} />

          {can.triage && props.regions && (
            <EditSection
              base={base}
              problem={problem}
              regions={props.regions}
              levels={props.levels}
            />
          )}

          {can.triage && <MergeSection base={base} targets={props.mergeTargets} />}
        </div>
      </div>
    </>
  )
}

function StatusSection({ base, status, moves }: { base: string; status: string; moves: string[] }) {
  const t = useT()
  const plain = moves.filter((move) => move !== 'released' && move !== 'closed')
  return (
    <Section
      title={t('problems.detail.status_title')}
      description={t(`problems.next_steps.${status}`)}
    >
      {moves.length === 0 ? (
        <p className="text-sm text-muted">{t('problems.detail.no_moves')}</p>
      ) : (
        <div className="space-y-4">
          {plain.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {plain.map((move) => (
                <Button
                  key={move}
                  variant="outline"
                  onClick={() =>
                    router.post(`${base}/status`, { status: move }, { preserveScroll: true })
                  }
                  data-testid={`move-${move}`}
                >
                  {t('problems.detail.move_to', { status: t(`problems.statuses.${move}`) })}
                </Button>
              ))}
            </div>
          )}
          {moves.includes('closed') && (
            <ConfirmAction
              action={`${base}/status`}
              data={{ status: 'closed' }}
              label={t('problems.detail.close')}
              title={t('problems.detail.close')}
              description={t('problems.detail.close_hint')}
              confirmLabel={t('problems.detail.close')}
            />
          )}
          {moves.includes('released') && (
            <Form
              action={`${base}/status`}
              method="post"
              options={{ preserveScroll: true }}
              className="space-y-3 rounded-md border p-3"
            >
              {({ errors, processing }) => (
                <>
                  <input type="hidden" name="status" value="released" />
                  <FormField
                    label={t('problems.fields.release_note')}
                    hint={t('problems.fields.release_note_hint')}
                    optionalLabel={t('problems.fields.optional')}
                    error={errors.release_note}
                  >
                    {(field) => (
                      <textarea
                        {...field}
                        name="release_note"
                        maxLength={1000}
                        rows={3}
                        className={cn(controlClass, 'py-2.5')}
                      />
                    )}
                  </FormField>
                  <Button type="submit" disabled={processing} data-testid="move-released">
                    {t('problems.detail.release')}
                  </Button>
                </>
              )}
            </Form>
          )}
        </div>
      )}
    </Section>
  )
}

function EditSection({
  base,
  problem,
  regions,
  levels,
}: {
  base: string
  problem: Props['problem']
  regions: RegionOptions
  levels: string[]
}) {
  const t = useT()
  const form = useForm<{
    title: string
    description: string
    region_id: number | null
    level: string | null
  }>({
    title: problem.title,
    description: problem.description,
    region_id: problem.regionId,
    level: problem.level,
  })
  return (
    <Section title={t('problems.detail.edit_title')}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          form.post(`${base}/ubah`, { preserveScroll: true })
        }}
      >
        <TextField
          label={t('problems.fields.title')}
          name="title"
          required
          maxLength={160}
          value={form.data.title}
          onChange={(event) => form.setData('title', event.target.value)}
          error={form.errors.title}
        />
        <FormField label={t('problems.fields.description')} error={form.errors.description}>
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
        <PlaceFields
          options={regions}
          levels={levels}
          regionId={form.data.region_id}
          level={form.data.level}
          errors={form.errors}
          onRegion={(value) => form.setData('region_id', value)}
          onLevel={(value) => form.setData('level', value)}
        />
        <Button type="submit" variant="outline" disabled={form.processing}>
          {t('problems.detail.save')}
        </Button>
      </form>
    </Section>
  )
}

function MergeSection({ base, targets }: { base: string; targets: Ref[] }) {
  const t = useT()
  const [target, setTarget] = useState('')
  const [open, setOpen] = useState(false)
  const chosen = targets.find((item) => String(item.id) === target)
  return (
    <Section title={t('problems.merge.title')} description={t('problems.merge.hint')}>
      {targets.length === 0 ? (
        <p className="text-sm text-muted">{t('problems.merge.none')}</p>
      ) : (
        <div className="space-y-3">
          <FormField label={t('problems.merge.target')}>
            {(field) => (
              <select
                {...field}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className={controlClass}
              >
                <option value="">{t('problems.merge.pick')}</option>
                {targets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.number} · {item.title}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <Button variant="outline" disabled={!chosen} onClick={() => setOpen(true)}>
            <Icon name="merge" />
            {t('problems.merge.submit')}
          </Button>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title={t('problems.merge.confirm_title')}
            description={chosen ? t('problems.merge.confirm', { number: chosen.number }) : ''}
            confirmLabel={t('problems.merge.submit')}
            destructive={false}
            onConfirm={() => {
              setOpen(false)
              router.post(`${base}/gabungkan`, { target_id: Number(target) })
            }}
          />
        </div>
      )}
    </Section>
  )
}

function AnalysisForm({
  action,
  researchers,
}: {
  action: string
  researchers: { id: number; name: string }[]
}) {
  const t = useT()
  return (
    <Form
      action={action}
      method="post"
      resetOnSuccess
      options={{ preserveScroll: true }}
      className="mt-6 space-y-4 border-t pt-4"
    >
      {({ errors, processing }) => (
        <>
          <h3 className="font-bold">{t('problems.analysis.title')}</h3>
          <FormField
            label={t('problems.fields.root_cause')}
            hint={t('problems.analysis.root_cause_hint')}
            error={errors.root_cause}
          >
            {(field) => (
              <textarea
                {...field}
                name="root_cause"
                required
                maxLength={4000}
                rows={4}
                className={cn(controlClass, 'py-2.5')}
              />
            )}
          </FormField>
          <FormField
            label={t('problems.fields.regulations')}
            hint={t('problems.analysis.regulations_hint')}
            optionalLabel={t('problems.fields.optional')}
            error={errors.regulations}
          >
            {(field) => (
              <textarea
                {...field}
                name="regulations"
                maxLength={2000}
                rows={3}
                className={cn(controlClass, 'py-2.5')}
              />
            )}
          </FormField>
          <FormField
            label={t('problems.fields.evidence_links')}
            hint={t('problems.analysis.links_hint')}
            optionalLabel={t('problems.fields.optional')}
            error={errors.evidence_links}
          >
            {(field) => (
              <textarea
                {...field}
                name="evidence_links"
                rows={3}
                className={cn(controlClass, 'py-2.5')}
              />
            )}
          </FormField>
          {researchers.length > 0 && (
            <fieldset className="space-y-1">
              <legend className="text-sm font-semibold">{t('problems.analysis.credit')}</legend>
              <p className="text-xs text-muted">{t('problems.analysis.credit_hint')}</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {researchers.map((person) => (
                  <label key={person.id} className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      name="credited_staff_ids[]"
                      value={person.id}
                      className="size-5"
                    />
                    <span className="break-words">{person.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <FormField
            label={t('problems.fields.credited_names')}
            hint={t('problems.analysis.names_hint')}
            optionalLabel={t('problems.fields.optional')}
            error={errors.credited_names}
          >
            {(field) => (
              <textarea
                {...field}
                name="credited_names"
                rows={2}
                className={cn(controlClass, 'py-2.5')}
              />
            )}
          </FormField>
          <Button type="submit" disabled={processing}>
            {t('problems.analysis.submit')}
          </Button>
        </>
      )}
    </Form>
  )
}
