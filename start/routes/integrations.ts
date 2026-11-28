/*
|--------------------------------------------------------------------------
| Routes: integration settings and AI models on admin. (R2-03)
|--------------------------------------------------------------------------
|
| Pengaturan → Integrasi (mail, chatbot provider, storage, Tim SIGRAK's
| AI test key; D-431) and Pengaturan → Model AI (model and fallbacks per
| purpose; D-315). Each action checks its ability in the controller.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { hosts } from '#config/hosts'
import { INTEGRATION_KEYS } from '#integrations/store'

const IntegrationsController = () => import('#integrations/controllers/integrations_controller')
const AiModelsController = () => import('#integrations/controllers/ai_models_controller')

const integration = { match: new RegExp(`^(${INTEGRATION_KEYS.join('|')})$`) }
const purpose = { match: /^[a-z][a-z0-9_]{0,39}$/ }

router
  .group(() => {
    router.get('/pengaturan/integrasi', [IntegrationsController, 'show']).as('integrations.show')
    router
      .post('/pengaturan/integrasi/email', [IntegrationsController, 'updateMail'])
      .as('integrations.mail')
    router
      .post('/pengaturan/integrasi/email/uji', [IntegrationsController, 'testMail'])
      .as('integrations.mail_test')
    router
      .post('/pengaturan/integrasi/chatbot', [IntegrationsController, 'updateChatbot'])
      .as('integrations.chatbot')
    router
      .post('/pengaturan/integrasi/chatbot/kunci', [IntegrationsController, 'addChatbotKey'])
      .as('integrations.chatbot_key')
    router
      .post('/pengaturan/integrasi/chatbot/kunci/:key/hapus', [
        IntegrationsController,
        'removeChatbotKey',
      ])
      .as('integrations.chatbot_key_remove')
      .where('key', router.matchers.uuid())
    router
      .post('/pengaturan/integrasi/penyimpanan', [IntegrationsController, 'updateStorage'])
      .as('integrations.storage')
    router
      .post('/pengaturan/integrasi/kunci-ai', [IntegrationsController, 'updateTeamKey'])
      .as('integrations.team_key')
    router
      .post('/pengaturan/integrasi/:integration/kosongkan', [IntegrationsController, 'clear'])
      .as('integrations.clear')
      .where('integration', integration)

    router.get('/pengaturan/model-ai', [AiModelsController, 'index']).as('ai_models.index')
    router
      .post('/pengaturan/model-ai/:purpose', [AiModelsController, 'update'])
      .as('ai_models.update')
      .where('purpose', purpose)
    router
      .post('/pengaturan/model-ai/:purpose/awal', [AiModelsController, 'reset'])
      .as('ai_models.reset')
      .where('purpose', purpose)
    router
      .post('/pengaturan/model-ai/:purpose/uji', [AiModelsController, 'test'])
      .as('ai_models.test')
      .where('purpose', purpose)
  })
  .domain(hosts.admin)
  .as('admin')
  .use([
    middleware.auth({ guard: 'staff' }),
    middleware.translations(['auth', 'areas', 'console', 'integrations', 'staff']),
  ])
