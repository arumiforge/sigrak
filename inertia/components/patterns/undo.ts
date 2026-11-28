import { router } from '@inertiajs/react'
import type { OptimisticCallback, RequestPayload } from '@inertiajs/core'
import { toast } from 'sonner'

/**
 * Optimistic updates with undo (D-389). A save that the server confirms
 * with a flash message gets an "Urungkan" button on that toast, so a
 * slip is one tap away from being reversed instead of a confirmation
 * dialog in front of every action (Fondasi feedback.md).
 *
 * The flash toast is shown by FlashToasts; the undo for the next flash
 * waits here until that toast appears.
 */

export type UndoAction = { run: () => void }

let pendingUndo: UndoAction | null = null

/** Attach an undo to the next success flash. */
export function queueFlashUndo(action: UndoAction) {
  pendingUndo = action
}

/** Read (and forget) the undo for this flash. */
export function takeFlashUndo() {
  const action = pendingUndo
  pendingUndo = null
  return action
}

export function clearFlashUndo() {
  pendingUndo = null
}

type UndoVisit = { url: string; data?: RequestPayload }

/**
 * POST that updates the page at once (optimistic props), keeps the
 * scroll position, and offers "Urungkan" on the server's success toast;
 * undo posts `undo` the same way. When the server refuses, Inertia rolls
 * the optimistic props back and the error toast explains why.
 */
export function postWithUndo({
  url,
  data = {},
  optimistic,
  undo,
}: {
  url: string
  data?: RequestPayload
  optimistic?: OptimisticCallback
  undo: UndoVisit & { optimistic?: OptimisticCallback }
}) {
  router.post(url, data, {
    preserveScroll: true,
    optimistic,
    onStart: () =>
      queueFlashUndo({
        run: () =>
          router.post(undo.url, undo.data ?? {}, {
            preserveScroll: true,
            optimistic: undo.optimistic,
          }),
      }),
    onError: clearFlashUndo,
  })
}

/**
 * A client-only toast with undo, for changes the page keeps until the
 * toast closes (for example a row removed from a list being edited).
 */
export function toastWithUndo(message: string, undoLabel: string, onUndo: () => void) {
  toast.success(message, { action: { label: undoLabel, onClick: onUndo }, duration: 8000 })
}
