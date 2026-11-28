import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import {
  ACTIVE_MEMBERSHIP_SESSION_KEY,
  resolveActiveMembership,
  type ActiveMembership,
} from './active_membership.js'
import { SchoolContext } from './school_context.js'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    /** Set by the school context middleware on app. routes. */
    membership?: ActiveMembership
  }
}

/**
 * A signed-in school user with no active membership in any school.
 */
export class NoActiveMembershipException extends Exception {
  static status = 403
  static code = 'E_NO_ACTIVE_MEMBERSHIP'
  static message = 'The user has no active school membership.'
}

/**
 * Runs the rest of an app. request inside the school context of the
 * user's active membership (the session's choice, else the earliest
 * active one). Place it after `auth({ guard: 'web' })`. The context is
 * new for each request, so nothing carries over between requests.
 */
export default class SchoolContextMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail() as { id: number }
    const preferred = ctx.session?.get(ACTIVE_MEMBERSHIP_SESSION_KEY) as string | undefined
    const membership = await resolveActiveMembership(user.id, preferred)

    if (!membership) {
      throw new NoActiveMembershipException()
    }
    if (preferred && preferred !== membership.publicId) {
      ctx.session.forget(ACTIVE_MEMBERSHIP_SESSION_KEY)
    }

    ctx.membership = membership
    return SchoolContext.run({ schoolId: membership.schoolId, userId: user.id }, () => next())
  }
}
