import type { ComponentProps, ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '~/components/ui/drawer'
import { useT } from '~/lib/i18n'
import { useIsDesktop } from '~/lib/media'

/**
 * A dialog on screens from 640 px and a bottom sheet (Vaul) on phones
 * (design system: Bottom sheet, Dialog). Same title, text, body and
 * footer either way; the footer buttons stack on phones with the main
 * action within thumb reach.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  role,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  /** "alertdialog" for confirmations. */
  role?: ComponentProps<typeof DialogContent>['role']
}) {
  const t = useT()
  const desktop = useIsDesktop()

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent role={role} closeLabel={t('common.actions.close')}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
          </DialogHeader>
          {children}
          {footer && <DialogFooter>{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent role={role}>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description ? (
            <DrawerDescription>{description}</DrawerDescription>
          ) : (
            <DrawerDescription className="sr-only">{title}</DrawerDescription>
          )}
        </DrawerHeader>
        {children}
        {footer && <DrawerFooter className="[&>*]:w-full">{footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  )
}
