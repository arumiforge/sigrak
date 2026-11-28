import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import StaffUser from '#models/staff_user'
import type { MembershipRole } from '#models/school_membership'
import type { ActiveMembership } from '#tenancy/active_membership'

/**
 * Small request helpers for the account pages.
 */
export class RoleRequiredException extends Exception {
  static status = 403
  static code = 'E_ROLE_REQUIRED'
  static message = 'The active membership does not have the role this page needs.'
}

/** The signed-in school user (guard "web"). */
export function schoolUser(ctx: HttpContext): User {
  const user = ctx.auth.use('web').getUserOrFail()
  if (!(user instanceof User)) throw new Error('Expected a school user')
  return user
}

/** The signed-in staff member (guard "staff"). */
export function staffUser(ctx: HttpContext): StaffUser {
  const staff = ctx.auth.use('staff').getUserOrFail()
  if (!(staff instanceof StaffUser)) throw new Error('Expected a staff user')
  return staff
}

/**
 * The active membership, which must have `role` (the role switch picks
 * it). Needs `middleware.school()` on the route.
 */
export function requireRole(ctx: HttpContext, role: MembershipRole): ActiveMembership {
  if (!ctx.membership || ctx.membership.role !== role) throw new RoleRequiredException()
  return ctx.membership
}

/**
 * Back to a form with one error on a field, keeping what was typed
 * except passwords.
 */
export function backWithFieldError(ctx: HttpContext, path: string, field: string, message: string) {
  ctx.session.flashExcept(['password', 'password_confirmation', 'current_password', '_csrf'])
  ctx.session.flash('inputErrorsBag', { [field]: [message] })
  return ctx.response.redirect().toPath(path)
}
