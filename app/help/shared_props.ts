import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import StaffUser from '#models/staff_user'
import { staffCan } from '#staff/access'
import { SchoolContext } from '#tenancy/school_context'
import { unreadHelpCount } from './help_requests.js'
import { openSupportSessionOf } from './support_sessions.js'

/**
 * Shared Inertia props of R2-06, resolved when a page renders (inside
 * the request's school context). A failure never breaks the page: the
 * prop falls back to "nothing" and the error is logged.
 */

/**
 * app.: how many of the signed-in user's requests have unread news
 * (the dot on "Bantuan saya" in the account menu, D-320).
 */
export async function helpUnreadProp(user: unknown): Promise<number> {
  if (!(user instanceof User)) return 0
  const scope = SchoolContext.current()
  if (!scope || scope.userId !== user.id) return 0
  try {
    return await unreadHelpCount(user.id)
  } catch (error) {
    logger.warn({ err: error }, 'help unread count failed')
    return 0
  }
}

/**
 * admin.: the open support session of the signed-in staff member, for
 * the banner on every console page (D-341); null for staff who cannot
 * open one.
 */
export async function supportSessionProp(
  staff: unknown
): Promise<{ schoolName: string; expiresAt: string } | null> {
  if (!(staff instanceof StaffUser) || !staff.$preloaded.roleAssignments) return null
  if (!staffCan(staff, 'support_sessions.start')) return null
  try {
    const session = await openSupportSessionOf(staff.id)
    return session
      ? { schoolName: session.schoolName, expiresAt: session.expiresAt.toISO()! }
      : null
  } catch (error) {
    logger.warn({ err: error }, 'support session lookup failed')
    return null
  }
}
