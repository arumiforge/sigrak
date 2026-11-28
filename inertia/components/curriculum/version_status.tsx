import { StatusChip, type StatusTone } from '~/components/patterns/status_chip'
import { useT } from '~/lib/i18n'

/** A curriculum version as the console pages receive it (R2-08). */
export type VersionSummary = {
  id: number
  code: string
  name: string
  kind: 'structure' | 'cp' | 'topics'
  status: 'draft' | 'signed_off' | 'active' | 'retired'
  appliesFrom: string | null
  effectiveOn: string | null
  changedSinceSignOff: boolean
}

const tones: Record<VersionSummary['status'], StatusTone> = {
  draft: 'neutral',
  signed_off: 'info',
  active: 'ok',
  retired: 'neutral',
}

/** "Draf", "Disahkan", "Berlaku", "Tidak berlaku"; plus "Berubah setelah disahkan" (warn). */
export function VersionStatus({ version }: { version: VersionSummary }) {
  const t = useT()
  return (
    <span className="inline-flex flex-wrap gap-1">
      <StatusChip tone={tones[version.status]}>
        {t(`curriculum.statuses.${version.status}`)}
      </StatusChip>
      {version.changedSinceSignOff && (
        <StatusChip tone="warn" icon>
          {t('curriculum.statuses.changed')}
        </StatusChip>
      )}
    </span>
  )
}
