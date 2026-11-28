/*
|--------------------------------------------------------------------------
| Regions and the school directory (R1-04)
|--------------------------------------------------------------------------
|
| admin. only: Direktori Sekolah (NPSN lookup for the school form) and
| Perubahan wilayah (region changes from a directory import, D-466).
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { hosts } from '#config/hosts'

const SchoolDirectoryController = () => import('#regions/controllers/school_directory_controller')
const RegionChangesController = () => import('#regions/controllers/region_changes_controller')

router
  .group(() => {
    router
      .get('/direktori-sekolah', [SchoolDirectoryController, 'index'])
      .as('school_directory.index')
    router
      .get('/direktori-sekolah/:npsn', [SchoolDirectoryController, 'show'])
      .as('school_directory.show')
      .where('npsn', /^\d{8}$/)

    router.get('/perubahan-wilayah', [RegionChangesController, 'index']).as('region_changes.index')
    router
      .post('/perubahan-wilayah/:review/terima', [RegionChangesController, 'accept'])
      .as('region_changes.accept')
      .where('review', router.matchers.uuid())
    router
      .post('/perubahan-wilayah/:review/tolak', [RegionChangesController, 'reject'])
      .as('region_changes.reject')
      .where('review', router.matchers.uuid())
  })
  .domain(hosts.admin)
  .as('admin')
  .use([middleware.auth({ guard: 'staff' }), middleware.translations(['regions'])])
