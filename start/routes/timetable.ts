/*
|--------------------------------------------------------------------------
| Routes: timetable on app. (R1-09)
|--------------------------------------------------------------------------
|
| Operator: Jadwal overview, the Jadwal of each class (rows, lock), and
| Susun Jadwal (day frame and switches, drafts, comparison, Acak ulang,
| save; D-247…D-251, D-262, D-381). Teacher: Kelas Saya > Jadwal.
| Every request runs in the school context (R1-01); another school's
| class, row or draft is a 404.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { hosts } from '#config/hosts'

const TimetableController = () => import('#timetable/controllers/timetable_controller')
const ClassTimetableController = () => import('#timetable/controllers/class_timetable_controller')
const MyTimetableController = () => import('#timetable/controllers/my_timetable_controller')

const uuid = router.matchers.uuid()

router
  .group(() => {
    router
      .group(() => {
        router.get('/jadwal', [TimetableController, 'index']).as('index')
        router.get('/jadwal/susun-draf', [TimetableController, 'compose']).as('compose')
        router
          .post('/jadwal/susun-draf/pengaturan', [TimetableController, 'updateSettings'])
          .as('settings')
        router.post('/jadwal/susun-draf', [TimetableController, 'store']).as('drafts.store')
        router
          .get('/jadwal/draf/:draft', [TimetableController, 'show'])
          .as('drafts.show')
          .where('draft', uuid)
        router
          .post('/jadwal/draf/:draft/acak-ulang', [TimetableController, 'reshuffle'])
          .as('drafts.reshuffle')
          .where('draft', uuid)
        router
          .post('/jadwal/draf/:draft/simpan', [TimetableController, 'save'])
          .as('drafts.save')
          .where('draft', uuid)

        router
          .get('/kelas/:class/jadwal', [ClassTimetableController, 'show'])
          .as('class.show')
          .where('class', uuid)
        router
          .post('/kelas/:class/jadwal', [ClassTimetableController, 'store'])
          .as('class.store')
          .where('class', uuid)
        router
          .post('/kelas/:class/jadwal/:slot/ubah', [ClassTimetableController, 'update'])
          .as('class.update')
          .where('class', uuid)
          .where('slot', uuid)
        router
          .post('/kelas/:class/jadwal/:slot/hapus', [ClassTimetableController, 'destroy'])
          .as('class.destroy')
          .where('class', uuid)
          .where('slot', uuid)
        router
          .post('/kelas/:class/jadwal/:slot/kunci', [ClassTimetableController, 'lock'])
          .as('class.lock')
          .where('class', uuid)
          .where('slot', uuid)

        router.get('/kelas-saya/jadwal', [MyTimetableController, 'show']).as('mine')
      })
      .as('timetable')
  })
  .domain(hosts.app)
  .as('app')
  .use([
    middleware.translations(['auth']),
    middleware.auth({ guard: 'web' }),
    middleware.school(),
    middleware.translations(['timetable']),
  ])
