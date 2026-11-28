import { useState } from 'react'
import { Link, useForm } from '@inertiajs/react'
import { Icon } from '~/components/icon'
import { PageHeader } from '~/components/patterns/page_header'
import { ResponsiveDialog } from '~/components/patterns/responsive_dialog'
import { StatusChip } from '~/components/patterns/status_chip'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatShortDate } from '~/lib/format'

type Props = {
  account: { name: string; email: string; roles: string[] }
  twoFactor: { enabled: boolean; required: boolean; since: string | null }
}

/**
 * Konsol /akun (R2-02): the staff member's own account and their
 * verifikasi dua langkah (D-343). Every staff member can turn it on
 * here; Pemilik and Admin cannot turn it off.
 */
export default function ConsoleAccount({ account, twoFactor }: Props) {
  const t = useT()
  const [disabling, setDisabling] = useState(false)

  return (
    <>
      <PageHeader
        title={t('two_factor.account.title')}
        description={t('two_factor.account.intro')}
      />

      <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
        <Section title={t('two_factor.account.profile_title')}>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-muted">{t('two_factor.account.name')}</dt>
              <dd className="font-semibold">{account.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">{t('two_factor.account.email')}</dt>
              <dd className="break-all">{account.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">{t('two_factor.account.roles')}</dt>
              <dd>
                {account.roles.length === 0
                  ? t('two_factor.account.no_roles')
                  : account.roles.map((role) => t(`staff.roles.${role}`)).join(', ')}
              </dd>
            </div>
          </dl>
        </Section>

        <Section
          title={t('two_factor.account.section_title')}
          actions={
            twoFactor.enabled ? (
              <StatusChip tone="ok">{t('two_factor.account.on')}</StatusChip>
            ) : (
              <StatusChip tone="neutral">{t('two_factor.account.off')}</StatusChip>
            )
          }
        >
          <p data-testid="two-factor-status">
            {twoFactor.enabled && twoFactor.since
              ? t('two_factor.account.on_body', { date: formatShortDate(twoFactor.since) })
              : t('two_factor.account.off_body')}
          </p>
          {twoFactor.required && (
            <p className="mt-2 flex gap-2 text-sm text-muted">
              <Icon name="info" size={18} className="mt-0.5 shrink-0" />
              <span>{t('two_factor.account.required_note')}</span>
            </p>
          )}
          <div className="mt-4">
            {!twoFactor.enabled && (
              <Button asChild>
                <Link href="/akun/verifikasi-dua-langkah">{t('two_factor.account.enable')}</Link>
              </Button>
            )}
            {twoFactor.enabled && !twoFactor.required && (
              <Button variant="outline" onClick={() => setDisabling(true)}>
                {t('two_factor.account.disable')}
              </Button>
            )}
          </div>
        </Section>
      </div>

      {disabling && <DisableDialog onClose={() => setDisabling(false)} />}
    </>
  )
}

function DisableDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const form = useForm({ code: '' })

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('two_factor.account.disable_title')}
      description={t('two_factor.account.disable_body')}
      role="alertdialog"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            type="submit"
            form="disable-two-factor"
            variant="destructive"
            disabled={form.processing}
          >
            {t('two_factor.account.disable_confirm')}
          </Button>
        </>
      }
    >
      <form
        id="disable-two-factor"
        className="px-4 pb-2 sm:px-0"
        onSubmit={(event) => {
          event.preventDefault()
          form.post('/akun/verifikasi-dua-langkah/matikan', {
            preserveScroll: true,
            onSuccess: onClose,
            onError: () => form.reset('code'),
          })
        }}
      >
        <TextField
          label={t('two_factor.challenge.code')}
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          required
          autoFocus
          value={form.data.code}
          onChange={(event) => form.setData('code', event.target.value)}
          error={form.errors.code}
          className="text-lg tracking-[0.3em] tabular-nums"
        />
      </form>
    </ResponsiveDialog>
  )
}
