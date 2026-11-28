import type { ReactNode } from 'react'
import { usePage } from '@inertiajs/react'
import { SkipLink, Wordmark } from '~/components/shell/shell_parts'
import { useT } from '~/lib/i18n'

/**
 * Shell of the error pages on every host. It needs nothing from the
 * session, because an error page may render before the session or auth
 * middleware ran (a 404, a server error).
 */
export default function ErrorLayout({ children }: { children: ReactNode }) {
  const t = useT()
  const { area } = usePage().props

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="border-b bg-surface">
        <div className="mx-auto flex h-[var(--header-height)] max-w-4xl items-center px-4">
          <Wordmark label={t(`common.areas.${area ?? 'app'}`)} />
        </div>
      </header>
      <main
        id="isi"
        tabIndex={-1}
        data-page-content
        className="mx-auto w-full max-w-xl flex-1 px-4 py-12 outline-none sm:py-20"
      >
        {children}
      </main>
    </div>
  )
}
