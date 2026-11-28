import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import StaffUser from '#models/staff_user'
import type StaffRoleAssignment from '#models/staff_role_assignment'
import { backWithFieldError } from '#accounts/http'
import { authorizeStaff, hasRole, staffCan } from '../access.js'
import {
  createStaff,
  grantRole,
  resendPasswordLink,
  revokeRole,
  setDisabled,
  StaffChangeRefusedException,
  updateScope,
  type ScopeInput,
} from '../staff_accounts.js'
import {
  HIGH_ROLES,
  ROLE_SCOPES,
  SCOPE_FIELDS,
  STAFF_ROLES,
  isStaffRole,
  type StaffRole,
} from '../roles.js'
import {
  createStaffValidator,
  grantRoleValidator,
  scopeSearchValidator,
  scopeValidator,
} from '../validators.js'

type RegionRow = { id: number; name: string; level: string; regency_kind: string | null }

/** A region as the scope picker shows it: its kind word, name and parent. */
async function regionsById(ids: number[]) {
  if (ids.length === 0) return new Map<number, ReturnType<typeof regionView>>()
  const rows = await db
    .from('regions as r')
    .leftJoin('regions as p', 'p.id', 'r.parent_id')
    .whereIn('r.id', ids)
    .select('r.id', 'r.name', 'r.level', 'r.regency_kind', 'p.name as parent_name')
  return new Map(
    rows.map((row: RegionRow & { parent_name: string | null }) => [Number(row.id), regionView(row)])
  )
}

function regionView(row: RegionRow & { parent_name: string | null }) {
  const kind = row.level === 'regency' ? (row.regency_kind ?? 'kabupaten') : row.level
  return { id: Number(row.id), name: row.name, kind, parentName: row.parent_name }
}

async function schoolsById(ids: number[]) {
  if (ids.length === 0) return new Map<number, { id: number; name: string; npsn: string | null }>()
  const rows = await db.from('schools').whereIn('id', ids).select('id', 'name', 'npsn')
  return new Map(
    rows.map((row: { id: number; name: string; npsn: string | null }) => [
      Number(row.id),
      { id: Number(row.id), name: row.name, npsn: row.npsn },
    ])
  )
}

const scopeInput = (input: {
  region_ids?: number[]
  school_ids?: number[]
  levels?: string[]
  fields?: string[]
}): ScopeInput => ({
  regionIds: input.region_ids,
  schoolIds: input.school_ids,
  levels: input.levels,
  fields: input.fields,
})

const roleOrder = (role: StaffRole) => STAFF_ROLES.indexOf(role)
const sortAssignments = (assignments: StaffRoleAssignment[]) =>
  [...assignments].sort((a, b) => roleOrder(a.role) - roleOrder(b.role))

/**
 * Konsol: Staf (R2-01). The list and a page per staff member with their
 * roles and scopes (D-338, D-339). Abilities: `staff.view` to look,
 * `staff.manage` to change, `staff.manage_high` for owner and admin
 * (app/staff/staff_accounts.ts holds the guards and the log).
 */
export default class StaffController {
  async index(ctx: HttpContext) {
    const actor = await authorizeStaff(ctx, 'staff.view')
    const staff = await StaffUser.query().preload('roleAssignments').orderBy('name', 'asc')

    return ctx.inertia.render('console/staff', {
      staff: staff.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        disabled: member.disabledAt !== null,
        roles: sortAssignments(member.roleAssignments).map((assignment) => assignment.role),
        self: member.id === actor.id,
      })),
      grantable: this.#grantable(actor),
      roleScopes: ROLE_SCOPES,
      fields: [...SCOPE_FIELDS],
      can: { manage: staffCan(actor, 'staff.manage') },
    })
  }

  async show(ctx: HttpContext) {
    const actor = await authorizeStaff(ctx, 'staff.view')
    const member = await StaffUser.query()
      .where('id', Number(ctx.params.staff))
      .preload('roleAssignments')
      .firstOrFail()
    const assignments = sortAssignments(member.roleAssignments)
    const regions = await regionsById([...new Set(assignments.flatMap((a) => a.regionIds))])
    const schools = await schoolsById([...new Set(assignments.flatMap((a) => a.schoolIds))])

    const self = member.id === actor.id
    const high = HIGH_ROLES.some((role) => hasRole(member, role))
    const manageHigh = staffCan(actor, 'staff.manage_high')
    const editable = staffCan(actor, 'staff.manage') && !self && (manageHigh || !high)

    const recent = await db
      .from('staff_activity_logs as l')
      .leftJoin('staff_users as s', 's.id', 'l.staff_user_id')
      .where('l.subject_type', 'staff')
      .where('l.subject_id', String(member.id))
      .orderBy('l.created_at', 'desc')
      .orderBy('l.id', 'desc')
      .limit(10)
      .select('l.id', 'l.action', 'l.changes', 'l.created_at', 's.name as staff_name')

    return ctx.inertia.render('console/staff_member', {
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        disabled: member.disabledAt !== null,
        createdAt: member.createdAt.toISO()!,
      },
      assignments: assignments.map((assignment) => ({
        role: assignment.role,
        regions: assignment.regionIds.map((id) => regions.get(id)).filter((r) => r !== undefined),
        schools: assignment.schoolIds.map((id) => schools.get(id)).filter((s) => s !== undefined),
        levels: assignment.levels,
        fields: assignment.fields,
        editable: editable && (manageHigh || !HIGH_ROLES.includes(assignment.role)),
      })),
      recent: recent.map(
        (row: {
          id: number
          action: string
          changes: Record<string, unknown>
          created_at: Date
          staff_name: string | null
        }) => ({
          id: Number(row.id),
          action: row.action,
          role: typeof row.changes?.role === 'string' ? row.changes.role : null,
          at: new Date(row.created_at).toISOString(),
          by: row.staff_name,
        })
      ),
      grantable: editable ? this.#grantable(actor).filter((role) => !hasRole(member, role)) : [],
      roleScopes: ROLE_SCOPES,
      fields: [...SCOPE_FIELDS],
      can: { edit: editable, self },
    })
  }

  async store(ctx: HttpContext) {
    const actor = await authorizeStaff(ctx, 'staff.manage')
    const input = await ctx.request.validateUsing(createStaffValidator)
    try {
      const created = await createStaff(actor, {
        name: input.name,
        email: input.email,
        role: input.role,
        scope: scopeInput(input),
      })
      ctx.session.flash('success', ctx.i18n.t('staff.toasts.created', { email: created.email }))
      return ctx.response.redirect().toPath(`/staf/${created.id}`)
    } catch (error) {
      if (error instanceof StaffChangeRefusedException) {
        const field = error.reason === 'email_taken' ? 'email' : 'role'
        return backWithFieldError(ctx, '/staf', field, ctx.i18n.t(`staff.errors.${error.reason}`))
      }
      throw error
    }
  }

  async grant(ctx: HttpContext) {
    const actor = await authorizeStaff(ctx, 'staff.manage')
    const input = await ctx.request.validateUsing(grantRoleValidator)
    return this.#change(ctx, async (id) => {
      await grantRole(actor, id, input.role, scopeInput(input))
      return ctx.i18n.t('staff.toasts.granted', {
        role: ctx.i18n.t(`staff.roles.${input.role}`),
      })
    })
  }

  async scope(ctx: HttpContext) {
    const actor = await authorizeStaff(ctx, 'staff.manage')
    const role = this.#role(ctx)
    const input = await ctx.request.validateUsing(scopeValidator)
    return this.#change(ctx, async (id) => {
      await updateScope(actor, id, role, scopeInput(input))
      return ctx.i18n.t('staff.toasts.scope_saved', { role: ctx.i18n.t(`staff.roles.${role}`) })
    })
  }

  async revoke(ctx: HttpContext) {
    const actor = await authorizeStaff(ctx, 'staff.manage')
    const role = this.#role(ctx)
    return this.#change(ctx, async (id) => {
      await revokeRole(actor, id, role)
      return ctx.i18n.t('staff.toasts.revoked', { role: ctx.i18n.t(`staff.roles.${role}`) })
    })
  }

  async disable(ctx: HttpContext) {
    const actor = await authorizeStaff(ctx, 'staff.manage')
    return this.#change(ctx, async (id) => {
      await setDisabled(actor, id, true)
      return ctx.i18n.t('staff.toasts.disabled')
    })
  }

  async enable(ctx: HttpContext) {
    const actor = await authorizeStaff(ctx, 'staff.manage')
    return this.#change(ctx, async (id) => {
      await setDisabled(actor, id, false)
      return ctx.i18n.t('staff.toasts.enabled')
    })
  }

  async resendLink(ctx: HttpContext) {
    const actor = await authorizeStaff(ctx, 'staff.manage')
    return this.#change(ctx, async (id) => {
      const target = await StaffUser.findOrFail(id)
      await resendPasswordLink(actor, target)
      return ctx.i18n.t('staff.toasts.link_sent', { email: target.email })
    })
  }

  /**
   * Regions (any level) and schools for the scope picker, as JSON.
   * Reference data and school names only; ability `staff.manage`.
   */
  async scopeOptions(ctx: HttpContext) {
    await authorizeStaff(ctx, 'staff.manage')
    const { wilayah, sekolah } = await ctx.request.validateUsing(scopeSearchValidator, {
      data: ctx.request.qs(),
    })
    const regions = wilayah
      ? await db
          .from('regions as r')
          .leftJoin('regions as p', 'p.id', 'r.parent_id')
          .where('r.status', 'active')
          .whereILike('r.name', `%${wilayah}%`)
          .orderByRaw(`array_position(ARRAY['province', 'regency', 'district'], r.level::text)`)
          .orderBy('r.name', 'asc')
          .limit(20)
          .select('r.id', 'r.name', 'r.level', 'r.regency_kind', 'p.name as parent_name')
      : []
    const schools = sekolah
      ? await db
          .from('schools')
          .where((where) => where.whereILike('name', `%${sekolah}%`).orWhere('npsn', sekolah))
          .orderBy('name', 'asc')
          .limit(20)
          .select('id', 'name', 'npsn')
      : []
    return ctx.response.json({
      regions: regions.map(regionView),
      schools: schools.map((row: { id: number; name: string; npsn: string | null }) => ({
        id: Number(row.id),
        name: row.name,
        npsn: row.npsn,
      })),
    })
  }

  /** Roles the actor may hand out: every role, high ones only with `staff.manage_high`. */
  #grantable(actor: StaffUser): StaffRole[] {
    if (!staffCan(actor, 'staff.manage')) return []
    const manageHigh = staffCan(actor, 'staff.manage_high')
    return STAFF_ROLES.filter((role) => manageHigh || !HIGH_ROLES.includes(role))
  }

  #role(ctx: HttpContext): StaffRole {
    const role = String(ctx.params.role)
    if (!isStaffRole(role)) ctx.response.abort('Unknown role', 404)
    return role as StaffRole
  }

  /** Runs a change on the staff member in the URL and returns to their page. */
  async #change(ctx: HttpContext, work: (id: number) => Promise<string>) {
    const id = Number(ctx.params.staff)
    const back = `/staf/${id}`
    try {
      ctx.session.flash('success', await work(id))
    } catch (error) {
      if (!(error instanceof StaffChangeRefusedException)) throw error
      ctx.session.flash('error', ctx.i18n.t(`staff.errors.${error.reason}`))
    }
    return ctx.response.redirect().toPath(back)
  }
}
