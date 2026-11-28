import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import type { ChainableContract } from '@adonisjs/lucid/types/querybuilder'
import StaffUser from '#models/staff_user'
import type StaffRoleAssignment from '#models/staff_role_assignment'
import type { StaffAbility } from './abilities.js'
import { POWERS, roleHas } from './powers.js'
import { ROLE_SCOPES, type ScopeField, type ScopeLevel, type StaffRole } from './roles.js'

/**
 * Staff authorisation (D-314, D-338): a staff member may do something
 * when one of their role assignments grants the ability and that
 * assignment's scope covers the thing. Powers come from code
 * (powers.ts), scopes from data (staff_role_assignments).
 *
 * Every helper reads the assignments loaded on the StaffUser
 * (`roleAssignments`). The staff auth middleware loads them once per
 * request; code outside a request calls `loadStaffAccess` first. A
 * helper on an account without them throws, so a missing load never
 * passes as "no roles".
 */

export class StaffForbiddenException extends Exception {
  static status = 403
  static code = 'E_STAFF_FORBIDDEN'
  static message = 'This staff member may not do this.'
}

/** Loads the roles and scopes of `staff` when they are not loaded yet. */
export async function loadStaffAccess(staff: StaffUser) {
  if (!staff.$preloaded.roleAssignments) await staff.load('roleAssignments')
  return staff
}

export function assignmentsOf(staff: StaffUser): StaffRoleAssignment[] {
  const loaded = staff.$preloaded.roleAssignments as StaffRoleAssignment[] | undefined
  if (!loaded) throw new Error('Staff role assignments are not loaded (loadStaffAccess)')
  return loaded
}

export function rolesOf(staff: StaffUser): StaffRole[] {
  return assignmentsOf(staff).map((assignment) => assignment.role)
}

export function hasRole(staff: StaffUser, role: StaffRole) {
  return rolesOf(staff).includes(role)
}

/** The assignments of an active staff member that grant `ability`. */
export function grantsFor(staff: StaffUser, ability: StaffAbility) {
  if (staff.disabledAt) return []
  return assignmentsOf(staff).filter((assignment) => roleHas(assignment.role, ability))
}

/** Whether any role grants `ability`, whatever its scope. */
export function staffCan(staff: StaffUser, ability: StaffAbility) {
  return grantsFor(staff, ability).length > 0
}

/** Every ability the staff member holds through any role (for menus and pages). */
export function abilitiesOf(staff: StaffUser): StaffAbility[] {
  if (staff.disabledAt) return []
  const all = new Set<StaffAbility>()
  for (const assignment of assignmentsOf(staff)) {
    for (const ability of POWERS[assignment.role]) all.add(ability)
  }
  return [...all].sort()
}

/* ----------------------------------------------------------------------
 * Scopes
 * -------------------------------------------------------------------- */

/**
 * Which schools an ability reaches: every school, or the union of the
 * granting assignments' areas (each optionally limited to levels).
 * `none` is a filter that matches no school.
 */
export type SchoolScope =
  | { all: true }
  | { all: false; areas: { regionIds: number[]; schoolIds: number[]; levels: ScopeLevel[] }[] }

function areaOf(assignment: StaffRoleAssignment) {
  const rule = ROLE_SCOPES[assignment.role]
  const regionIds = rule.area === 'none' ? [] : assignment.regionIds
  const schoolIds = rule.schools ? assignment.schoolIds : []
  const levels = rule.levels ? assignment.levels : []
  const unlimitedArea =
    rule.area === 'none' ||
    (rule.area === 'optional' && regionIds.length === 0 && schoolIds.length === 0)
  const emptyRequired = rule.area === 'required' && regionIds.length === 0 && schoolIds.length === 0
  return { regionIds, schoolIds, levels, unlimitedArea, emptyRequired }
}

export function schoolScopeOf(staff: StaffUser, ability: StaffAbility): SchoolScope {
  const areas: { regionIds: number[]; schoolIds: number[]; levels: ScopeLevel[] }[] = []
  for (const assignment of grantsFor(staff, ability)) {
    const area = areaOf(assignment)
    if (area.emptyRequired) continue
    if (area.unlimitedArea && area.levels.length === 0) return { all: true }
    areas.push(
      area.unlimitedArea
        ? { regionIds: [], schoolIds: [], levels: area.levels }
        : { regionIds: area.regionIds, schoolIds: area.schoolIds, levels: area.levels }
    )
  }
  return { all: false, areas }
}

/**
 * Limits a query on `schools` (under `alias`) to a school scope. A
 * region id matches a school's kabupaten/kota (`region_id`), its
 * kecamatan (`district_id`) or the province above its kabupaten.
 */
export function applySchoolScope<Query extends ChainableContract>(
  query: Query,
  scope: SchoolScope,
  alias = 'schools'
): Query {
  if (scope.all) return query
  if (scope.areas.length === 0) return query.whereRaw('false')
  return query.where((outer: ChainableContract) => {
    for (const area of scope.areas) {
      outer.orWhere((inner: ChainableContract) => {
        const hasArea = area.regionIds.length > 0 || area.schoolIds.length > 0
        if (hasArea) {
          inner.where((place: ChainableContract) => {
            if (area.schoolIds.length > 0) {
              place.orWhereRaw(`${alias}.id = ANY(?::bigint[])`, [area.schoolIds])
            }
            if (area.regionIds.length > 0) {
              place
                .orWhereRaw(`${alias}.region_id = ANY(?::bigint[])`, [area.regionIds])
                .orWhereRaw(`${alias}.district_id = ANY(?::bigint[])`, [area.regionIds])
                .orWhereRaw(
                  `${alias}.region_id IN (SELECT r.id FROM regions r WHERE r.parent_id = ANY(?::bigint[]))`,
                  [area.regionIds]
                )
            }
          })
        }
        if (area.levels.length > 0) {
          inner.whereRaw(`${alias}.level = ANY(?::text[])`, [area.levels])
        }
        if (!hasArea && area.levels.length === 0) inner.whereRaw('true')
      })
    }
  })
}

/**
 * Whether `ability` reaches the school with this id (one query on the
 * owner connection: schools and regions are read only to decide).
 */
export async function withinScope(staff: StaffUser, ability: StaffAbility, schoolId: number) {
  const scope = schoolScopeOf(staff, ability)
  if (scope.all) return true
  if (scope.areas.length === 0) return false
  const query = db.from('schools').where('schools.id', schoolId).select('schools.id')
  applySchoolScope(query, scope)
  return Boolean(await query.first())
}

/**
 * Whether `ability` reaches a school user: unlimited scopes reach
 * everyone; an area reaches users with an active membership in a
 * school inside it (a teacher without a school is outside every area).
 */
export async function withinScopeForUser(staff: StaffUser, ability: StaffAbility, userId: number) {
  const scope = schoolScopeOf(staff, ability)
  if (scope.all) return true
  if (scope.areas.length === 0) return false
  const query = db
    .from('school_memberships as m')
    .join('schools', 'schools.id', 'm.school_id')
    .where('m.user_id', userId)
    .where('m.status', 'active')
    .select('m.id')
  applySchoolScope(query, scope)
  return Boolean(await query.first())
}

/** Whether `ability` covers a level (SD/MI) through a role that uses levels. */
export function coversLevel(staff: StaffUser, ability: StaffAbility, level: ScopeLevel) {
  return grantsFor(staff, ability).some((assignment) => {
    const levels = ROLE_SCOPES[assignment.role].levels ? assignment.levels : []
    return levels.length === 0 || levels.includes(level)
  })
}

/** Whether `ability` covers a field (bidang) through a role that uses fields. */
export function coversField(staff: StaffUser, ability: StaffAbility, field: ScopeField) {
  return grantsFor(staff, ability).some((assignment) => {
    const fields = ROLE_SCOPES[assignment.role].fields ? assignment.fields : []
    return fields.length === 0 || fields.includes(field)
  })
}

/**
 * The region ids `ability` is limited to, for targeting (Kabar, R2-05):
 * null when some granting role reaches every region.
 */
export function regionScopeOf(staff: StaffUser, ability: StaffAbility): number[] | null {
  const scope = schoolScopeOf(staff, ability)
  if (scope.all) return null
  if (scope.areas.some((area) => area.regionIds.length === 0 && area.schoolIds.length === 0)) {
    return null
  }
  return [...new Set(scope.areas.flatMap((area) => area.regionIds))]
}

/* ----------------------------------------------------------------------
 * Request helpers
 * -------------------------------------------------------------------- */

/** The signed-in staff member with roles loaded (guard "staff"). */
export async function currentStaff(ctx: HttpContext): Promise<StaffUser> {
  const staff = ctx.auth.use('staff').getUserOrFail()
  if (!(staff instanceof StaffUser)) throw new Error('Expected a staff user')
  return loadStaffAccess(staff)
}

/**
 * The signed-in staff member when they hold `ability` (and, with a
 * school id, when that ability's scope covers the school); a 403
 * otherwise. Every console page and action calls this first.
 */
export async function authorizeStaff(
  ctx: HttpContext,
  ability: StaffAbility,
  schoolId?: number
): Promise<StaffUser> {
  const staff = await currentStaff(ctx)
  if (!staffCan(staff, ability)) throw new StaffForbiddenException()
  if (schoolId !== undefined && !(await withinScope(staff, ability, schoolId))) {
    throw new StaffForbiddenException()
  }
  return staff
}

/** Like authorizeStaff, for an action on one school user. */
export async function authorizeStaffForUser(
  ctx: HttpContext,
  ability: StaffAbility,
  userId: number
): Promise<StaffUser> {
  const staff = await currentStaff(ctx)
  if (!staffCan(staff, ability)) throw new StaffForbiddenException()
  if (!(await withinScopeForUser(staff, ability, userId))) throw new StaffForbiddenException()
  return staff
}
