import { ConfirmAction } from '~/components/patterns/confirm_dialog'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'

/**
 * "Lihat sekolah ini" (R2-06, D-341): asks first, saying the view is
 * read-only under the school agreement and ends by itself, then opens
 * a support session on the school.
 */
export function StartSupportSession({
  schoolId,
  schoolName,
  hours,
}: {
  schoolId: number
  schoolName: string
  /** How long a session lasts before it ends by itself (server constant). */
  hours: number
}) {
  const t = useT()
  return (
    <ConfirmAction
      action={`/sekolah/${schoolId}/lihat`}
      label={t('nav.support_session.start')}
      title={`${t('nav.support_session.start')}: ${schoolName}`}
      description={t('nav.support_session.start_hint', { hours })}
      confirmLabel={t('nav.support_session.start')}
      destructive={false}
      preserveScroll={false}
      icon={<Icon name="school-view" />}
    />
  )
}
