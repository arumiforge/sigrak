/*
|--------------------------------------------------------------------------
| Routes: Bank Masalah, Bank Praktik Baik, Forum Masalah→Solusi (R2-07)
|--------------------------------------------------------------------------
|
| admin. (staff, abilities checked in the controllers and services,
| D-439): problems (list, record, page, edit, status, merge, analysis),
| good practices (list, add, edit, remove) and the forum (meetings,
| agenda, decisions, notes). "Jadikan masalah" on a help request is in
| start/routes/help.ts.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { hosts } from '#config/hosts'

const ProblemsController = () => import('#problems/controllers/problems_controller')
const GoodPracticesController = () => import('#problems/controllers/good_practices_controller')
const ForumController = () => import('#problems/controllers/forum_controller')

const id = router.matchers.number()

router
  .group(() => {
    router.get('/bank-masalah', [ProblemsController, 'index']).as('problems.index')
    router.post('/bank-masalah', [ProblemsController, 'store']).as('problems.store')
    router
      .get('/bank-masalah/:problem', [ProblemsController, 'show'])
      .as('problems.show')
      .where('problem', id)
    router
      .post('/bank-masalah/:problem/ubah', [ProblemsController, 'update'])
      .as('problems.update')
      .where('problem', id)
    router
      .post('/bank-masalah/:problem/status', [ProblemsController, 'move'])
      .as('problems.move')
      .where('problem', id)
    router
      .post('/bank-masalah/:problem/gabungkan', [ProblemsController, 'merge'])
      .as('problems.merge')
      .where('problem', id)
    router
      .post('/bank-masalah/:problem/analisis', [ProblemsController, 'analyse'])
      .as('problems.analyse')
      .where('problem', id)

    router.get('/bank-praktik-baik', [GoodPracticesController, 'index']).as('good_practices.index')
    router.post('/bank-praktik-baik', [GoodPracticesController, 'store']).as('good_practices.store')
    router
      .post('/bank-praktik-baik/:practice/ubah', [GoodPracticesController, 'update'])
      .as('good_practices.update')
      .where('practice', id)
    router
      .post('/bank-praktik-baik/:practice/hapus', [GoodPracticesController, 'destroy'])
      .as('good_practices.destroy')
      .where('practice', id)

    router.get('/forum', [ForumController, 'index']).as('forum.index')
    router.post('/forum', [ForumController, 'store']).as('forum.store')
    router.get('/forum/:meeting', [ForumController, 'show']).as('forum.show').where('meeting', id)
    router
      .post('/forum/:meeting/ubah', [ForumController, 'update'])
      .as('forum.update')
      .where('meeting', id)
    router
      .post('/forum/:meeting/agenda', [ForumController, 'addItem'])
      .as('forum.agenda_add')
      .where('meeting', id)
    router
      .post('/forum/:meeting/agenda/hapus', [ForumController, 'removeItem'])
      .as('forum.agenda_remove')
      .where('meeting', id)
    router
      .post('/forum/:meeting/agenda/pindah', [ForumController, 'moveItem'])
      .as('forum.agenda_move')
      .where('meeting', id)
    router
      .post('/forum/:meeting/keputusan', [ForumController, 'decide'])
      .as('forum.decide')
      .where('meeting', id)
    router
      .post('/forum/:meeting/selesai', [ForumController, 'held'])
      .as('forum.held')
      .where('meeting', id)
  })
  .domain(hosts.admin)
  .as('admin')
  .use([
    middleware.auth({ guard: 'staff' }),
    middleware.translations(['auth', 'areas', 'console', 'problems', 'regions']),
  ])
