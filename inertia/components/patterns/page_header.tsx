import type { ReactNode } from 'react'
import { Head, Link } from '@inertiajs/react'
import { Icon } from '~/components/icon'
import { cn } from '~/lib/utils'

/**
 * The top of every page: an optional back link, the title (also the
 * browser tab title), a one-line intro and the page's main actions. On
 * phones the actions wrap under the title; the title never shrinks.
 */
export function PageHeader({
  title,
  description,
  meta,
  back,
  actions,
  headTitle,
  className,
  children,
}: {
  title: string
  description?: ReactNode
  /** A short fact next to the title, e.g. the school year. */
  meta?: ReactNode
  back?: { href: string; label: string }
  actions?: ReactNode
  /** Tab title when it differs from the heading. */
  headTitle?: string
  className?: string
  /** Extra lines under the intro (notes for one role, …). */
  children?: ReactNode
}) {
  return (
    <header className={cn('mb-6', className)}>
      <Head title={headTitle ?? title} />
      {back && (
        <Link
          href={back.href}
          prefetch
          className="-ml-1 mb-1 inline-flex min-h-11 items-center gap-1 rounded-md pr-2 pl-1 text-sm font-semibold text-brand-strong hover:underline"
        >
          <Icon name="chevron-left" size={18} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold break-words sm:text-3xl">{title}</h1>
            {meta && <p className="text-sm text-muted">{meta}</p>}
          </div>
          {description && <p className="mt-1.5 max-w-3xl text-muted">{description}</p>}
          {children}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  )
}
