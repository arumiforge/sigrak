import type { ReactNode } from 'react'
import { usePage } from '@inertiajs/react'
import FlashToasts from '~/components/flash_toasts'
import { SkipLink, Wordmark } from '~/components/shell/shell_parts'
import { useT } from '~/lib/i18n'

/**
 * Guest shell: sign-in, sign-up, password reset, invitation and email
 * confirmation on every host. The form comes first, left-aligned, no
 * decoration in the way (Fondasi ui.md); on wider screens it sits on a
 * card. Illustrations from ai/ arrive later (D-390).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = useT()
  const { area } = usePage().props

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="px-4 pt-3 sm:px-8 sm:pt-5">
        <Wordmark label={t(`common.areas.${area}`)} />
      </header>
      <main
        id="isi"
        tabIndex={-1}
        data-page-content
        className="flex flex-1 items-start justify-center px-4 pt-4 pb-12 outline-none sm:pt-12"
      >
        <div className="w-full max-w-md sm:rounded-lg sm:border sm:bg-surface sm:p-8">
          {children}
        </div>
      </main>
      <FlashToasts />
    </div>
  )
}
