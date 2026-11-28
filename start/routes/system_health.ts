/*
|--------------------------------------------------------------------------
| Routes: Kesehatan sistem on admin. (R2-04, D-316)
|--------------------------------------------------------------------------
|
| One read page (system_health.view) and two actions on a failed queue
| job (system_health.manage). The controller checks the abilities.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { hosts } from '#config/hosts'
import { queueNames } from '#services/queue/wait_metrics'

const SystemHealthController = () => import('#system_health/controllers/system_health_controller')

const queueName = { match: new RegExp(`^(${queueNames.join('|')})$`) }
/** BullMQ ids: numbers, or our own ids such as `gen-<uuid>-r1-s2`. */
const jobId = { match: /^[\w:.-]{1,200}$/ }

router
  .group(() => {
    router.get('/kesehatan-sistem', [SystemHealthController, 'index']).as('system_health.index')
    router
      .post('/kesehatan-sistem/pekerjaan/:queue/:job/coba-lagi', [SystemHealthController, 'retry'])
      .as('system_health.retry')
      .where('queue', queueName)
      .where('job', jobId)
    router
      .post('/kesehatan-sistem/pekerjaan/:queue/:job/hapus', [SystemHealthController, 'remove'])
      .as('system_health.remove')
      .where('queue', queueName)
      .where('job', jobId)
  })
  .domain(hosts.admin)
  .as('admin')
  .use([middleware.auth({ guard: 'staff' }), middleware.translations(['system_health'])])
