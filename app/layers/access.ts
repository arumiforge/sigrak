import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import StaffUser, { type StaffRole } from '#models/staff_user'
import type { MembershipRole } from '#models/school_membership'
import type { ActiveMembership } from '#tenancy/active_membership'

/**
 * Who may do what in the layer model (§6.1, D-380, D-466).
 *
 * School: the operator changes the school layer and chooses local
 * agreements directly; teachers and the principal propose; the
 * principal is told about choices.
 *
 * Staff: every staff role may propose an area change. Approvers are the
 * roles in `LAYER_APPROVER_ROLES`; the draft names `regional_lead`
 * (Koordinator Wilayah SIGRAK) and `validator` (D-338), which the staff
 * accounts do not have yet, so `admin` stands in until R1-05 or a later
 * task adds them. Area scopes per staff member (D-338) are not stored
 * yet either: every proposer and approver covers every area.
 */
export const SCHOOL_LAYER_EDITOR_ROLES: readonly MembershipRole[] = ['operator']
export const SCHOOL_LAYER_PROPOSER_ROLES: readonly MembershipRole[] = ['teacher', 'principal']
export const LAYER_PROPOSER_ROLES: readonly StaffRole[] = ['admin', 'support', 'content']
export const LAYER_APPROVER_ROLES: readonly StaffRole[] = ['admin']

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
  return LAYER_APPROVER_ROLES.includes(staff.role)
}

/**
 * The signed-in staff member, when their role may propose area changes.
 */
export function layerStaff(ctx: HttpContext): StaffUser {
  const staff = ctx.auth.use('staff').getUserOrFail()
  if (!(staff instanceof StaffUser) || !LAYER_PROPOSER_ROLES.includes(staff.role)) {
    throw new LayerAccessDeniedException()
  }
  return staff
}
