import { Link, router } from '@inertiajs/react'
import { Icon } from '~/components/icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown_menu'
import { useT } from '~/lib/i18n'
import type { SchoolRole } from '~/lib/navigation'
import { cn } from '~/lib/utils'

/** "Siti Rahma" → "SR" for the account button. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase()
}

/**
 * The role switch in the header (laptop): the current role with a link
 * to Ganti peran. On phones it lives in the account menu.
 */
export function RoleSwitch({ role }: { role: SchoolRole }) {
  const t = useT()
  const roleLabel = t(`nav.roles.${role}`)
  return (
    <Link
      href="/ganti-peran"
      aria-label={t('nav.switch_role_label', { role: roleLabel })}
      className="hidden min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold text-text hover:border-brand hover:bg-brand-tint hover:text-brand-strong md:inline-flex"
      data-testid="role-switch"
    >
      <Icon name="switch" />
      <span className="max-w-44 truncate">{roleLabel}</span>
    </Link>
  )
}

/**
 * The account button: initials (and the name from 640 px), opening a
 * menu with the role, Ganti peran, Akun and Keluar. `accountHref` is
 * null where there is no account page (exam site).
 */
export function AccountMenu({
  name,
  role,
  accountHref,
  canSwitchRole,
}: {
  name: string
  role?: SchoolRole | null
  accountHref?: string | null
  canSwitchRole?: boolean
}) {
  const t = useT()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('nav.account_menu')}
        className={cn(
          'inline-flex min-h-11 min-w-11 items-center gap-2 rounded-md px-1.5 text-sm font-semibold text-text hover:bg-surface-hover sm:pr-2.5',
          'data-[state=open]:bg-surface-hover'
        )}
      >
        <span
          aria-hidden
          className="inline-flex size-8 items-center justify-center rounded-full bg-brand-tint text-xs font-bold text-brand-strong"
        >
          {initials(name) || <Icon name="user" size={18} />}
        </span>
        <span className="hidden max-w-40 truncate sm:inline" data-testid="viewer-name">
          {name}
        </span>
        <Icon name="chevron-down" size={16} className="hidden text-muted sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block truncate font-bold">{name}</span>
          {role && (
            <span className="block truncate text-xs text-muted">
              {t('nav.acting_as', { role: t(`nav.roles.${role}`).toLowerCase() })}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canSwitchRole && (
          <DropdownMenuItem asChild>
            <Link href="/ganti-peran">
              <Icon name="switch" />
              {t('nav.switch_role')}
            </Link>
          </DropdownMenuItem>
        )}
        {accountHref && (
          <DropdownMenuItem asChild>
            <Link href={accountHref}>
              <Icon name="user" />
              {t('nav.account')}
            </Link>
          </DropdownMenuItem>
        )}
        {(canSwitchRole || accountHref) && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={() => router.post('/keluar')} data-testid="sign-out">
          <Icon name="logout" />
          {t('nav.sign_out')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
