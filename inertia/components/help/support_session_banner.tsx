import { Form, Link, usePage } from '@inertiajs/react'
import { Icon } from '~/components/icon'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatTime } from '~/lib/format'
import { pathOf } from '~/lib/navigation'

/**
 * Under the console header while the staff member has an open support
 * session (R2-06, D-341): which school is open read-only, until when,
 * a link back to the school view and "Akhiri sesi".
 */
export function SupportSessionBanner() {
  const t = useT()
  const {
    props: { supportSession },
    url,
  } = usePage()
  if (!supportSession) return null
  const onView = pathOf(url) === '/lihat-sekolah'

  return (
    <div
      role="status"
      className="border-b border-warn/35 bg-warn-tint"
      data-testid="support-banner"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 lg:px-6">
        <p className="flex min-w-0 flex-1 items-start gap-2 text-sm">
          <Icon name="school-view" className="mt-0.5 shrink-0 text-warn" />
          <span className="min-w-0 break-words">
            {t('nav.support_session.banner', {
              school: supportSession.schoolName,
              time: formatTime(supportSession.expiresAt),
            })}
          </span>
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!onView && (
            <Button asChild variant="outline">
              <Link href="/lihat-sekolah">{t('nav.support_session.open')}</Link>
            </Button>
          )}
          <Form action="/lihat-sekolah/akhiri" method="post">
            {({ processing }) => (
              <Button
                type="submit"
                variant="outline"
                disabled={processing}
                data-testid="end-session"
              >
                {t('nav.support_session.end')}
              </Button>
            )}
          </Form>
        </div>
      </div>
    </div>
  )
}
