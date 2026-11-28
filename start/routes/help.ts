/*
|--------------------------------------------------------------------------
| Routes: Minta Bantuan and support sessions (R2-06)
|--------------------------------------------------------------------------
|
| app. (every signed-in school user, with or without a school, D-459):
|   Minta bantuan (form) and Bantuan saya (own requests, replies).
| admin. (staff, abilities checked in the controllers):
|   Permintaan bantuan (list, request, reply, note, status, take),
|   "Lihat sekolah ini" and the read-only school view (support
|   sessions, D-341), and the internal list of sessions.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { hosts } from '#config/hosts'

const HelpController = () => import('#help/controllers/help_controller')
const ConsoleHelpRequestsController = () =>
  import('#help/controllers/console_help_requests_controller')
const SupportSessionsController = () => import('#help/controllers/support_sessions_controller')

const id = router.matchers.number()
const uuid = router.matchers.uuid()

router
  .group(() => {
    router.get('/minta-bantuan', [HelpController, 'create']).as('help.create')
    router.post('/minta-bantuan', [HelpController, 'store']).as('help.store')
    router.get('/bantuan-saya', [HelpController, 'index']).as('help.index')
    router
      .get('/bantuan-saya/:helpRequest', [HelpController, 'show'])
      .as('help.show')
      .where('helpRequest', uuid)
  })
  .domain(hosts.app)
  .as('app')
  .use([
    middleware.translations(['auth', 'help']),
    middleware.auth({ guard: 'web' }),
    middleware.school({ optional: true }),
  ])

router
  .group(() => {
    router.get('/bantuan', [ConsoleHelpRequestsController, 'index']).as('help_requests.index')
    router
      .get('/bantuan/:request', [ConsoleHelpRequestsController, 'show'])
      .as('help_requests.show')
      .where('request', id)
    router
      .post('/bantuan/:request/balas', [ConsoleHelpRequestsController, 'reply'])
      .as('help_requests.reply')
      .where('request', id)
    router
      .post('/bantuan/:request/catatan', [ConsoleHelpRequestsController, 'note'])
      .as('help_requests.note')
      .where('request', id)
    router
      .post('/bantuan/:request/status', [ConsoleHelpRequestsController, 'status'])
      .as('help_requests.status')
      .where('request', id)
    router
      .post('/bantuan/:request/ambil', [ConsoleHelpRequestsController, 'assign'])
      .as('help_requests.assign')
      .where('request', id)

    router
      .post('/sekolah/:school/lihat', [SupportSessionsController, 'start'])
      .as('support_sessions.start')
      .where('school', id)
    router.get('/lihat-sekolah', [SupportSessionsController, 'show']).as('support_sessions.show')
    router
      .post('/lihat-sekolah/akhiri', [SupportSessionsController, 'end'])
      .as('support_sessions.end')
    router.get('/sesi-bantuan', [SupportSessionsController, 'index']).as('support_sessions.index')
  })
  .domain(hosts.admin)
  .as('admin')
  .use([
    middleware.auth({ guard: 'staff' }),
    middleware.translations(['auth', 'areas', 'console', 'accounts', 'help', 'regions']),
  ])
