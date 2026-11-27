/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| Three hosts, each with its own guard and session cookie:
|   app.<domain>    school users   (guard "web")
|   admin.<domain>  Tim SIGRAK     (guard "staff")
|   ujian.<domain>  exam cards     (guard "exam")
|
| URL paths are Indonesian (D-149); route names stay English.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { loginIpThrottle } from '#start/limiter'
import { hosts } from '#config/hosts'

const SchoolSessionController = () => import('#controllers/school/session_controller')
const CalendarController = () => import('#controllers/school/calendar_controller')
const AiDemoController = () => import('#controllers/school/ai_demo_controller')
const StaffSessionController = () => import('#controllers/staff/session_controller')
const StaffHomeController = () => import('#controllers/staff/home_controller')
const ExamSessionController = () => import('#controllers/exam/session_controller')
const ExamHomeController = () => import('#controllers/exam/home_controller')

// GET /healthz is answered by HealthzMiddleware on every host, before routing.

/*
| app. — school users
*/
router
  .group(() => {
    router
      .group(() => {
        router.get('/masuk', [SchoolSessionController, 'create']).as('login')
        router
          .post('/masuk', [SchoolSessionController, 'store'])
          .as('login.store')
          .use(loginIpThrottle)
      })
      .use(middleware.guest({ guard: 'web' }))

    router
      .group(() => {
        router.on('/').redirectToPath('/kalender').as('home')
        router
          .get('/kalender', [CalendarController, 'index'])
          .as('calendar.index')
          .use(middleware.translations(['calendar']))
        router
          .group(() => {
            router.get('/coba-ai', [AiDemoController, 'index']).as('index')
            router.post('/coba-ai', [AiDemoController, 'store']).as('store')
            router
              .post('/coba-ai/:generation/batal', [AiDemoController, 'cancel'])
              .as('cancel')
              .where('generation', router.matchers.uuid())
            router
              .post('/coba-ai/:generation/coba-lagi', [AiDemoController, 'retry'])
              .as('retry')
              .where('generation', router.matchers.uuid())
          })
          .as('ai_demo')
          .use(middleware.translations(['ai_demo']))
        router.post('/keluar', [SchoolSessionController, 'destroy']).as('logout')
      })
      .use(middleware.auth({ guard: 'web' }))
    // The SSE endpoints (/__transmit/*) are registered in start/transmit.ts.
  })
  .domain(hosts.app)
  .as('app')
  .use(middleware.translations(['auth']))

/*
| admin. — Tim SIGRAK staff
*/
router
  .group(() => {
    router
      .group(() => {
        router.get('/masuk', [StaffSessionController, 'create']).as('login')
        router
          .post('/masuk', [StaffSessionController, 'store'])
          .as('login.store')
          .use(loginIpThrottle)
      })
      .use(middleware.guest({ guard: 'staff' }))

    router
      .group(() => {
        router.get('/', [StaffHomeController, 'show']).as('home')
        router.post('/keluar', [StaffSessionController, 'destroy']).as('logout')
      })
      .use(middleware.auth({ guard: 'staff' }))
  })
  .domain(hosts.admin)
  .as('admin')
  .use(middleware.translations(['auth', 'areas']))

/*
| ujian. — exam participants
*/
router
  .group(() => {
    router
      .group(() => {
        router.get('/masuk', [ExamSessionController, 'create']).as('login')
        router
          .post('/masuk', [ExamSessionController, 'store'])
          .as('login.store')
          .use(loginIpThrottle)
      })
      .use(middleware.guest({ guard: 'exam' }))

    router
      .group(() => {
        router.get('/', [ExamHomeController, 'show']).as('home')
        router.post('/keluar', [ExamSessionController, 'destroy']).as('logout')
      })
      .use(middleware.auth({ guard: 'exam' }))
  })
  .domain(hosts.exam)
  .as('exam')
  .use(middleware.translations(['auth', 'areas']))
