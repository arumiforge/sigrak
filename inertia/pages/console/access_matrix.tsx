import { useState } from 'react'
import { PageHeader } from '~/components/patterns/page_header'
import { StatusChip } from '~/components/patterns/status_chip'
import { Section, SelectField } from '~/components/section'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'
import { useMediaQuery, SIDEBAR_QUERY } from '~/lib/media'
import { cn } from '~/lib/utils'

type RoleInfo = { role: string; scoped: boolean }

type Props = {
  roles: RoleInfo[]
  groups: { group: string; abilities: { ability: string; roles: string[] }[] }[]
  ownRoles: string[]
}

type Cell = 'full' | 'scoped' | 'none'

const abilityLabel = (ability: string) => `staff.abilities.${ability}`

/**
 * One matrix cell: a mark plus its words for screen readers, never a
 * colour alone (design system, Status labels).
 */
function Mark({ cell }: { cell: Cell }) {
  const t = useT()
  if (cell === 'none') {
    return (
      <span className="text-muted">
        <span aria-hidden>–</span>
        <span className="sr-only">{t('staff.matrix.none')}</span>
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-full',
        cell === 'full' ? 'bg-ok-tint text-ok' : 'bg-info-tint text-info'
      )}
    >
      <Icon name={cell === 'full' ? 'check' : 'region'} size={16} />
      <span className="sr-only">{t(`staff.matrix.${cell}`)}</span>
    </span>
  )
}

/**
 * Konsol /peran (D-314, D-481): what every role may do, read-only and
 * straight from the code (app/staff/powers.ts). From 1024 px a full
 * matrix whose first column stays put while it scrolls sideways; on
 * smaller screens one role at a time. Ability `access.view`.
 */
export default function ConsoleAccessMatrix({ roles, groups, ownRoles }: Props) {
  const t = useT()
  const wide = useMediaQuery(SIDEBAR_QUERY, true)
  const [picked, setPicked] = useState(ownRoles[0] ?? roles[0]?.role ?? 'owner')
  const scopedRoles = new Set(roles.filter((role) => role.scoped).map((role) => role.role))
  const cellOf = (holders: string[], role: string): Cell =>
    !holders.includes(role) ? 'none' : scopedRoles.has(role) ? 'scoped' : 'full'

  return (
    <>
      <PageHeader title={t('staff.matrix.title')} description={t('staff.matrix.intro')}>
        <p className="mt-2 text-sm">
          {ownRoles.length > 0
            ? t('staff.matrix.your_roles', {
                roles: ownRoles.map((role) => t(`staff.roles.${role}`)).join(', '),
              })
            : t('staff.matrix.no_roles')}
        </p>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="font-semibold">{t('staff.matrix.legend')}:</span>
        {(['full', 'scoped', 'none'] as const).map((cell) => (
          <span key={cell} className="inline-flex items-center gap-2">
            <Mark cell={cell} />
            <span aria-hidden>{t(`staff.matrix.${cell}`)}</span>
          </span>
        ))}
      </div>

      {wide ? (
        <div
          className="relative overflow-x-auto rounded-lg border bg-surface focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          data-testid="matrix-table"
          // Keyboard users scroll the wide matrix sideways (axe: scrollable region).
          tabIndex={0}
          role="region"
          aria-label={t('staff.matrix.caption')}
        >
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">{t('staff.matrix.caption')}</caption>
            <thead className="sticky top-0 border-b bg-page">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 border-r bg-page px-3 py-3 text-xs font-semibold text-muted"
                >
                  {t('staff.matrix.ability')}
                </th>
                {roles.map(({ role }) => (
                  <th
                    key={role}
                    scope="col"
                    className={cn(
                      'px-2 py-3 text-center text-xs font-semibold',
                      ownRoles.includes(role) ? 'text-brand-strong' : 'text-muted'
                    )}
                  >
                    {t(`staff.roles.${role}`)}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map(({ group, abilities }) => (
              <tbody key={group} className="divide-y border-b last:border-b-0">
                <tr className="bg-page/60">
                  <th
                    scope="colgroup"
                    colSpan={roles.length + 1}
                    className="px-3 py-2 text-xs font-bold tracking-wide text-text uppercase"
                  >
                    {/* Stays in view while the matrix scrolls sideways. */}
                    <span className="sticky left-3">{t(`staff.ability_groups.${group}`)}</span>
                  </th>
                </tr>
                {abilities.map(({ ability, roles: holders }) => (
                  <tr key={ability} className="group hover:bg-surface-hover/60">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 min-w-56 border-r bg-surface px-3 py-2 font-medium group-hover:bg-surface-hover"
                    >
                      {t(abilityLabel(ability))}
                    </th>
                    {roles.map(({ role }) => (
                      <td key={role} className="px-2 py-2 text-center">
                        <Mark cell={cellOf(holders, role)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      ) : (
        <div className="space-y-4" data-testid="matrix-cards">
          <div className="max-w-sm">
            <SelectField
              label={t('staff.matrix.role_picker')}
              name="role"
              defaultValue={picked}
              onChange={setPicked}
              options={roles.map(({ role }) => ({ value: role, label: t(`staff.roles.${role}`) }))}
            />
          </div>
          <p className="text-sm text-muted">{t(`staff.role_notes.${picked}`)}</p>
          {groups.map(({ group, abilities }) => {
            const held = abilities.filter(({ roles: holders }) => holders.includes(picked))
            if (held.length === 0) return null
            return (
              <Section
                key={group}
                title={t(`staff.ability_groups.${group}`)}
                actions={
                  <StatusChip tone="neutral">
                    {t('staff.matrix.role_count', { count: held.length })}
                  </StatusChip>
                }
              >
                <ul className="space-y-2">
                  {held.map(({ ability, roles: holders }) => (
                    <li key={ability} className="flex items-start gap-3">
                      <Mark cell={cellOf(holders, picked)} />
                      <span className="pt-0.5">{t(abilityLabel(ability))}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )
          })}
        </div>
      )}

      <p className="mt-6 max-w-3xl text-sm text-muted">{t('staff.matrix.student_note')}</p>
    </>
  )
}
