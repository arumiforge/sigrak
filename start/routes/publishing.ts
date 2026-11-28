/*
|--------------------------------------------------------------------------
| Routes: Kabar, Acara, Cerita Sekolah and legal pages (R2-05)
|--------------------------------------------------------------------------
|
| admin.  the editors (D-435, D-477); each action checks its ability in
|         the controller (app/publishing/announcement_rules.ts for Kabar)
| app.    Kabar for the signed-in school user, with the unread badge
| sigrak.com  the public pages, server-rendered, without a session
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { hosts, publicHost } from '#config/hosts'
import { LEGAL_KEYS } from '#publishing/legal'

const ConsoleAnnouncementsController = () =>
  import('#publishing/controllers/console_announcements_controller')
const ConsoleEventsController = () => import('#publishing/controllers/console_events_controller')
const ConsoleStoriesController = () => import('#publishing/controllers/console_stories_controller')
const ConsoleLegalController = () => import('#publishing/controllers/console_legal_controller')
const AppAnnouncementsController = () =>
  import('#publishing/controllers/app_announcements_controller')
const PublicController = () => import('#publishing/controllers/public_controller')

const id = router.matchers.number()
const slug = { match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ }
const legalKey = { match: new RegExp(`^(${LEGAL_KEYS.join('|')})$`) }

router
  .group(() => {
    router
      .group(() => {
        router.get('/kabar', [ConsoleAnnouncementsController, 'index']).as('index')
        router.get('/kabar/baru', [ConsoleAnnouncementsController, 'create']).as('create')
        router
          .get('/kabar/pilihan-sasaran', [ConsoleAnnouncementsController, 'targetOptions'])
          .as('target_options')
        router.post('/kabar', [ConsoleAnnouncementsController, 'store']).as('store')
        router
          .get('/kabar/:announcement', [ConsoleAnnouncementsController, 'edit'])
          .as('edit')
          .where('announcement', id)
        router
          .post('/kabar/:announcement', [ConsoleAnnouncementsController, 'update'])
          .as('update')
          .where('announcement', id)
        router
          .post('/kabar/:announcement/tarik', [ConsoleAnnouncementsController, 'unpublish'])
          .as('unpublish')
          .where('announcement', id)
        router
          .post('/kabar/:announcement/hapus', [ConsoleAnnouncementsController, 'destroy'])
          .as('destroy')
          .where('announcement', id)
      })
      .as('announcements')

    router
      .group(() => {
        router.get('/acara', [ConsoleEventsController, 'index']).as('index')
        router.get('/acara/baru', [ConsoleEventsController, 'create']).as('create')
        router.post('/acara', [ConsoleEventsController, 'store']).as('store')
        router.get('/acara/:event', [ConsoleEventsController, 'edit']).as('edit').where('event', id)
        router
          .post('/acara/:event', [ConsoleEventsController, 'update'])
          .as('update')
          .where('event', id)
        router
          .post('/acara/:event/tarik', [ConsoleEventsController, 'unpublish'])
          .as('unpublish')
          .where('event', id)
        router
          .post('/acara/:event/hapus', [ConsoleEventsController, 'destroy'])
          .as('destroy')
          .where('event', id)
      })
      .as('events')

    router
      .group(() => {
        router.get('/cerita-sekolah', [ConsoleStoriesController, 'index']).as('index')
        router.get('/cerita-sekolah/baru', [ConsoleStoriesController, 'create']).as('create')
        router.post('/cerita-sekolah', [ConsoleStoriesController, 'store']).as('store')
        router
          .get('/cerita-sekolah/:story', [ConsoleStoriesController, 'edit'])
          .as('edit')
          .where('story', id)
        router
          .post('/cerita-sekolah/:story', [ConsoleStoriesController, 'update'])
          .as('update')
          .where('story', id)
        router
          .post('/cerita-sekolah/:story/tarik', [ConsoleStoriesController, 'unpublish'])
          .as('unpublish')
          .where('story', id)
        router
          .post('/cerita-sekolah/:story/hapus', [ConsoleStoriesController, 'destroy'])
          .as('destroy')
          .where('story', id)
      })
      .as('stories')

    router
      .group(() => {
        router.get('/halaman-legal', [ConsoleLegalController, 'index']).as('index')
        router
          .post('/halaman-legal/:key/versi-baru', [ConsoleLegalController, 'start'])
          .as('start')
          .where('key', legalKey)
        router
          .get('/halaman-legal/versi/:document', [ConsoleLegalController, 'edit'])
          .as('edit')
          .where('document', id)
        router
          .post('/halaman-legal/versi/:document', [ConsoleLegalController, 'update'])
          .as('update')
          .where('document', id)
        router
          .post('/halaman-legal/versi/:document/terbitkan', [ConsoleLegalController, 'publish'])
          .as('publish')
          .where('document', id)
        router
          .post('/halaman-legal/versi/:document/hapus', [ConsoleLegalController, 'destroy'])
          .as('destroy')
          .where('document', id)
      })
      .as('legal')
  })
  .domain(hosts.admin)
  .as('admin')
  .use([
    middleware.auth({ guard: 'staff' }),
    middleware.translations(['auth', 'areas', 'console', 'publishing', 'regions']),
  ])

router
  .group(() => {
    router.get('/kabar', [AppAnnouncementsController, 'index']).as('index')
    router.post('/kabar/tandai-dibaca', [AppAnnouncementsController, 'markAllRead']).as('read_all')
    router.get('/kabar/:slug', [AppAnnouncementsController, 'show']).as('show').where('slug', slug)
  })
  .domain(hosts.app)
  .as('app.announcements')
  .use([
    middleware.translations(['auth', 'publishing']),
    middleware.auth({ guard: 'web' }),
    middleware.school({ optional: true }),
  ])

router
  .group(() => {
    router.get('/kabar', [PublicController, 'announcements']).as('announcements')
    router
      .get('/kabar/:slug', [PublicController, 'announcement'])
      .as('announcement')
      .where('slug', slug)
    router.get('/acara', [PublicController, 'events']).as('events')
    router.get('/acara/:slug', [PublicController, 'event']).as('event').where('slug', slug)
    router.get('/cerita-sekolah', [PublicController, 'stories']).as('stories')
    router.get('/cerita-sekolah/:slug', [PublicController, 'story']).as('story').where('slug', slug)
    router.get('/syarat-penggunaan', [PublicController, 'terms']).as('terms')
    router.get('/kebijakan-privasi', [PublicController, 'privacy']).as('privacy')
    router.get('/perlindungan-data-murid', [PublicController, 'studentData']).as('student_data')
  })
  .domain(publicHost)
  .as('public')
