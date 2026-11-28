import type { HttpContext } from '@adonisjs/core/http'
import { findStaffForLink, setPasswordFromLink } from '../staff_accounts.js'
import { staffPasswordValidator } from '../validators.js'

/**
 * admin. /kata-sandi-baru/{token}: a new staff member (or one whose
 * link an admin sent again) sets a password, then signs in. Works
 * without a session; an unknown, used or expired link gets one neutral
 * answer.
 */
export default class StaffPasswordController {
  async edit({ inertia, params }: HttpContext) {
    const staff = await findStaffForLink(params.token)
    return inertia.render('auth/reset_password', {
      valid: staff !== null,
      email: staff?.email ?? null,
      staff: true,
    })
  }

  async update({ request, params, session, i18n, response }: HttpContext) {
    const { password } = await request.validateUsing(staffPasswordValidator)
    const staff = await setPasswordFromLink(params.token, password)
    session.flash(
      staff ? 'success' : 'error',
      i18n.t(staff ? 'auth.reset.done' : 'staff.password.link_invalid')
    )
    return response.redirect().toPath('/masuk')
  }
}
