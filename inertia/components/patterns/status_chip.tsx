import type { ReactNode } from 'react'
import { Icon, type IconName } from '~/components/icon'
import { cn } from '~/lib/utils'

/**
 * Status chip: a text label plus a colour, never colour alone (design
 * system, Status labels; D-263, D-445). Tones follow the status tokens;
 * `neutral` is the grey of "Belum dimulai", "Terkirim", "Baru"; `brand`
 * marks the current or selected thing ("Sedang dipakai").
 *
 *   Lengkap → ok · Belum lengkap: n → warn when late · Perlu RPM → danger
 *   Dibaca, Diproses → info · Disahkan → ok · Berubah setelah disahkan → warn
 */
export type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'brand'

export const statusToneClass: Record<StatusTone, string> = {
  ok: 'border-ok/30 bg-ok-tint text-ok',
  warn: 'border-warn/35 bg-warn-tint text-warn',
  danger: 'border-danger/30 bg-danger-tint text-danger',
  info: 'border-info/30 bg-info-tint text-info',
  neutral: 'border-line bg-surface text-muted',
  brand: 'border-brand/30 bg-brand-tint text-brand-strong',
}

const toneIcon: Partial<Record<StatusTone, IconName>> = {
  ok: 'success',
  warn: 'warning',
  danger: 'error',
  info: 'info',
}

export function StatusChip({
  tone = 'neutral',
  children,
  icon,
  className,
}: {
  tone?: StatusTone
  children: ReactNode
  /** Show the tone's icon too (true), a given icon, or none (default). */
  icon?: boolean | IconName
  className?: string
}) {
  const iconName = icon === true ? toneIcon[tone] : icon || undefined
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex min-h-7 max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs leading-tight font-semibold',
        statusToneClass[tone],
        className
      )}
    >
      {iconName && <Icon name={iconName} size={14} />}
      <span className="break-words">{children}</span>
    </span>
  )
}
