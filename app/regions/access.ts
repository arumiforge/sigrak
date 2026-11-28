import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import StaffUser from '#models/staff_user'
import { staffCan } from '#staff/access'

/**
 * Staff who work with the school directory and decide region changes
 * hold `regions.review` (docs/drafts/regional-layers.md §8: `support`
 * or `admin`; the owner too, app/staff/powers.ts).
 */

export class RegionAccessDeniedException extends Exception {
  static status = 403
  static code = 'E_REGION_ACCESS_DENIED'
  static message = 'This staff role cannot open the school directory or region changes.'
}

export function canReviewRegions(staff: StaffUser) {
  return staffCan(staff, 'regions.review')
}

/**
 * The signed-in staff member, when their role may use the directory and
 * the region change queue; 403 otherwise.
 */
export function regionReviewer({ auth }: HttpContext): StaffUser {
  const staff = auth.use('staff').getUserOrFail()
  if (!(staff instanceof StaffUser) || !canReviewRegions(staff)) {
    throw new RegionAccessDeniedException()
  }
  return staff
}
