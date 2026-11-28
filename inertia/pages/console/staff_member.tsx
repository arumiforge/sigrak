import { useState } from 'react'
import { Form, router } from '@inertiajs/react'
import { ConfirmAction } from '~/components/patterns/confirm_dialog'
import { PageHeader } from '~/components/patterns/page_header'
import { ResponsiveDialog } from '~/components/patterns/responsive_dialog'
import { StatusChip } from '~/components/patterns/status_chip'
import { Section, SelectField } from '~/components/section'
import {
  ScopeEditor,
  ScopeSummary,
  emptyScope,
  hasScopeParts,
  scopePayload,
  type RegionOption,
  type RoleScopeRule,
  type SchoolOption,
  type ScopeValue,
} from '~/components/staff/scope_editor'
import { ActionLabel } from '~/components/staff/action_label'
import { Button } from '~/components/ui/button'
import { useT } from '~/lib/i18n'
import { formatDateTime, formatShortDate } from '~/lib/format'

type Assignment = {
  role: string
  regions: RegionOption[]
  schools: SchoolOption[]
  levels: string[]
  fields: string[]
  editable: boolean
}

type Props = {
  member: { id: number; name: string; email: string; disabled: boolean; createdAt: string }
  assignments: Assignment[]
  recent: { id: number; action: string; role: string | null; at: string; by: string | null }[]
  grantable: string[]
  roleScopes: Record<string, RoleScopeRule>
  fields: string[]
  can: { edit: boolean; self: boolean }
}

const valueOf = (assignment: Assignment): ScopeValue => ({
  regions: assignment.regions,
  schools: assignment.schools,
  levels: assignment.levels,
  fields: assignment.fields,
})

/**
 * Konsol /staf/{id} (R2-01): one staff member's roles, each with its
 * own scope (D-338), adding and removing roles, the account status and
 * the set-password link, and the latest logged changes. Changes need
 * `staff.manage`; owner and admin accounts need `staff.manage_high`;
 * nobody changes their own (the server refuses too).
 */
export default function ConsoleStaffMember({
  member,
  assignments,
  recent,
  grantable,
  roleScopes,
  fields,
  can,
}: Props) {
  const t = useT()
  const base = `/staf/${member.id}`
  const [editing, setEditing] = useState<Assignment | null>(null)

  return (
    <>
      <PageHeader
        title={member.name}
        back={{ href: '/staf', label: t('staff.member.back') }}
        description={<span className="break-all">{member.email}</span>}
        meta={
          member.disabled ? (
            <StatusChip tone="neutral">{t('staff.list.disabled')}</StatusChip>
          ) : (
            <StatusChip tone="ok">{t('staff.list.active')}</StatusChip>
          )
        }
      >
        {can.self && <p className="mt-2 text-sm text-muted">{t('staff.member.self_note')}</p>}
        {!can.self && !can.edit && (
          <p className="mt-2 text-sm text-muted">{t('staff.member.locked_note')}</p>
        )}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <Section
            title={t('staff.member.roles_title')}
            description={t('staff.member.roles_intro')}
          >
            {assignments.length === 0 ? (
              <p className="text-muted">{t('staff.member.no_roles')}</p>
            ) : (
              <ul className="divide-y">
                {assignments.map((assignment) => {
                  const rule = roleScopes[assignment.role]
                  const roleName = t(`staff.roles.${assignment.role}`)
                  return (
                    <li
                      key={assignment.role}
                      className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start"
                      data-testid={`assignment-${assignment.role}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{roleName}</p>
                        <p className="text-sm text-muted">
                          {t(`staff.role_notes.${assignment.role}`)}
                        </p>
                        <p className="mt-1 text-sm">
                          <span className="text-muted">{t('staff.scope.title')}: </span>
                          <ScopeSummary rule={rule} value={valueOf(assignment)} />
                        </p>
                      </div>
                      {assignment.editable && (
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {hasScopeParts(rule) && (
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={t('staff.member.edit_scope_label', { role: roleName })}
                              onClick={() => setEditing(assignment)}
                            >
                              {t('staff.member.edit_scope')}
                            </Button>
                          )}
                          <ConfirmAction
                            action={`${base}/peran/${assignment.role}/cabut`}
                            label={t('staff.member.revoke')}
                            ariaLabel={t('staff.member.revoke_label', { role: roleName })}
                            variant="ghost"
                            size="sm"
                            title={t('staff.member.revoke_title', {
                              role: roleName,
                              name: member.name,
                            })}
                            description={t('staff.member.revoke_body')}
                            confirmLabel={t('staff.member.revoke_confirm', { role: roleName })}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>

          {can.edit && (
            <GrantRole
              key={grantable.join(',')}
              action={`${base}/peran`}
              grantable={grantable}
              roleScopes={roleScopes}
              fields={fields}
            />
          )}
        </div>

        <div className="space-y-4">
          <Section title={t('staff.member.account_title')}>
            <p className="mb-1">
              {member.disabled
                ? t('staff.member.status_disabled')
                : t('staff.member.status_active')}
            </p>
            <p className="mb-4 text-sm text-muted">
              {t('staff.member.since', { date: formatShortDate(member.createdAt) })}
            </p>
            {can.edit && (
              <div className="space-y-4">
                {member.disabled ? (
                  <Form
                    action={`${base}/aktifkan`}
                    method="post"
                    options={{ preserveScroll: true }}
                  >
                    {({ processing }) => (
                      <Button type="submit" variant="outline" disabled={processing}>
                        {t('staff.member.enable')}
                      </Button>
                    )}
                  </Form>
                ) : (
                  <>
                    <div>
                      <Form
                        action={`${base}/kirim-tautan`}
                        method="post"
                        options={{ preserveScroll: true }}
                      >
                        {({ processing }) => (
                          <Button type="submit" variant="outline" disabled={processing}>
                            {t('staff.member.resend')}
                          </Button>
                        )}
                      </Form>
                      <p className="mt-1.5 text-xs text-muted">{t('staff.member.resend_hint')}</p>
                    </div>
                    <ConfirmAction
                      action={`${base}/nonaktifkan`}
                      label={t('staff.member.disable')}
                      title={t('staff.member.disable_title', { name: member.name })}
                      description={t('staff.member.disable_body')}
                      confirmLabel={t('staff.member.disable_confirm', { name: member.name })}
                    />
                  </>
                )}
              </div>
            )}
          </Section>

          <Section title={t('staff.member.recent_title')}>
            {recent.length === 0 ? (
              <p className="text-muted">{t('staff.member.recent_empty')}</p>
            ) : (
              <ul className="space-y-3">
                {recent.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <p className="font-medium">
                      <ActionLabel action={entry.action} role={entry.role} />
                    </p>
                    <p className="text-muted">
                      {formatDateTime(entry.at)} · {entry.by ?? t('staff.audit.system')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {editing && (
        <ScopeDialog
          key={editing.role}
          assignment={editing}
          rule={roleScopes[editing.role]}
          fields={fields}
          action={`${base}/peran/${editing.role}`}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function ScopeDialog({
  assignment,
  rule,
  fields,
  action,
  onClose,
}: {
  assignment: Assignment
  rule: RoleScopeRule
  fields: string[]
  action: string
  onClose: () => void
}) {
  const t = useT()
  const [scope, setScope] = useState<ScopeValue>(valueOf(assignment))
  const [processing, setProcessing] = useState(false)
  const roleName = t(`staff.roles.${assignment.role}`)

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('staff.member.edit_scope_title', { role: roleName })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            disabled={processing}
            onClick={() =>
              router.post(action, scopePayload(scope, rule), {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: onClose,
              })
            }
          >
            {t('staff.member.save_scope')}
          </Button>
        </>
      }
    >
      <div className="max-h-[60dvh] overflow-y-auto px-4 pb-2 sm:max-h-[65dvh] sm:px-0">
        <ScopeEditor rule={rule} fields={fields} value={scope} onChange={setScope} />
      </div>
    </ResponsiveDialog>
  )
}

function GrantRole({
  action,
  grantable,
  roleScopes,
  fields,
}: {
  action: string
  grantable: string[]
  roleScopes: Record<string, RoleScopeRule>
  fields: string[]
}) {
  const t = useT()
  const [role, setRole] = useState(grantable[0] ?? '')
  const [scope, setScope] = useState<ScopeValue>(emptyScope)
  const [processing, setProcessing] = useState(false)
  const rule = roleScopes[role]

  return (
    <Section title={t('staff.member.grant_title')}>
      {grantable.length === 0 ? (
        <p className="text-muted">{t('staff.member.grant_none')}</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            router.post(
              action,
              { role, ...(rule ? scopePayload(scope, rule) : {}) },
              {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: () => setScope(emptyScope),
              }
            )
          }}
        >
          <SelectField
            label={t('staff.member.grant_role')}
            name="role"
            defaultValue={role}
            onChange={(value) => {
              setRole(value)
              setScope(emptyScope)
            }}
            options={grantable.map((value) => ({ value, label: t(`staff.roles.${value}`) }))}
          />
          {role && <p className="text-sm text-muted">{t(`staff.role_notes.${role}`)}</p>}
          {rule && <ScopeEditor rule={rule} fields={fields} value={scope} onChange={setScope} />}
          <Button type="submit" disabled={processing || !role}>
            {t('staff.member.grant_submit')}
          </Button>
        </form>
      )}
    </Section>
  )
}
