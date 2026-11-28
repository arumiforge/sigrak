import { useState } from 'react'
import { Form } from '@inertiajs/react'
import { toast } from 'sonner'
import { Icon } from '~/components/icon'
import { PageHeader } from '~/components/patterns/page_header'
import { Section } from '~/components/section'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

type Props = {
  /** The manual key, grouped by four characters. */
  manualKey: string
  /** The QR code as one SVG path in a square of `size` modules. */
  qr: { size: number; path: string }
  /** Pemilik or Admin: 2FA is required before any other console page. */
  required: boolean
}

/**
 * Konsol /akun/verifikasi-dua-langkah (R2-02, D-343): link an
 * authenticator app with the QR code or the manual key, then confirm
 * with its first code. Owners and admins land here until they finish.
 */
export default function TwoFactorSetup({ manualKey, qr, required }: Props) {
  const t = useT()
  const [copied, setCopied] = useState(false)

  return (
    <>
      <PageHeader
        title={t('two_factor.setup.title')}
        description={t('two_factor.setup.intro')}
        back={required ? undefined : { href: '/akun', label: t('two_factor.setup.back') }}
      >
        {required && (
          <p
            className="mt-3 flex max-w-3xl gap-2 rounded-md border border-info/30 bg-info-tint p-3 text-sm text-info"
            data-testid="two-factor-required"
          >
            <Icon name="info" size={18} className="mt-0.5 shrink-0" />
            <span>{t('two_factor.setup.required')}</span>
          </p>
        )}
      </PageHeader>

      <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
        <Section title={t('two_factor.setup.link_title')}>
          <ol className="space-y-5">
            <li>
              <p className="font-semibold">1. {t('two_factor.setup.step_app_title')}</p>
              <p className="mt-1 text-sm text-muted">{t('two_factor.setup.step_app_body')}</p>
            </li>
            <li>
              <p className="font-semibold">2. {t('two_factor.setup.step_scan_title')}</p>
              <p className="mt-1 text-sm text-muted">{t('two_factor.setup.step_scan_body')}</p>
              {/* Always dark on white, also in dark mode, so every camera reads it. */}
              <svg
                role="img"
                aria-label={t('two_factor.setup.qr_label')}
                viewBox={`0 0 ${qr.size} ${qr.size}`}
                shapeRendering="crispEdges"
                className="mt-3 size-52 rounded-md border bg-white"
                data-testid="two-factor-qr"
              >
                <rect width={qr.size} height={qr.size} fill="#ffffff" />
                <path d={qr.path} fill="#000000" />
              </svg>
            </li>
            <li>
              <p className="text-sm">{t('two_factor.setup.manual_title')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code
                  aria-label={t('two_factor.setup.manual_label')}
                  className="rounded-md border bg-surface-hover px-3 py-2 font-mono text-sm break-all select-all"
                  data-testid="two-factor-key"
                >
                  {manualKey}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(manualKey.replace(/\s+/g, ''))
                      setCopied(true)
                      toast.success(t('two_factor.setup.copied'))
                    } catch {
                      setCopied(false)
                    }
                  }}
                >
                  {copied && <Icon name="check" size={16} />}
                  {t('two_factor.setup.copy')}
                </Button>
              </div>
            </li>
          </ol>
        </Section>

        <Section title={`3. ${t('two_factor.setup.step_confirm_title')}`}>
          <p className="text-sm text-muted">{t('two_factor.setup.step_confirm_body')}</p>
          <Form
            action="/akun/verifikasi-dua-langkah"
            method="post"
            resetOnError={['code']}
            className="mt-4 space-y-4"
          >
            {({ errors, processing }) => (
              <>
                <TextField
                  label={t('two_factor.challenge.code')}
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  required
                  className="text-lg tracking-[0.3em] tabular-nums"
                  error={errors.code}
                />
                <Button type="submit" disabled={processing}>
                  {processing ? t('two_factor.setup.submitting') : t('two_factor.setup.submit')}
                </Button>
              </>
            )}
          </Form>
          <p className="mt-4 text-sm text-muted">{t('two_factor.setup.no_recovery')}</p>
        </Section>
      </div>
    </>
  )
}
