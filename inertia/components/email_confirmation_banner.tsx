import { Form, usePage } from '@inertiajs/react'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'

/**
 * Reminder under the header while a self-signed-up teacher has not
 * confirmed the email (D-469). The app stays usable; the button sends
 * the link again (the same action as on Akun).
 */
export function EmailConfirmationBanner() {
  const t = useT()
  const { emailToConfirm } = usePage().props
  if (!emailToConfirm) return null

  return (
    <div
      role="status"
      className="border-b border-warn/35 bg-warn-tint"
      data-testid="confirm-banner"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 lg:px-6">
        <p className="flex min-w-0 flex-1 items-start gap-2 text-sm">
          <Icon name="mail" className="mt-0.5 shrink-0 text-warn" />
          <span className="min-w-0 break-words">
            {t('common.email_banner.body', { email: emailToConfirm })}
          </span>
        </p>
        <Form
          action="/akun/konfirmasi-email"
          method="post"
          options={{ preserveScroll: true }}
          className="shrink-0"
        >
          {({ processing }) => (
            <Button type="submit" variant="outline" disabled={processing}>
              {processing
                ? t('common.email_banner.sending')
                : t('common.email_banner.resend_action')}
            </Button>
          )}
        </Form>
      </div>
    </div>
  )
}
