/*
|--------------------------------------------------------------------------
| Routes: Tim SIGRAK staff on admin. (R2-01)
|--------------------------------------------------------------------------
|
| Staf (accounts, roles and scopes, D-338, D-339), Log aktivitas and
| Peran (D-314, D-481). Each action checks its ability (app/staff/
| abilities.ts) in the controller. The set-password link works without
| a session.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { hosts } from '#config/hosts'
import { resetPasswordThrottle } from '#accounts/throttles'
import { TOKEN_PATTERN } from '#accounts/tokens'
import { STAFF_ROLES } from '#staff/roles'

const StaffController = () => import('#staff/controllers/staff_controller')
const ActivityLogController = () => import('#staff/controllers/activity_log_controller')
const AccessMatrixController = () => import('#staff/controllers/access_matrix_controller')
const StaffPasswordController = () => import('#staff/controllers/staff_password_controller')

const id = router.matchers.number()
const token = { match: TOKEN_PATTERN }
const role = { match: new RegExp(`^(${STAFF_ROLES.join('|')})$`) }

router
  .group(() => {
    router.get('/staf', [StaffController, 'index']).as('staff.index')
    router.post('/staf', [StaffController, 'store']).as('staff.store')
    router.get('/staf/pilihan-cakupan', [StaffController, 'scopeOptions']).as('staff.scope_options')
    router.get('/staf/:staff', [StaffController, 'show']).as('staff.show').where('staff', id)
    router
      .post('/staf/:staff/peran', [StaffController, 'grant'])
      .as('staff.grant')
      .where('staff', id)
    router
      .post('/staf/:staff/peran/:role', [StaffController, 'scope'])
      .as('staff.scope')
      .where('staff', id)
      .where('role', role)
    router
      .post('/staf/:staff/peran/:role/cabut', [StaffController, 'revoke'])
      .as('staff.revoke')
      .where('staff', id)
      .where('role', role)
    router
      .post('/staf/:staff/nonaktifkan', [StaffController, 'disable'])
      .as('staff.disable')
      .where('staff', id)
    router
      .post('/staf/:staff/aktifkan', [StaffController, 'enable'])
      .as('staff.enable')
      .where('staff', id)
    router
      .post('/staf/:staff/kirim-tautan', [StaffController, 'resendLink'])
      .as('staff.resend_link')
      .where('staff', id)

    router.get('/log-aktivitas', [ActivityLogController, 'index']).as('activity_log.index')
    router.get('/peran', [AccessMatrixController, 'index']).as('access_matrix.index')
  })
  .domain(hosts.admin)
  .as('admin')
  .use([
    middleware.auth({ guard: 'staff' }),
    middleware.translations(['auth', 'areas', 'console', 'staff', 'regions', 'two_factor']),
  ])

router
  .group(() => {
    router
      .get('/kata-sandi-baru/:token', [StaffPasswordController, 'edit'])
      .as('staff_password.edit')
      .where('token', token)
    router
      .post('/kata-sandi-baru/:token', [StaffPasswordController, 'update'])
      .as('staff_password.update')
      .where('token', token)
      .use(resetPasswordThrottle)
  })
  .domain(hosts.admin)
  .as('admin')
  .use([middleware.guest({ guard: 'staff' }), middleware.translations(['auth', 'staff'])])
