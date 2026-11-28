import type { ReactNode } from 'react'
import { usePage } from '@inertiajs/react'
import FlashToasts from '~/components/flash_toasts'
import { SignOutButton } from '~/components/sign_out_button'
import { SkipLink, Wordmark } from '~/components/shell/shell_parts'
import { useT } from '~/lib/i18n'

/**
 * Persistent shell of the exam site ujian. (design system, Exam site
 * style): plain and distraction-free, no menu, no brand promotion and
 * no links to the teacher app; the participant and a visible Keluar.
 */
export default function ExamLayout({ children }: { children: ReactNode }) {
  const t = useT()
  const { viewer } = usePage().props

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="border-b bg-surface">
        <div className="mx-auto flex h-[var(--header-height)] max-w-4xl items-center gap-3 px-4">
          <Wordmark label={t('common.areas.exam')} className="flex-1" />
          {viewer && (
            <span className="hidden max-w-48 truncate text-sm font-semibold text-muted sm:inline">
              {viewer.name}
            </span>
          )}
          {viewer && <SignOutButton />}
        </div>
      </header>
      <main
        id="isi"
        tabIndex={-1}
        data-page-content
        className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 outline-none"
      >
        {children}
      </main>
      <FlashToasts />
    </div>
  )
}
