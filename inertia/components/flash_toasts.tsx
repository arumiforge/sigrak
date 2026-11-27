import { useEffect } from 'react'
import { toast } from 'sonner'
import { router, usePage } from '@inertiajs/react'
import { Toaster } from '~/components/ui/sonner'

/**
 * Shows the server's flash messages as toasts (Fondasi feedback.md
 * tier 1). The toaster is rendered on page load, so screen readers hear
 * the polite live region.
 */
export default function FlashToasts() {
  const { flash } = usePage()

  useEffect(() => {
    return router.on('start', () => toast.dismiss('flash'))
  }, [])

  useEffect(() => {
    if (flash.error) toast.error(flash.error, { id: 'flash' })
    if (flash.success) toast.success(flash.success, { id: 'flash' })
  }, [flash])

  return <Toaster />
}
