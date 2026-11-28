import type { HttpContext } from '@adonisjs/core/http'
import { currentStaff } from '#staff/access'
import { attentionFor } from '#staff/console_home'

/**
 * Konsol home (R2-09): what waits for the signed-in staff member's
 * roles (deferred, counts only) and the console menu as shortcuts,
 * grouped like the sidebar. Every staff member may open it.
 */
export default class HomeController {
  async show(ctx: HttpContext) {
    const staff = await currentStaff(ctx)
    return ctx.inertia.render('admin/home', {
      attention: ctx.inertia.defer(() => attentionFor(staff)),
    })
  }
}
