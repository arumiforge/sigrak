import { StatusChip, type StatusTone } from '~/components/patterns/status_chip'
import { useT } from '~/lib/i18n'

/**
 * Bank Masalah status: text plus colour, never colour alone (D-263).
 * Baru and Ditutup grey, the working steps info, Diputuskan brand,
 * Rilis ok.
 */
const tones: Record<string, StatusTone> = {
  new: 'neutral',
  triaged: 'info',
  analysed: 'info',
  decided: 'brand',
  in_progress: 'info',
  released: 'ok',
  closed: 'neutral',
}

export function ProblemStatusChip({ status }: { status: string }) {
  const t = useT()
  return (
    <StatusChip tone={tones[status] ?? 'neutral'} icon={status === 'released'}>
      {t(`problems.statuses.${status}`)}
    </StatusChip>
  )
}

/** "Kabupaten Sleman", or "–" when a problem names no region. */
export function regionLabel(
  t: ReturnType<typeof useT>,
  region: { name: string; kind: string } | null
) {
  return region ? t(`regions.kinds.${region.kind}`, { name: region.name }) : '–'
}
