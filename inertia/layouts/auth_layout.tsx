import type { ReactNode } from 'react'
import { usePage } from '@inertiajs/react'
import FlashToasts from '~/components/flash_toasts'
import { useT } from '~/lib/i18n'

/**
 * Login pages: the form first, left-aligned, no decoration in the way
 * (Fondasi ui.md). Illustrations from ai/ arrive later.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = useT()
  const { area } = usePage().props

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-4 sm:px-8">
        <span className="text-lg font-bold text-brand-strong">{t(`common.areas.${area}`)}</span>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:pt-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <FlashToasts />
    </div>
  )
}
