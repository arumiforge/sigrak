import type { ReactNode } from 'react'
import { usePage } from '@inertiajs/react'
import ConsoleLayout from '~/layouts/console_layout'
import ExamLayout from '~/layouts/exam_layout'

/**
 * Kept for pages that still name it: picks the shell of the host the
 * page runs on (console on admin., exam site on ujian.). New pages get
 * their layout from layouts/resolve_layout.ts and set none themselves.
 */
export default function PlainLayout({ children }: { children: ReactNode }) {
  const { area } = usePage().props
  return area === 'exam' ? (
    <ExamLayout>{children}</ExamLayout>
  ) : (
    <ConsoleLayout>{children}</ConsoleLayout>
  )
}
