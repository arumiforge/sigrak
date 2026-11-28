/*
|--------------------------------------------------------------------------
| Calendar (R1-08)
|--------------------------------------------------------------------------
|
| app. (every school role, D-380, D-466):
|   Kalender — the resolved calendar with sources, effective days, the
|   operator's own events and hides, proposals, and the impact notice /
|   shift preview ("Tandai sudah dibaca")
| admin. (staff):
|   Kalender — national holidays and region packages: the D-254 check
|   of the repository data, import, activation after sign-off
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { hosts } from '#config/hosts'

const CalendarController = () => import('#calendar/controllers/calendar_controller')
const ConsoleCalendarController = () => import('#calendar/controllers/console_calendar_controller')

const itemKey = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/

router
  .group(() => {
    // A teacher who signed up alone has no school yet (D-459).
    router
      .get('/kalender', [CalendarController, 'index'])
      .as('calendar.index')
      .use(middleware.school({ optional: true }))

    router
      .group(() => {
        router.post('/kalender/acara', [CalendarController, 'store']).as('calendar.store')
        router
          .post('/kalender/acara/:item/ubah', [CalendarController, 'update'])
          .as('calendar.update')
          .where('item', itemKey)
        router
          .post('/kalender/acara/:item/hapus', [CalendarController, 'destroy'])
          .as('calendar.destroy')
          .where('item', itemKey)
        router
          .post('/kalender/:item/tidak-dipakai', [CalendarController, 'hide'])
          .as('calendar.hide')
          .where('item', itemKey)
        router
          .post('/kalender/:item/pakai-lagi', [CalendarController, 'unhide'])
          .as('calendar.unhide')
          .where('item', itemKey)
        router.post('/kalender/usulan', [CalendarController, 'propose']).as('calendar.propose')
        router
          .post('/kalender/perubahan/dibaca', [CalendarController, 'acknowledge'])
          .as('calendar.acknowledge')
      })
      .use(middleware.school())
  })
  .domain(hosts.app)
  .as('app')
  .use([middleware.auth({ guard: 'web' }), middleware.translations(['calendar', 'layers'])])

router
  .group(() => {
    router.get('/kalender', [ConsoleCalendarController, 'index']).as('calendar_console.index')
    router
      .post('/kalender/impor', [ConsoleCalendarController, 'import'])
      .as('calendar_console.import')
    router
      .post('/kalender/paket/:package/aktifkan', [ConsoleCalendarController, 'activate'])
      .as('calendar_console.activate')
      .where('package', router.matchers.uuid())
  })
  .domain(hosts.admin)
  .as('admin')
  .use([middleware.auth({ guard: 'staff' }), middleware.translations(['calendar', 'layers'])])
