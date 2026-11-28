/*
|--------------------------------------------------------------------------
| Routes: academic years and classes on app. (R1-06)
|--------------------------------------------------------------------------
|
| Operator only (D-241): Tahun Ajaran (list, add with an optional class
| copy, change, delete, copy classes into an empty year) and Kelas (the
| classes of a year, the class page with its teachers per subject).
| Every request runs in the operator's school context (R1-01); a row of
| another school is a 404.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { hosts } from '#config/hosts'

const AcademicYearsController = () => import('#school_year/controllers/academic_years_controller')
const ClassesController = () => import('#school_year/controllers/classes_controller')

const uuid = router.matchers.uuid()

router
  .group(() => {
    router
      .group(() => {
        router.get('/tahun-ajaran', [AcademicYearsController, 'index']).as('index')
        router.post('/tahun-ajaran', [AcademicYearsController, 'store']).as('store')
        router
          .get('/tahun-ajaran/:academicYear/ubah', [AcademicYearsController, 'edit'])
          .as('edit')
          .where('academicYear', uuid)
        router
          .post('/tahun-ajaran/:academicYear/ubah', [AcademicYearsController, 'update'])
          .as('update')
          .where('academicYear', uuid)
        router
          .post('/tahun-ajaran/:academicYear/hapus', [AcademicYearsController, 'destroy'])
          .as('destroy')
          .where('academicYear', uuid)
        router
          .post('/tahun-ajaran/:academicYear/salin-kelas', [AcademicYearsController, 'copy'])
          .as('copy_classes')
          .where('academicYear', uuid)
      })
      .as('academic_years')

    router
      .group(() => {
        router.get('/kelas', [ClassesController, 'index']).as('index')
        router.post('/kelas', [ClassesController, 'store']).as('store')
        router.get('/kelas/:class', [ClassesController, 'show']).as('show').where('class', uuid)
        router
          .post('/kelas/:class/ubah', [ClassesController, 'update'])
          .as('update')
          .where('class', uuid)
        router
          .post('/kelas/:class/hapus', [ClassesController, 'destroy'])
          .as('destroy')
          .where('class', uuid)
        router
          .post('/kelas/:class/guru-mapel', [ClassesController, 'assign'])
          .as('assign')
          .where('class', uuid)
      })
      .as('classes')
  })
  .domain(hosts.app)
  .as('app')
  .use([
    middleware.translations(['auth']),
    middleware.auth({ guard: 'web' }),
    middleware.school(),
    middleware.translations(['classes']),
  ])
