import { Exception } from '@adonisjs/core/exceptions'
import type StaffUser from '#models/staff_user'
import type { StaffRole } from '#models/staff_user'

/**
 * What each staff role may do in the minimal console, from the access
 * matrix in docs/drafts/internal-roles.md (§3), mapped onto the three
 * roles the code has until the console slice (D-339):
 *
 * - admin: schools, members, invitations, trials, the default trial.
 * - support: schools and members, invitations (resend, invite the first
 *   operator); trials read-only.
 * - content: none of these.
 */
export type StaffAbility = 'schools.view' | 'invitations.manage' | 'trials.manage'

const powers: Record<StaffRole, StaffAbility[]> = {
  admin: ['schools.view', 'invitations.manage', 'trials.manage'],
  support: ['schools.view', 'invitations.manage'],
  content: [],
}

export function staffCan(staff: StaffUser, ability: StaffAbility) {
  return powers[staff.role]?.includes(ability) ?? false
}

export class StaffForbiddenException extends Exception {
  static status = 403
  static code = 'E_STAFF_FORBIDDEN'
  static message = 'This staff role may not do this.'
}

export function authorizeStaff(staff: StaffUser, ability: StaffAbility) {
  if (!staffCan(staff, ability)) throw new StaffForbiddenException()
}
