import type { HttpContext } from '@adonisjs/core/http'

/**
 * Placeholder home of the staff console on admin.
 */
export default class HomeController {
  async show({ inertia }: HttpContext) {
    return inertia.render('admin/home', {})
  }
}
