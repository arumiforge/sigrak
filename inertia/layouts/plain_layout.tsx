import type { ReactNode } from 'react'
import { usePage } from '@inertiajs/react'
import FlashToasts from '~/components/flash_toasts'
import { SignOutButton } from '~/components/sign_out_button'
import { useT } from '~/lib/i18n'

/**
 * Persistent shell of admin. and ujian. while they hold only a
 * placeholder page. The exam site keeps no links to the teacher app
 * (design system, Exam site style).
 */
export default function PlainLayout({ children }: { children: ReactNode }) {
  const t = useT()
  const { area, viewer } = usePage().props

  return (
    <div className="min-h-dvh">
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-2">
          <span className="flex-1 text-lg font-bold text-brand-strong">
            {t(`common.areas.${area}`)}
          </span>
          {viewer && <span className="hidden text-sm text-muted sm:inline">{viewer.name}</span>}
          {viewer && <SignOutButton />}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      <FlashToasts />
    </div>
  )
}
