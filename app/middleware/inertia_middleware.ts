import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'
import { areaForHost } from '#config/hosts'
import { messagesFor, SHARED_NAMESPACES } from '#middleware/translations_middleware'
import User from '#models/user'
import StaffUser from '#models/staff_user'
import ExamParticipant from '#models/exam_participant'
import { abilitiesOf } from '#staff/access'
import { unreadCount } from '#publishing/announcement_feed'

/**
 * Who is signed in, in the shape every layout needs. Only the guard of
 * the current area is ever authenticated on a request.
 */
function viewerOf(user: unknown): { name: string } | null {
  if (user instanceof User || user instanceof StaffUser) {
    return { name: user.name }
  }
  if (user instanceof ExamParticipant) {
    return { name: user.username }
  }
  return null
}

export default class InertiaMiddleware extends BaseInertiaMiddleware {
  async share(ctx: HttpContext) {
    /**
     * A page may render before the session or auth middleware ran (for
     * example a 404), so the context may be partly hydrated.
     */
    const { auth, request, i18n } = ctx as Partial<HttpContext>
    const locale = i18n?.locale ?? 'id'
    const kabarUnread =
      auth?.user instanceof User && areaForHost(request?.hostname()) === 'app'
        ? await unreadCount(auth.user.id)
        : 0

    return {
      errors: ctx.inertia.always(this.getValidationErrors(ctx)),
      area: ctx.inertia.always(areaForHost(request?.hostname()) ?? 'app'),
      viewer: ctx.inertia.always(viewerOf(auth?.user)),
      /**
       * The role the request runs as on app. (school context
       * middleware), for the menus; null without a school.
       */
      role: ctx.inertia.always(ctx.membership?.role ?? null),
      /**
       * What the signed-in staff member may do on admin. (app/staff/
       * abilities.ts), for the console menu and buttons; the server
       * checks every action again. Empty elsewhere.
       */
      staffAbilities: ctx.inertia.always(
        auth?.user instanceof StaffUser && auth.user.$preloaded.roleAssignments
          ? abilitiesOf(auth.user)
          : []
      ),
      /**
       * Kabar the signed-in school user has not opened yet, for the
       * badge in the app header (R2-05); 0 elsewhere.
       */
      kabarUnread: ctx.inertia.always(kabarUnread),
      /**
       * The signed-in school user's address while it is not confirmed
       * (D-469), for the reminder banner; null otherwise.
       */
      emailToConfirm: ctx.inertia.always(
        auth?.user instanceof User && !auth.user.emailVerifiedAt ? auth.user.email : null
      ),
      messages: messagesFor(locale, [...SHARED_NAMESPACES, ...(ctx.translationNamespaces ?? [])]),
    }
  }

  flash(ctx: HttpContext) {
    /**
     * Flash messages travel in the page's `flash` field and are shown
     * as toasts (Fondasi feedback.md tier 1).
     */
    const { session } = ctx as Partial<HttpContext>

    const success: string | undefined = session?.flashMessages.get('success')
    const error: string | undefined = session?.flashMessages.get('error')

    return { success, error }
  }

  async handle(ctx: HttpContext, next: NextFn) {
    await this.init(ctx)

    const output = await next()
    this.dispose(ctx)

    return output
  }
}

declare module '@adonisjs/inertia/types' {
  type MiddlewareSharedProps = InferSharedProps<InertiaMiddleware>
  export interface SharedProps extends MiddlewareSharedProps {}
}
