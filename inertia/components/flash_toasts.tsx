import { useEffect } from 'react'
import { toast } from 'sonner'
import { router, usePage } from '@inertiajs/react'
import { Toaster } from '~/components/ui/sonner'
import { clearFlashUndo, takeFlashUndo } from '~/components/patterns/undo'
import { useT } from '~/lib/i18n'

/**
 * Shows the server's flash messages as toasts (Fondasi feedback.md
 * tier 1). A success that was started with postWithUndo carries an
 * "Urungkan" button. The toaster is rendered on page load, so screen
 * readers hear the polite live region.
 */
export default function FlashToasts() {
  const t = useT()
  const { flash } = usePage()
  const undoLabel = t('common.actions.undo')

  useEffect(() => {
    return router.on('start', () => toast.dismiss('flash'))
  }, [])

  useEffect(() => {
    if (flash.error) {
      clearFlashUndo()
      toast.error(flash.error, { id: 'flash' })
    }
    if (flash.success) {
      const undo = takeFlashUndo()
      toast.success(flash.success, {
        id: 'flash',
        ...(undo
          ? {
              duration: 8000,
              action: { label: undoLabel, onClick: undo.run },
            }
          : {}),
      })
    }
  }, [flash, undoLabel])

  return <Toaster />
}
