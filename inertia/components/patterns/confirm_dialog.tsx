import { useState, type ComponentProps, type ReactNode } from 'react'
import { router } from '@inertiajs/react'
import type { RequestPayload } from '@inertiajs/core'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { ResponsiveDialog } from './responsive_dialog'

/**
 * A confirmation that names the item and the consequence, with a
 * button that names the action ("Hapus kelas 1A"), never "Ya" (design
 * system, UI writing rule 5). Use it for what cannot be undone; for
 * the rest prefer postWithUndo (patterns/undo.ts).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = false,
  processing = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel: string
  onConfirm: () => void
  destructive?: boolean
  processing?: boolean
}) {
  const t = useT()
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      role="alertdialog"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={processing}
            onClick={onConfirm}
            data-testid="confirm-action"
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}

/**
 * A button that asks first, then POSTs `action` and keeps the scroll
 * position. Replaces window.confirm() on the R1 pages.
 */
export function ConfirmAction({
  action,
  data,
  label,
  title,
  description,
  confirmLabel,
  destructive = true,
  preserveScroll = true,
  variant = 'outline',
  size,
  className,
  icon,
}: {
  action: string
  data?: RequestPayload
  label: string
  title: string
  description?: ReactNode
  confirmLabel: string
  destructive?: boolean
  preserveScroll?: boolean
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
  className?: string
  icon?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [processing, setProcessing] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={processing}
        onClick={() => setOpen(true)}
      >
        {icon}
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        destructive={destructive}
        processing={processing}
        onConfirm={() =>
          router.post(action, data ?? {}, {
            preserveScroll,
            onStart: () => setProcessing(true),
            onFinish: () => {
              setProcessing(false)
              setOpen(false)
            },
          })
        }
      />
    </>
  )
}
