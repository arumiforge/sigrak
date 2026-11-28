/*
|--------------------------------------------------------------------------
| Routes: curriculum console on admin. (R2-08)
|--------------------------------------------------------------------------
|
| Kurikulum (D-317): versions, one version with its sign-off and
| publication, compare, impact. Each action checks its ability
| (`curriculum.view|signoff|publish`) in the controller.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { hosts } from '#config/hosts'

const CurriculumVersionsController = () =>
  import('../../app/curriculum/controllers/curriculum_versions_controller.js')

const version = router.matchers.number()

router
  .group(() => {
    router.get('/kurikulum', [CurriculumVersionsController, 'index']).as('index')
    router
      .get('/kurikulum/:version', [CurriculumVersionsController, 'show'])
      .as('show')
      .where('version', version)
    router
      .get('/kurikulum/:version/bandingkan', [CurriculumVersionsController, 'compare'])
      .as('compare')
      .where('version', version)
    router
      .get('/kurikulum/:version/dampak', [CurriculumVersionsController, 'impact'])
      .as('impact')
      .where('version', version)
    router
      .post('/kurikulum/:version/sahkan', [CurriculumVersionsController, 'signOff'])
      .as('sign_off')
      .where('version', version)
    router
      .post('/kurikulum/:version/batalkan-pengesahan', [CurriculumVersionsController, 'withdraw'])
      .as('withdraw')
      .where('version', version)
    router
      .post('/kurikulum/:version/terbitkan', [CurriculumVersionsController, 'publish'])
      .as('publish')
      .where('version', version)
    router
      .post('/kurikulum/:version/kembalikan', [CurriculumVersionsController, 'rollback'])
      .as('rollback')
      .where('version', version)
  })
  .domain(hosts.admin)
  .as('admin.curriculum')
  .use([
    middleware.auth({ guard: 'staff' }),
    middleware.translations(['auth', 'areas', 'console', 'staff', 'curriculum']),
  ])
