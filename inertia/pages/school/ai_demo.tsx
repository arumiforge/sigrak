import { useState } from 'react'
import { Head, router, useForm } from '@inertiajs/react'
import { v4 as uuidv4 } from 'uuid'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Icon, type IconName } from '~/components/icon'
import { formatNumber, formatTime } from '~/lib/format'
import { useT } from '~/lib/i18n'
import { useChannel, type LiveStatus } from '~/lib/transmit'
import { cn } from '~/lib/utils'

type GenerationStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
type StepStatus = 'pending' | 'running' | 'succeeded' | 'failed'

/** Same shape as GenerationSnapshot on the server. */
type Generation = {
  id: string
  version: number
  status: GenerationStatus
  runs: number
  scenario: string | null
  totalSteps: number
  currentStep: number | null
  errorClass: string | null
  availableAt: string | null
  createdAt: string
  finishedAt: string | null
  steps: {
    key: string
    position: number
    status: StepStatus
    attempts: number
    output: string | null
  }[]
  attempts: {
    stepKey: string | null
    attempt: number
    keyLabel: string | null
    outcome: string
    latencyMs: number
  }[]
}

type ProgressMessage = { type: 'generation'; changedAt: number; generation: Generation }

type Props = {
  channel: string
  driver: 'fake' | 'gemini'
  scenarios: string[]
  keys: { label: string; status: 'active' | 'invalid' | 'disabled' }[]
  generation: Generation | null
}

/**
 * The page shows the latest generation. Messages from the web and the
 * worker process can arrive out of order: keep the newer generation
 * (UUIDv7 ids sort by time) and, for the same one, the newer snapshot.
 */
function newer(current: Generation | null, incoming: Generation | null) {
  if (!incoming) return current
  if (!current) return incoming
  if (incoming.id !== current.id) return incoming.id > current.id ? incoming : current
  return incoming.version >= current.version ? incoming : current
}

/** crypto.randomUUID() needs a secure context; local http hosts are not one. */
function newToken() {
  return uuidv4()
}

export default function AiDemoPage({
  channel,
  driver,
  scenarios,
  keys,
  generation: initial,
}: Props) {
  const t = useT()
  // Live messages and props (after a form post or a reload) both carry
  // snapshots; the page shows the newer one.
  const [pushed, setPushed] = useState<Generation | null>(null)
  const generation = newer(initial, pushed)

  const live = useChannel<ProgressMessage>(
    channel,
    (message) => setPushed((current) => newer(current, message.generation)),
    // After (re)subscribing, fetch what may have changed while not listening.
    () => router.reload({ only: ['generation'] })
  )

  const form = useForm({ clientToken: newToken(), scenario: scenarios[0] ?? 'smooth' })

  function start(event: React.FormEvent) {
    event.preventDefault()
    form.post('/coba-ai', {
      preserveScroll: true,
      onSuccess: () => form.setData('clientToken', newToken()),
    })
  }

  return (
    <>
      <Head title={t('ai_demo.title')} />

      <h1 className="text-2xl font-bold sm:text-3xl">{t('ai_demo.title')}</h1>
      <p className="mt-1 max-w-2xl text-muted">{t('ai_demo.intro')}</p>
      {driver === 'fake' && (
        <p className="mt-3 flex max-w-2xl items-start gap-2 rounded-md border bg-surface px-3 py-2 text-sm">
          <Icon name="info" className="mt-0.5 text-info" />
          {t('ai_demo.fake_notice')}
        </p>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="progress-title">
          <Card className="gap-4 px-4 py-5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="progress-title" className="text-xl font-semibold">
                {t('ai_demo.progress.heading')}
              </h2>
              <LiveIndicator status={live} />
            </div>
            {generation ? (
              <GenerationView generation={generation} />
            ) : (
              <p className="text-muted">{t('ai_demo.progress.empty')}</p>
            )}
          </Card>
        </section>

        <aside className="space-y-6">
          <Card className="gap-4 px-4 py-5 sm:px-6">
            <h2 className="text-lg font-semibold">{t('ai_demo.start.heading')}</h2>
            <form onSubmit={start} className="space-y-4">
              {scenarios.length > 0 && (
                <fieldset>
                  <legend className="text-sm font-semibold">
                    {t('ai_demo.start.scenario_label')}
                  </legend>
                  <div className="mt-2 space-y-1">
                    {scenarios.map((scenario) => (
                      <label
                        key={scenario}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-brand-tint"
                      >
                        <input
                          type="radio"
                          name="scenario"
                          value={scenario}
                          checked={form.data.scenario === scenario}
                          onChange={() => form.setData('scenario', scenario)}
                          className="size-4 accent-brand"
                        />
                        {t(`ai_demo.scenarios.${scenario}`)}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <Button
                type="submit"
                disabled={form.processing}
                className="w-full"
                data-testid="start-generation"
              >
                {form.processing && <Icon name="loading" />}
                {form.processing ? t('ai_demo.start.submitting') : t('ai_demo.start.submit')}
              </Button>
            </form>
          </Card>

          {keys.length > 0 && (
            <Card className="gap-3 px-4 py-5 sm:px-6">
              <h2 className="text-lg font-semibold">{t('ai_demo.keys.heading')}</h2>
              <ul className="space-y-1 text-sm">
                {keys.map((key) => (
                  <li key={key.label} className="flex justify-between gap-2">
                    <span>{key.label}</span>
                    <span className={cn('text-muted', key.status === 'invalid' && 'text-danger')}>
                      {t(`ai_demo.keys.${key.status}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  )
}

function LiveIndicator({ status }: { status: LiveStatus }) {
  const t = useT()
  return (
    <p
      role="status"
      data-testid="live-status"
      data-status={status}
      className={cn(
        'flex items-center gap-2 text-sm text-muted',
        status === 'failed' && 'text-danger'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-block size-2 rounded-full bg-muted',
          status === 'live' && 'bg-ok',
          status === 'failed' && 'bg-danger'
        )}
      />
      {t(`ai_demo.live.${status}`)}
    </p>
  )
}

const stepIcons: Record<StepStatus, IconName | null> = {
  pending: null,
  running: 'loading',
  succeeded: 'success',
  failed: 'error',
}

function failureMessage(t: ReturnType<typeof useT>, generation: Generation) {
  switch (generation.errorClass) {
    case 'no_usable_key':
      return generation.availableAt
        ? t('ai_demo.failures.no_usable_key', {
            time: formatTime(generation.availableAt),
          })
        : t('ai_demo.failures.busy')
    case 'rate_limited':
    case 'rate_limited_daily':
    case 'transient':
    case 'timeout':
      return t('ai_demo.failures.busy')
    case 'no_keys':
      return t('ai_demo.failures.no_keys')
    case 'key_invalid':
    case 'project_unavailable':
      return t('ai_demo.failures.key_invalid')
    case 'blocked':
      return t('ai_demo.failures.blocked')
    case 'malformed_output':
    case 'empty_reply':
      return t('ai_demo.failures.incomplete')
    default:
      return t('ai_demo.failures.general')
  }
}

function GenerationView({ generation }: { generation: Generation }) {
  const t = useT()
  const active = generation.status === 'queued' || generation.status === 'running'
  const canRetry = generation.status === 'failed' || generation.status === 'cancelled'
  const [busy, setBusy] = useState(false)

  function act(path: 'batal' | 'coba-lagi') {
    router.post(
      `/coba-ai/${generation.id}/${path}`,
      {},
      { preserveScroll: true, onStart: () => setBusy(true), onFinish: () => setBusy(false) }
    )
  }

  return (
    <div
      className="space-y-4"
      data-testid="generation"
      data-id={generation.id}
      data-status={generation.status}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={cn(
            'rounded-md bg-brand-tint px-2 py-1 text-sm font-semibold text-brand-strong',
            generation.status === 'failed' && 'bg-transparent text-danger',
            generation.status === 'cancelled' && 'bg-transparent text-muted'
          )}
          data-testid="generation-status"
        >
          {t(`ai_demo.status.${generation.status}`)}
        </span>
        {active && generation.currentStep && (
          <span className="text-sm text-muted">
            {t('ai_demo.progress.step_of', {
              current: generation.currentStep,
              total: generation.totalSteps,
            })}
          </span>
        )}
        {generation.scenario && (
          <span className="text-sm text-muted">
            {t(`ai_demo.scenarios.${generation.scenario}`)}
          </span>
        )}
      </div>

      <ol aria-label={t('ai_demo.progress.steps_label')} className="space-y-3">
        {generation.steps.map((step) => {
          const icon = stepIcons[step.status]
          return (
            <li
              key={step.key}
              data-testid={`step-${step.key}`}
              data-status={step.status}
              className="flex gap-3"
            >
              <span
                className={cn(
                  'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold text-muted',
                  step.status === 'running' && 'border-brand text-brand',
                  step.status === 'succeeded' && 'border-ok bg-ok text-white',
                  step.status === 'failed' && 'border-danger text-danger'
                )}
              >
                {icon ? <Icon name={icon} size={16} /> : step.position}
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{t(`ai_demo.steps.${step.key}`)}</p>
                <p className="text-sm text-muted">{t(`ai_demo.step_status.${step.status}`)}</p>
                {step.output && <p className="mt-1 text-sm">{step.output}</p>}
              </div>
            </li>
          )
        })}
      </ol>

      {generation.status === 'failed' && (
        <div role="alert" className="rounded-md border border-danger px-3 py-2 text-sm">
          <p className="font-semibold text-danger">{failureMessage(t, generation)}</p>
          <p className="mt-1 text-muted">{t('ai_demo.progress.kept_note')}</p>
        </div>
      )}

      {(active || canRetry) && (
        <div className="flex flex-wrap gap-2">
          {active && (
            <Button variant="outline" disabled={busy} onClick={() => act('batal')}>
              {t('ai_demo.actions.cancel')}
            </Button>
          )}
          {canRetry && (
            <Button disabled={busy} onClick={() => act('coba-lagi')}>
              {t('ai_demo.actions.retry')}
            </Button>
          )}
        </div>
      )}

      {generation.attempts.length > 0 && (
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-brand-strong">
            {t('ai_demo.details.toggle')}
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{t('ai_demo.details.caption')}</caption>
              <thead className="text-muted">
                <tr>
                  <th className="py-1 pr-3 font-semibold">{t('ai_demo.details.step')}</th>
                  <th className="py-1 pr-3 font-semibold">{t('ai_demo.details.attempt')}</th>
                  <th className="py-1 pr-3 font-semibold">{t('ai_demo.details.key')}</th>
                  <th className="py-1 pr-3 font-semibold">{t('ai_demo.details.outcome')}</th>
                  <th className="py-1 font-semibold">{t('ai_demo.details.duration')}</th>
                </tr>
              </thead>
              <tbody>
                {generation.attempts.map((attempt, index) => (
                  <tr key={index} className="border-t">
                    <td className="py-1 pr-3">
                      {attempt.stepKey ? t(`ai_demo.steps.${attempt.stepKey}`) : '–'}
                    </td>
                    <td className="py-1 pr-3">{attempt.attempt}</td>
                    <td className="py-1 pr-3">{attempt.keyLabel ?? '–'}</td>
                    <td className="py-1 pr-3">{t(`ai_demo.outcomes.${attempt.outcome}`)}</td>
                    <td className="py-1">
                      {t('ai_demo.details.duration_value', {
                        seconds: formatNumber(Math.round(attempt.latencyMs / 100) / 10),
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
