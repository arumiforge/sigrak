import { useState } from 'react'
import { Dialog, Popover } from 'radix-ui'
import { Icon } from '~/components/icon'
import { statusToneClass } from '~/components/patterns/status_chip'
import { useIsDesktop } from '~/lib/media'
import { formatDate } from '~/lib/dates'
import { useT } from '~/lib/i18n'
import { cn } from '~/lib/utils'
import { useSourceLabel, type LayerSource } from './source'

const chip =
  'inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-tight'

/**
 * The source badge after every layered value (§9.1): the area or
 * "Bawaan SIGRAK", a "Wajib" chip for mandatory items and a line chip
 * when the value is for one line only. Tapping it opens "Asal data":
 * a bottom sheet on phones, a popover on larger screens. The area name
 * wraps; it is never cut off.
 */
export function SourceBadge({ source, className }: { source: LayerSource; className?: string }) {
  const t = useT()
  const label = useSourceLabel()(source)
  const desktop = useIsDesktop()
  const [open, setOpen] = useState(false)

  const trigger = (
    <button
      type="button"
      aria-label={t('layers.badge.open_origin', { label })}
      className={cn(
        chip,
        'min-h-11 max-w-full cursor-pointer text-left whitespace-normal hover:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none sm:min-h-7',
        source.layer === 'school'
          ? 'border-line-strong/50 bg-surface text-text'
          : source.packageKind === 'local_agreement'
            ? 'border-warn/35 bg-warn-tint text-text'
            : source.layer === 'national'
              ? 'border-line bg-page text-muted'
              : statusToneClass.brand
      )}
    >
      <Icon name="info" size={14} />
      <span className="break-words">{label}</span>
    </button>
  )

  return (
    <span className={cn('inline-flex max-w-full flex-wrap items-center gap-1.5', className)}>
      {desktop ? (
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>{trigger}</Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              collisionPadding={16}
              className="z-50 w-80 rounded-lg border bg-surface p-4 text-sm shadow-float"
            >
              <OriginDetails source={source} label={label} titleAs="p" />
              <Popover.Close asChild>
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-strong"
                >
                  {t('layers.origin_sheet.close')}
                </button>
              </Popover.Close>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay" />
            <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t bg-surface p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm shadow-float">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden />
              <Dialog.Description className="sr-only">{label}</Dialog.Description>
              <OriginDetails source={source} label={label} titleAs="dialog" />
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border font-semibold"
                >
                  {t('layers.origin_sheet.close')}
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
      {source.force === 'mandatory' && (
        <span className={cn(chip, statusToneClass.danger)}>
          {t('layers.badge.mandatory')}
        </span>
      )}
      {source.line !== 'all' && (
        <span className={cn(chip, statusToneClass.neutral)}>
          {t(`layers.lines.${source.line}`)}
        </span>
      )}
    </span>
  )
}

/**
 * The "Asal data" content: layer, area, package, basis (decree with
 * page, or the agreement document), the date it was checked, strength
 * and line.
 */
export function OriginDetails({
  source,
  label,
  titleAs,
}: {
  source: LayerSource
  label: string
  titleAs: 'dialog' | 'p'
}) {
  const t = useT()
  const title = t('layers.origin_sheet.title')
  const basis = [
    source.basis.regulation,
    source.basis.document,
    source.basis.article,
    source.basis.pages.length > 0
      ? t('layers.origin_sheet.pages', { pages: source.basis.pages.join(', ') })
      : null,
  ].filter(Boolean)

  const rows: [string, string][] = [
    [t('layers.origin_sheet.level'), t(`layers.layer.${source.layer}`)],
    ...(source.regionName ? ([[t('layers.origin_sheet.area'), label]] as [string, string][]) : []),
    [t('layers.origin_sheet.package'), source.packageName],
    [
      t('layers.origin_sheet.basis'),
      basis.length > 0
        ? basis.join(', ')
        : source.layer === 'school'
          ? t('layers.origin_sheet.basis_school')
          : t('layers.origin_sheet.basis_none'),
    ],
    ...(source.basis.checkedOn
      ? ([[t('layers.origin_sheet.checked_on'), formatDate(source.basis.checkedOn)]] as [
          string,
          string,
        ][])
      : []),
    [t('layers.origin_sheet.strength'), t(`layers.force.${source.force}`)],
    [t('layers.origin_sheet.line'), t(`layers.lines.${source.line}`)],
  ]

  return (
    <div>
      {titleAs === 'dialog' ? (
        <Dialog.Title className="text-base font-bold">{title}</Dialog.Title>
      ) : (
        <p className="text-base font-bold">{title}</p>
      )}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted">{term}</dt>
            <dd className="font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>
      {source.basis.url && (
        <a
          href={source.basis.url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand-strong underline-offset-4 hover:underline"
        >
          {t('layers.origin_sheet.open_source')}
        </a>
      )}
    </div>
  )
}
