import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import StaffUser from '#models/staff_user'
import { staffCan } from '#staff/access'
import type { MembershipRole } from '#models/school_membership'
import type { ActiveMembership } from '#tenancy/active_membership'

/**
 * Who may do what in the layer model (§6.1, D-380, D-466).
 *
 * School: the operator changes the school layer and chooses local
 * agreements directly; teachers and the principal propose; the
 * principal is told about choices.
 *
 * Staff: every staff role may propose an area change (`layers.propose`).
 * Approvers hold `layers.approve`: owner, admin, and the roles the draft
 * names, `regional_lead` (Koordinator Wilayah SIGRAK) and `validator`
 * (app/staff/powers.ts, R2-01). Area scopes (D-338) do not limit
 * proposals and approvals yet: every proposer and approver covers every
 * area (open question in the R2-01 Result).
 */
export const SCHOOL_LAYER_EDITOR_ROLES: readonly MembershipRole[] = ['operator']
export const SCHOOL_LAYER_PROPOSER_ROLES: readonly MembershipRole[] = ['teacher', 'principal']

export class LayerAccessDeniedException extends Exception {
  static status = 403
  static code = 'E_LAYER_ACCESS_DENIED'
  static message = 'This role cannot make this layer change.'
}

export function membershipOf(ctx: HttpContext): ActiveMembership {
  if (!ctx.membership) throw new LayerAccessDeniedException()
  return ctx.membership
}

export function canEditSchoolLayer(role: MembershipRole) {
  return SCHOOL_LAYER_EDITOR_ROLES.includes(role)
}

export function canProposeSchoolChange(role: MembershipRole) {
  return SCHOOL_LAYER_PROPOSER_ROLES.includes(role)
}

/**
 * The active membership, when its role may change the school layer.
 */
export function schoolLayerEditor(ctx: HttpContext): ActiveMembership {
  const membership = membershipOf(ctx)
  if (!canEditSchoolLayer(membership.role)) throw new LayerAccessDeniedException()
  return membership
}

export function canApproveAreaChange(staff: StaffUser) {
  return staffCan(staff, 'layers.approve')
}

/**
 * The signed-in staff member, when their role may propose area changes.
 */
export function layerStaff(ctx: HttpContext): StaffUser {
  const staff = ctx.auth.use('staff').getUserOrFail()
  if (!(staff instanceof StaffUser) || !staffCan(staff, 'layers.propose')) {
    throw new LayerAccessDeniedException()
  }
  return staff
}
