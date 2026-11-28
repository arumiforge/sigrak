import type { ReactNode } from 'react'
import { Form } from '@inertiajs/react'
import { ConfirmAction } from '~/components/patterns/confirm_dialog'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip, type StatusTone } from '~/components/patterns/status_chip'
import { PasswordField } from '~/components/password_field'
import { Section, SelectField } from '~/components/section'
import { SettingsTabs } from '~/components/settings_tabs'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { formatShortDate } from '~/lib/format'
import { useT } from '~/lib/i18n'

type SecretHint = { set: boolean; last4: string | null }
type MailSource = 'env' | 'console' | 'none'

type Props = {
  mail: {
    source: MailSource
    envMailer: string | null
    saved: boolean
    complete: boolean
    values: {
      host: string
      port: number
      security: 'starttls' | 'tls'
      username: string
      fromAddress: string
      fromName: string
    }
    password: SecretHint
  }
  chatbot: {
    saved: boolean
    baseUrl: string
    model: string
    keys: (SecretHint & { id: string; label: string; addedAt: string })[]
  }
  chatbotMaxKeys: number
  storage: {
    saved: boolean
    values: { endpoint: string; region: string; bucket: string }
    accessKeyId: SecretHint
    secretAccessKey: SecretHint
  }
  teamKey: SecretHint
  staffEmail: string
  can: { manage: boolean }
}

const BASE = '/pengaturan/integrasi'

const sourceTone: Record<MailSource, StatusTone> = { env: 'info', console: 'ok', none: 'warn' }

/**
 * Konsol /pengaturan/integrasi (R2-03, D-431, F-005): mail SMTP, the
 * chatbot provider, storage and Tim SIGRAK's AI test key. Secrets are
 * never sent back to the page, only their last four characters; an
 * empty secret field keeps the saved one. Abilities:
 * `integrations.view` reads, `integrations.manage` (the owner) changes.
 */
export default function ConsoleIntegrations({
  mail,
  chatbot,
  chatbotMaxKeys,
  storage,
  teamKey,
  staffEmail,
  can,
}: Props) {
  const t = useT()
  const readOnly = !can.manage

  return (
    <>
      <PageHeader
        title={t('integrations.title')}
        description={t('integrations.intro')}
        headTitle={t('integrations.head_title')}
      >
        {readOnly && <p className="mt-2 text-sm text-muted">{t('integrations.read_only')}</p>}
      </PageHeader>
      <SettingsTabs />

      <div className="max-w-3xl space-y-4">
        <Section
          title={t('integrations.mail.title')}
          description={t('integrations.mail.intro')}
          actions={
            <StatusChip tone={sourceTone[mail.source]} icon>
              {t(`integrations.mail.sources.${mail.source}`)}
            </StatusChip>
          }
        >
          {mail.source === 'env' && (
            <Note>{t('integrations.mail.env_note', { mailer: mail.envMailer ?? '' })}</Note>
          )}
          {mail.source === 'none' && <Note>{t('integrations.mail.none_note')}</Note>}

          <Form
            action={`${BASE}/email`}
            method="post"
            options={{ preserveScroll: true }}
            resetOnSuccess={['password']}
            className="space-y-4"
          >
            {({ errors, processing }) => (
              <>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <TextField
                    label={t('integrations.mail.host')}
                    name="host"
                    defaultValue={mail.values.host}
                    hint={t('integrations.mail.host_hint')}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={readOnly}
                    required
                    error={errors.host}
                  />
                  <TextField
                    label={t('integrations.mail.port')}
                    name="port"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={65535}
                    defaultValue={mail.values.port}
                    disabled={readOnly}
                    required
                    error={errors.port}
                  />
                </div>
                <SelectField
                  label={t('integrations.mail.security')}
                  name="security"
                  defaultValue={mail.values.security}
                  options={[
                    { value: 'starttls', label: t('integrations.mail.security_starttls') },
                    { value: 'tls', label: t('integrations.mail.security_tls') },
                  ]}
                  disabled={readOnly}
                  error={errors.security}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label={t('integrations.mail.username')}
                    name="username"
                    defaultValue={mail.values.username}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={readOnly}
                    required
                    error={errors.username}
                  />
                  <PasswordField
                    label={t('integrations.mail.password')}
                    name="password"
                    autoComplete="new-password"
                    disabled={readOnly}
                    required={!mail.password.set}
                    hint={<SecretHintText hint={mail.password} />}
                    error={errors.password}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label={t('integrations.mail.from_address')}
                    name="from_address"
                    type="email"
                    defaultValue={mail.values.fromAddress}
                    disabled={readOnly}
                    required
                    error={errors.from_address}
                  />
                  <TextField
                    label={t('integrations.mail.from_name')}
                    name="from_name"
                    defaultValue={mail.values.fromName}
                    disabled={readOnly}
                    required
                    error={errors.from_name}
                  />
                </div>
                {can.manage && (
                  <Button type="submit" disabled={processing}>
                    {t('integrations.save')}
                  </Button>
                )}
              </>
            )}
          </Form>

          {can.manage && (
            <div className="mt-6 flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-start sm:justify-between">
              <Form action={`${BASE}/email/uji`} method="post" options={{ preserveScroll: true }}>
                {({ processing }) => (
                  <div>
                    <Button type="submit" variant="outline" disabled={processing}>
                      {t('integrations.mail.test')}
                    </Button>
                    <p className="mt-1.5 text-xs break-words text-muted">
                      {t('integrations.mail.test_hint', { email: staffEmail })}
                    </p>
                  </div>
                )}
              </Form>
              {mail.saved && <ClearButton integration="mail" name={t('integrations.mail.title')} />}
            </div>
          )}
        </Section>

        <Section
          title={t('integrations.chatbot.title')}
          description={t('integrations.chatbot.intro')}
        >
          <Form
            action={`${BASE}/chatbot`}
            method="post"
            options={{ preserveScroll: true }}
            className="space-y-4"
          >
            {({ errors, processing }) => (
              <>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                  <TextField
                    label={t('integrations.chatbot.base_url')}
                    name="base_url"
                    type="url"
                    defaultValue={chatbot.baseUrl}
                    hint={t('integrations.chatbot.base_url_hint')}
                    spellCheck={false}
                    disabled={readOnly}
                    required
                    error={errors.base_url}
                  />
                  <TextField
                    label={t('integrations.chatbot.model')}
                    name="model"
                    defaultValue={chatbot.model}
                    spellCheck={false}
                    disabled={readOnly}
                    required
                    error={errors.model}
                  />
                </div>
                {can.manage && (
                  <Button type="submit" disabled={processing}>
                    {t('integrations.save')}
                  </Button>
                )}
              </>
            )}
          </Form>

          <h3 className="mt-6 border-t pt-4 font-bold">{t('integrations.chatbot.keys_title')}</h3>
          <p className="mt-1 text-sm text-muted">
            {t('integrations.chatbot.keys_intro', { max: chatbotMaxKeys })}
          </p>
          {chatbot.keys.length === 0 ? (
            <p className="mt-3 text-muted">{t('integrations.chatbot.no_keys')}</p>
          ) : (
            <ol className="mt-3 divide-y rounded-md border">
              {chatbot.keys.map((key, index) => (
                <li
                  key={key.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2"
                  data-testid="chatbot-key"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold break-words">
                      {index + 1}. {key.label}
                    </p>
                    <p className="text-sm text-muted">
                      <SecretHintText hint={key} keepHint={false} /> ·{' '}
                      {t('integrations.chatbot.added_on', { date: formatShortDate(key.addedAt) })}
                    </p>
                  </div>
                  {can.manage && (
                    <ConfirmAction
                      action={`${BASE}/chatbot/kunci/${key.id}/hapus`}
                      label={t('integrations.chatbot.remove_key')}
                      ariaLabel={t('integrations.chatbot.remove_key_label', { label: key.label })}
                      variant="ghost"
                      size="sm"
                      title={t('integrations.chatbot.remove_title', { label: key.label })}
                      description={t('integrations.chatbot.remove_body')}
                      confirmLabel={t('integrations.chatbot.remove_confirm', { label: key.label })}
                    />
                  )}
                </li>
              ))}
            </ol>
          )}

          {can.manage && chatbot.keys.length < chatbotMaxKeys && (
            <Form
              action={`${BASE}/chatbot/kunci`}
              method="post"
              options={{ preserveScroll: true }}
              resetOnSuccess
              className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] sm:items-start"
            >
              {({ errors, processing }) => (
                <>
                  <TextField
                    label={t('integrations.chatbot.key_label')}
                    name="label"
                    maxLength={60}
                    required
                    error={errors.label}
                  />
                  <PasswordField
                    label={t('integrations.chatbot.key_secret')}
                    name="secret"
                    autoComplete="off"
                    required
                    error={errors.secret}
                  />
                  <Button type="submit" variant="outline" className="sm:mt-7" disabled={processing}>
                    {t('integrations.chatbot.add_key')}
                  </Button>
                </>
              )}
            </Form>
          )}
          {can.manage && chatbot.saved && (
            <div className="mt-6 border-t pt-4">
              <ClearButton integration="chatbot" name={t('integrations.chatbot.title')} />
            </div>
          )}
        </Section>

        <Section
          title={t('integrations.storage.title')}
          description={t('integrations.storage.intro')}
          actions={<StatusChip tone="neutral">{t('integrations.storage.not_live')}</StatusChip>}
        >
          <Form
            action={`${BASE}/penyimpanan`}
            method="post"
            options={{ preserveScroll: true }}
            resetOnSuccess={['access_key_id', 'secret_access_key']}
            className="space-y-4"
          >
            {({ errors, processing }) => (
              <>
                <TextField
                  label={t('integrations.storage.endpoint')}
                  name="endpoint"
                  type="url"
                  defaultValue={storage.values.endpoint}
                  hint={t('integrations.storage.endpoint_hint')}
                  spellCheck={false}
                  disabled={readOnly}
                  required
                  error={errors.endpoint}
                />
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <TextField
                    label={t('integrations.storage.region')}
                    name="region"
                    defaultValue={storage.values.region}
                    hint={t('integrations.storage.region_hint')}
                    spellCheck={false}
                    disabled={readOnly}
                    required
                    error={errors.region}
                  />
                  <TextField
                    label={t('integrations.storage.bucket')}
                    name="bucket"
                    defaultValue={storage.values.bucket}
                    spellCheck={false}
                    disabled={readOnly}
                    required
                    error={errors.bucket}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <PasswordField
                    label={t('integrations.storage.access_key_id')}
                    name="access_key_id"
                    autoComplete="off"
                    disabled={readOnly}
                    required={!storage.accessKeyId.set}
                    hint={<SecretHintText hint={storage.accessKeyId} />}
                    error={errors.access_key_id}
                  />
                  <PasswordField
                    label={t('integrations.storage.secret_access_key')}
                    name="secret_access_key"
                    autoComplete="off"
                    disabled={readOnly}
                    required={!storage.secretAccessKey.set}
                    hint={<SecretHintText hint={storage.secretAccessKey} />}
                    error={errors.secret_access_key}
                  />
                </div>
                {can.manage && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button type="submit" disabled={processing}>
                      {t('integrations.save')}
                    </Button>
                    {storage.saved && (
                      <ClearButton integration="storage" name={t('integrations.storage.title')} />
                    )}
                  </div>
                )}
              </>
            )}
          </Form>
        </Section>

        <Section
          title={t('integrations.team_key.title')}
          description={t('integrations.team_key.intro')}
        >
          <Form
            action={`${BASE}/kunci-ai`}
            method="post"
            options={{ preserveScroll: true }}
            resetOnSuccess
            className="space-y-4"
          >
            {({ errors, processing }) => (
              <>
                <PasswordField
                  label={t('integrations.team_key.label')}
                  name="gemini_key"
                  autoComplete="off"
                  disabled={readOnly}
                  required
                  hint={<SecretHintText hint={teamKey} keepHint={false} />}
                  error={errors.gemini_key}
                />
                {can.manage && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button type="submit" disabled={processing}>
                      {t('integrations.save')}
                    </Button>
                    {teamKey.set && (
                      <ClearButton
                        integration="ai_team_key"
                        name={t('integrations.team_key.title')}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </Form>
        </Section>
      </div>
    </>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mb-4 rounded-md bg-page px-3 py-2 text-sm">{children}</p>
}

/** "Tersimpan, berakhiran 1a2b. Kosongkan jika tidak ingin mengganti." or "Belum diisi." */
function SecretHintText({ hint, keepHint = true }: { hint: SecretHint; keepHint?: boolean }) {
  const t = useT()
  if (!hint.set) return <>{t('integrations.secret_none')}</>
  const saved = hint.last4
    ? t('integrations.secret_set', { last4: hint.last4 })
    : t('integrations.secret_set_short')
  return <>{keepHint ? `${saved} ${t('integrations.secret_keep')}` : saved}</>
}

function ClearButton({ integration, name }: { integration: string; name: string }) {
  const t = useT()
  return (
    <ConfirmAction
      action={`${BASE}/${integration}/kosongkan`}
      label={t('integrations.clear')}
      ariaLabel={t('integrations.clear_label', { name })}
      variant="ghost"
      title={t('integrations.clear_title', { name })}
      description={t('integrations.clear_body')}
      confirmLabel={t('integrations.clear_confirm')}
    />
  )
}
