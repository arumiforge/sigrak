import { useState } from 'react'
import { Link, useForm } from '@inertiajs/react'
import { DataTable, type DataColumn } from '~/components/patterns/data_table'
import { EmptyState } from '~/components/patterns/empty_state'
import { PageHeader } from '~/components/patterns/page_header'
import { ResponsiveDialog } from '~/components/patterns/responsive_dialog'
import { StatusChip } from '~/components/patterns/status_chip'
import { SelectField } from '~/components/section'
import {
  ScopeEditor,
  emptyScope,
  scopePayload,
  type RoleScopeRule,
  type ScopeValue,
} from '~/components/staff/scope_editor'
import { TextField } from '~/components/text_field'
import { Button } from '~/components/ui/button'
import { Icon } from '~/components/icon'
import { useT } from '~/lib/i18n'

type Member = {
  id: number
  name: string
  email: string
  disabled: boolean
  roles: string[]
  self: boolean
  twoFactor: { enabled: boolean; required: boolean }
}

type Props = {
  staff: Member[]
  grantable: string[]
  roleScopes: Record<string, RoleScopeRule>
  fields: string[]
  can: { manage: boolean }
}

/**
 * Konsol /staf (R2-01): Tim SIGRAK accounts with their roles and
 * status; "Tambah staf" makes an account with a first role and mails
 * the set-password link. Abilities: `staff.view`, `staff.manage`.
 */
export default function ConsoleStaff({ staff, grantable, roleScopes, fields, can }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)

  const columns: DataColumn<Member>[] = [
    {
      id: 'name',
      header: t('staff.list.name'),
      primary: true,
      cell: (member) => (
        <Link
          href={`/staf/${member.id}`}
          prefetch
          className="font-semibold text-brand-strong hover:underline"
        >
          {member.name}
          {member.self && <span className="font-normal text-muted"> ({t('staff.list.you')})</span>}
        </Link>
      ),
    },
    {
      id: 'email',
      header: t('staff.list.email'),
      cell: (member) => <span className="break-all">{member.email}</span>,
    },
    {
      id: 'roles',
      header: t('staff.list.roles'),
      cell: (member) =>
        member.roles.length === 0 ? (
          <span className="text-muted">{t('staff.list.no_roles')}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {member.roles.map((role) => (
              <StatusChip key={role} tone="brand">
                {t(`staff.roles.${role}`)}
              </StatusChip>
            ))}
          </span>
        ),
    },
    {
      id: 'two_factor',
      header: t('staff.list.two_factor'),
      cell: (member) =>
        member.twoFactor.enabled ? (
          <StatusChip tone="ok">{t('staff.list.two_factor_on')}</StatusChip>
        ) : (
          <StatusChip tone={member.twoFactor.required ? 'warn' : 'neutral'}>
            {member.twoFactor.required
              ? t('staff.list.two_factor_missing')
              : t('staff.list.two_factor_off')}
          </StatusChip>
        ),
    },
    {
      id: 'status',
      header: t('staff.list.status'),
      cell: (member) =>
        member.disabled ? (
          <StatusChip tone="neutral">{t('staff.list.disabled')}</StatusChip>
        ) : (
          <StatusChip tone="ok">{t('staff.list.active')}</StatusChip>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t('staff.list.title')}
        description={t('staff.list.intro')}
        actions={
          can.manage && (
            <Button onClick={() => setOpen(true)}>
              <Icon name="add" />
              {t('staff.list.add')}
            </Button>
          )
        }
      />

      <DataTable
        rows={staff}
        columns={columns}
        getRowId={(member) => String(member.id)}
        caption={t('staff.list.caption')}
        empty={<EmptyState icon="staff" description={t('staff.list.empty')} />}
        rowActions={(member) => (
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/staf/${member.id}`}
              prefetch
              aria-label={t('staff.list.open_label', { name: member.name })}
            >
              {t('staff.list.open')}
            </Link>
          </Button>
        )}
      />

      {can.manage && (
        <CreateStaffDialog
          open={open}
          onOpenChange={setOpen}
          grantable={grantable}
          roleScopes={roleScopes}
          fields={fields}
        />
      )}
    </>
  )
}

function CreateStaffDialog({
  open,
  onOpenChange,
  grantable,
  roleScopes,
  fields,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  grantable: string[]
  roleScopes: Record<string, RoleScopeRule>
  fields: string[]
}) {
  const t = useT()
  const firstRole = grantable.includes('support') ? 'support' : (grantable[0] ?? '')
  const form = useForm({ name: '', email: '', role: firstRole })
  const [scope, setScope] = useState<ScopeValue>(emptyScope)
  const rule = roleScopes[form.data.role]

  const submit = () => {
    form.transform((data) => ({ ...data, ...(rule ? scopePayload(scope, rule) : {}) }))
    form.post('/staf', {
      preserveScroll: true,
      onSuccess: () => {
        form.reset()
        setScope(emptyScope)
        onOpenChange(false)
      },
    })
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('staff.create.title')}
      description={t('staff.create.intro')}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" form="create-staff" disabled={form.processing}>
            {t('staff.create.submit')}
          </Button>
        </>
      }
    >
      <form
        id="create-staff"
        className="max-h-[60dvh] space-y-4 overflow-y-auto px-4 pb-2 sm:max-h-[65dvh] sm:px-0"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <TextField
          label={t('staff.create.name')}
          name="name"
          autoComplete="off"
          required
          value={form.data.name}
          onChange={(event) => form.setData('name', event.target.value)}
          error={form.errors.name}
        />
        <TextField
          label={t('staff.create.email')}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          required
          value={form.data.email}
          onChange={(event) => form.setData('email', event.target.value)}
          error={form.errors.email}
        />
        <SelectField
          label={t('staff.create.role')}
          name="role"
          defaultValue={form.data.role}
          error={form.errors.role}
          onChange={(value) => {
            form.setData('role', value)
            setScope(emptyScope)
          }}
          options={grantable.map((role) => ({ value: role, label: t(`staff.roles.${role}`) }))}
        />
        <p className="text-sm text-muted">
          {form.data.role ? t(`staff.role_notes.${form.data.role}`) : null}
        </p>
        {rule && <ScopeEditor rule={rule} fields={fields} value={scope} onChange={setScope} />}
      </form>
    </ResponsiveDialog>
  )
}
