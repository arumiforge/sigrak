/*
|--------------------------------------------------------------------------
| Layer model (R1-07)
|--------------------------------------------------------------------------
|
| app. (school users, inside the school context):
|   Ekstrakurikuler — the proof domain's resolved list (D-456, D-466)
|   Paket daerah    — official packages and local agreements to follow
|   Usulan          — school proposals (D-380)
| admin. (staff):
|   Usulan wilayah  — area proposals with evidence
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { hosts } from '#config/hosts'

const SchoolListController = () => import('#layers/controllers/school_list_controller')
const SchoolPackagesController = () => import('#layers/controllers/school_packages_controller')
const SchoolProposalsController = () => import('#layers/controllers/school_proposals_controller')
const AreaProposalsController = () => import('#layers/controllers/area_proposals_controller')

const itemKey = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/

router
  .group(() => {
    router.get('/ekstrakurikuler', [SchoolListController, 'index']).as('extracurriculars.index')
    router.post('/ekstrakurikuler', [SchoolListController, 'store']).as('extracurriculars.store')
    router
      .post('/ekstrakurikuler/usulan', [SchoolListController, 'propose'])
      .as('extracurriculars.propose')
    router
      .post('/ekstrakurikuler/:item/sembunyikan', [SchoolListController, 'hide'])
      .as('extracurriculars.hide')
      .where('item', itemKey)
    router
      .post('/ekstrakurikuler/:item/pakai-lagi', [SchoolListController, 'unhide'])
      .as('extracurriculars.unhide')
      .where('item', itemKey)
    router
      .post('/ekstrakurikuler/:item/hapus', [SchoolListController, 'retire'])
      .as('extracurriculars.retire')
      .where('item', itemKey)

    router.get('/paket-daerah', [SchoolPackagesController, 'index']).as('layer_packages.index')
    router
      .post('/paket-daerah/:package/ikuti', [SchoolPackagesController, 'follow'])
      .as('layer_packages.follow')
      .where('package', router.matchers.uuid())
    router
      .post('/paket-daerah/:package/berhenti', [SchoolPackagesController, 'unfollow'])
      .as('layer_packages.unfollow')
      .where('package', router.matchers.uuid())
    router
      .post('/pemberitahuan/:notice/dibaca', [SchoolPackagesController, 'markRead'])
      .as('layer_notices.read')
      .where('notice', router.matchers.uuid())

    router.get('/usulan', [SchoolProposalsController, 'index']).as('layer_proposals.index')
    router
      .post('/usulan/:proposal/setujui', [SchoolProposalsController, 'approve'])
      .as('layer_proposals.approve')
      .where('proposal', router.matchers.uuid())
    router
      .post('/usulan/:proposal/tolak', [SchoolProposalsController, 'reject'])
      .as('layer_proposals.reject')
      .where('proposal', router.matchers.uuid())
    router
      .post('/usulan/:proposal/tarik', [SchoolProposalsController, 'withdraw'])
      .as('layer_proposals.withdraw')
      .where('proposal', router.matchers.uuid())
  })
  .domain(hosts.app)
  .as('app')
  .use([
    middleware.auth({ guard: 'web' }),
    middleware.school(),
    middleware.translations(['layers']),
  ])

router
  .group(() => {
    router.get('/usulan-wilayah', [AreaProposalsController, 'index']).as('area_proposals.index')
    router.post('/usulan-wilayah', [AreaProposalsController, 'store']).as('area_proposals.store')
    for (const [path, action] of [
      ['setujui', 'approve'],
      ['kembalikan', 'return'],
      ['tolak', 'reject'],
      ['kirim-ulang', 'resubmit'],
      ['tarik', 'withdraw'],
    ] as const) {
      router
        .post(`/usulan-wilayah/:proposal/${path}`, [AreaProposalsController, action])
        .as(`area_proposals.${action}`)
        .where('proposal', router.matchers.uuid())
    }
  })
  .domain(hosts.admin)
  .as('admin')
  .use([middleware.auth({ guard: 'staff' }), middleware.translations(['layers'])])
