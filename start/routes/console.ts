/*
|--------------------------------------------------------------------------
| Routes: minimal staff console on admin. (R1-05)
|--------------------------------------------------------------------------
|
| Schools, members, invitations, trials and the default trial length
| (D-182, D-459). Each action checks the staff ability and scope
| (app/staff/access.ts); school-owned rows are read in a staff
| transaction.
| The sign-in routes stay in start/routes.ts.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { hosts } from '#config/hosts'

const SchoolsController = () => import('#controllers/staff/schools_controller')
const UsersController = () => import('#controllers/staff/users_controller')
const SettingsController = () => import('#controllers/staff/settings_controller')

const id = router.matchers.number()
const uuid = router.matchers.uuid()

router
  .group(() => {
    router.get('/sekolah', [SchoolsController, 'index']).as('schools.index')
    router
      .get('/sekolah/:school', [SchoolsController, 'show'])
      .as('schools.show')
      .where('school', id)
    router
      .post('/sekolah/:school/undangan', [SchoolsController, 'invite'])
      .as('schools.invite')
      .where('school', id)
    router
      .post('/sekolah/:school/undangan/:invitation/kirim-ulang', [SchoolsController, 'resend'])
      .as('schools.resend')
      .where('school', id)
      .where('invitation', uuid)
    router
      .post('/sekolah/:school/undangan/:invitation/batal', [SchoolsController, 'cancel'])
      .as('schools.cancel')
      .where('school', id)
      .where('invitation', uuid)
    router
      .post('/sekolah/:school/uji-coba', [SchoolsController, 'updateTrial'])
      .as('schools.trial')
      .where('school', id)

    router.get('/pengguna', [UsersController, 'index']).as('users.index')
    router
      .post('/pengguna/:user/uji-coba', [UsersController, 'updateTrial'])
      .as('users.trial')
      .where('user', id)

    router.get('/pengaturan', [SettingsController, 'show']).as('settings.show')
    router.post('/pengaturan', [SettingsController, 'update']).as('settings.update')
  })
  .domain(hosts.admin)
  .as('admin')
  .use([
    middleware.auth({ guard: 'staff' }),
    middleware.translations(['auth', 'areas', 'accounts', 'console']),
  ])
