import { StatusChip, type StatusTone } from '~/components/patterns/status_chip'
import { useT } from '~/lib/i18n'

/** Baru (grey), Diproses (info), Selesai (ok): text plus colour (D-263, D-320). */
const tones: Record<string, StatusTone> = { new: 'neutral', in_progress: 'info', done: 'ok' }

export function HelpStatusChip({ status }: { status: string }) {
  const t = useT()
  return (
    <StatusChip tone={tones[status] ?? 'neutral'} icon={status !== 'new'}>
      {t(`help.statuses.${status}`)}
    </StatusChip>
  )
}
