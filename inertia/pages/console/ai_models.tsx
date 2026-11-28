import { useState } from 'react'
import { Form, Link, router } from '@inertiajs/react'
import { Icon } from '~/components/icon'
import { ConfirmAction } from '~/components/patterns/confirm_dialog'
import { PageHeader } from '~/components/patterns/page_header'
import { ResponsiveDialog } from '~/components/patterns/responsive_dialog'
import { StatusChip } from '~/components/patterns/status_chip'
import { Section } from '~/components/section'
import { SettingsTabs } from '~/components/settings_tabs'
import { TextField } from '~/components/text_field'
import { actionText } from '~/components/staff/action_label'
import { Button } from '~/components/ui/button'
import { formatDateTime } from '~/lib/format'
import { useT } from '~/lib/i18n'

type Purpose = {
  purpose: string
  models: string[]
  starting: string[]
  custom: boolean
  timeoutSeconds: number
  updatedAt: string | null
}

type RecentEntry = {
  id: number
  action: string
  purpose: string
  changes: { from?: string[]; to?: string[]; model?: string; ok?: boolean }
  by: string | null
  at: string
}

type Props = {
  purposes: Purpose[]
  maxModels: number
  teamKey: { set: boolean; last4: string | null }
  fakeDriver: boolean
  recent: RecentEntry[]
  can: { manage: boolean; manageKey: boolean }
}

const BASE = '/pengaturan/model-ai'

/**
 * Konsol /pengaturan/model-ai (R2-03, D-315): the active model and the
 * ordered fallbacks of each purpose, a test button per model (Tim
 * SIGRAK's key, never a teacher's) and the latest changes. Abilities:
 * `ai_models.view` reads, `ai_models.manage` (the owner) changes and
 * tests.
 */
export default function ConsoleAiModels({
  purposes,
  maxModels,
  teamKey,
  fakeDriver,
  recent,
  can,
}: Props) {
  const t = useT()
  const [editing, setEditing] = useState<Purpose | null>(null)
  const purposeName = (purpose: string) => t(`integrations.models.purposes.${purpose}`)

  return (
    <>
      <PageHeader
        title={t('integrations.models.title')}
        description={t('integrations.models.intro')}
      >
        {!can.manage && (
          <p className="mt-2 text-sm text-muted">{t('integrations.models.read_only')}</p>
        )}
      </PageHeader>
      <SettingsTabs />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          {purposes.map((purpose) => (
            <Section
              key={purpose.purpose}
              title={purposeName(purpose.purpose)}
              description={t(`integrations.models.purpose_notes.${purpose.purpose}`)}
              actions={
                purpose.custom ? (
                  <StatusChip tone="info">{t('integrations.models.custom')}</StatusChip>
                ) : (
                  <StatusChip tone="neutral">{t('integrations.models.starting')}</StatusChip>
                )
              }
            >
              <ol className="divide-y rounded-md border" data-testid={`models-${purpose.purpose}`}>
                {purpose.models.map((model, index) => (
                  <li key={model} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <code className="font-mono text-sm break-all">{model}</code>
                      {index === 0 ? (
                        <StatusChip tone="brand">{t('integrations.models.active')}</StatusChip>
                      ) : (
                        <StatusChip tone="neutral">
                          {t('integrations.models.fallback', { n: index })}
                        </StatusChip>
                      )}
                    </div>
                    {can.manage && (
                      <Form
                        action={`${BASE}/${purpose.purpose}/uji`}
                        method="post"
                        options={{ preserveScroll: true }}
                      >
                        {({ processing }) => (
                          <>
                            <input type="hidden" name="model" value={model} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              aria-label={t('integrations.models.test_label', { model })}
                              disabled={processing || !teamKey.set}
                            >
                              {processing && <Icon name="loading" size={16} />}
                              {t('integrations.models.test')}
                            </Button>
                          </>
                        )}
                      </Form>
                    )}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-sm text-muted">
                {t('integrations.models.timeout', { seconds: purpose.timeoutSeconds })}
                {purpose.custom &&
                  ` · ${t('integrations.models.starting_value', { models: purpose.starting.join(', ') })}`}
              </p>
              {can.manage && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t('integrations.models.edit_label', {
                      purpose: purposeName(purpose.purpose),
                    })}
                    onClick={() => setEditing(purpose)}
                  >
                    {t('integrations.models.edit')}
                  </Button>
                  {purpose.custom && (
                    <ConfirmAction
                      action={`${BASE}/${purpose.purpose}/awal`}
                      label={t('integrations.models.restore')}
                      variant="ghost"
                      size="sm"
                      destructive={false}
                      title={t('integrations.models.restore_title', {
                        purpose: purposeName(purpose.purpose),
                      })}
                      description={t('integrations.models.restore_body', {
                        models: purpose.starting.join(', '),
                      })}
                      confirmLabel={t('integrations.models.restore_confirm')}
                    />
                  )}
                </div>
              )}
            </Section>
          ))}
        </div>

        <div className="space-y-4">
          <Section title={t('integrations.models.test_title')}>
            <p className="text-sm">
              {teamKey.set
                ? teamKey.last4
                  ? t('integrations.models.team_key_set', { last4: teamKey.last4 })
                  : t('integrations.models.team_key_set_short')
                : t('integrations.models.team_key_missing')}
            </p>
            {fakeDriver && (
              <p className="mt-2 text-sm text-muted">{t('integrations.models.fake_note')}</p>
            )}
            {can.manageKey && (
              <Link
                href="/pengaturan/integrasi"
                prefetch
                className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-strong hover:underline"
              >
                {t('integrations.models.team_key_link')}
              </Link>
            )}
          </Section>

          <Section title={t('integrations.models.recent_title')}>
            {recent.length === 0 ? (
              <p className="text-muted">{t('integrations.models.no_recent')}</p>
            ) : (
              <ul className="space-y-3">
                {recent.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <p className="font-medium">
                      {actionText(t, entry.action)}: {purposeName(entry.purpose)}
                    </p>
                    <p className="break-words">{recentDetail(t, entry)}</p>
                    <p className="text-muted">
                      {formatDateTime(entry.at)} · {entry.by ?? t('staff.audit.system')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {editing && (
        <ModelListDialog
          key={editing.purpose}
          purpose={editing}
          title={t('integrations.models.edit_title', { purpose: purposeName(editing.purpose) })}
          maxModels={maxModels}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function recentDetail(t: ReturnType<typeof useT>, entry: RecentEntry) {
  const { changes } = entry
  if (entry.action === 'ai_model.tested') {
    return t(
      changes.ok ? 'integrations.models.recent_test_ok' : 'integrations.models.recent_test_failed',
      { model: changes.model ?? '' }
    )
  }
  return t('integrations.models.recent_change', {
    from: (changes.from ?? []).join(', '),
    to: (changes.to ?? []).join(', '),
  })
}

/**
 * The model list of one purpose: the first row is the active model,
 * the rest are tried in order. Rows can be moved, removed and added
 * (up to `maxModels`).
 */
function ModelListDialog({
  purpose,
  title,
  maxModels,
  onClose,
}: {
  purpose: Purpose
  title: string
  maxModels: number
  onClose: () => void
}) {
  const t = useT()
  const [models, setModels] = useState<string[]>(purpose.models)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState(false)

  const move = (from: number, to: number) =>
    setModels((list) => {
      const next = [...list]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  const listError =
    errors.models ?? Object.entries(errors).find(([key]) => key.startsWith('models'))?.[1]

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description={t('integrations.models.edit_intro')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            disabled={processing}
            onClick={() =>
              router.post(
                `${BASE}/${purpose.purpose}`,
                { models: models.map((model) => model.trim()).filter(Boolean) },
                {
                  preserveScroll: true,
                  onStart: () => setProcessing(true),
                  onFinish: () => setProcessing(false),
                  onError: (next) => setErrors(next),
                  onSuccess: onClose,
                }
              )
            }
          >
            {t('integrations.save')}
          </Button>
        </>
      }
    >
      <div className="max-h-[60dvh] space-y-3 overflow-y-auto px-4 pb-2 sm:max-h-[65dvh] sm:px-0">
        {models.map((model, index) => {
          const name = model || t('integrations.models.model_label', { n: index + 1 })
          return (
            <div key={index} className="flex items-end gap-1">
              <TextField
                label={
                  index === 0
                    ? t('integrations.models.active')
                    : t('integrations.models.fallback', { n: index })
                }
                value={model}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  const value = event.target.value
                  setModels((list) => list.map((item, at) => (at === index ? value : item)))
                }}
                className="font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('integrations.models.move_up', { model: name })}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                <Icon name="chevron-down" className="rotate-180" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('integrations.models.move_down', { model: name })}
                disabled={index === models.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <Icon name="chevron-down" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('integrations.models.remove_model', { model: name })}
                disabled={models.length === 1}
                onClick={() => setModels((list) => list.filter((_, at) => at !== index))}
              >
                <Icon name="delete" />
              </Button>
            </div>
          )
        })}
        {listError && <p className="text-sm font-medium text-danger">{listError}</p>}
        {models.length < maxModels && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setModels((list) => [...list, ''])}
          >
            <Icon name="add" />
            {t('integrations.models.add_model')}
          </Button>
        )}
      </div>
    </ResponsiveDialog>
  )
}
