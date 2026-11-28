import type { HttpContext } from '@adonisjs/core/http'
import { authorizeStaff, staffCan } from '#staff/access'
import { presentMail, saveMail, sendTestMail } from '../mail.js'
import {
  addChatbotKey,
  CHATBOT_MAX_KEYS,
  presentChatbot,
  removeChatbotKey,
  saveChatbotProvider,
} from '../chatbot.js'
import { presentStorage, saveStorage } from '../storage.js'
import { presentTeamKey, saveTeamKey } from '../ai_models.js'
import { clearIntegration, INTEGRATION_KEYS, type IntegrationKey } from '../store.js'
import {
  chatbotKeyValidator,
  chatbotProviderValidator,
  mailSettingsValidator,
  storageSettingsValidator,
  teamKeyValidator,
} from '../validators.js'

const PAGE = '/pengaturan/integrasi'

/**
 * Konsol: Pengaturan → Integrasi (R2-03, D-431, F-005). Mail SMTP, the
 * chatbot provider, storage and Tim SIGRAK's AI test key. Anyone with
 * `integrations.view` sees the values (secrets only by their last four
 * characters); only `integrations.manage` (the owner) changes them.
 * Every change is logged.
 */
export default class IntegrationsController {
  async show(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'integrations.view')
    return ctx.inertia.render('console/integrations', {
      mail: await presentMail(),
      chatbot: await presentChatbot(),
      chatbotMaxKeys: CHATBOT_MAX_KEYS,
      storage: await presentStorage(),
      teamKey: await presentTeamKey(),
      staffEmail: staff.email,
      can: { manage: staffCan(staff, 'integrations.manage') },
    })
  }

  async updateMail(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'integrations.manage')
    const input = await ctx.request.validateUsing(mailSettingsValidator)
    const changed = await saveMail(staff, {
      host: input.host,
      port: input.port,
      security: input.security,
      username: input.username,
      password: input.password,
      fromAddress: input.from_address,
      fromName: input.from_name,
    })
    return this.#back(ctx, changed ? 'integrations.saved' : 'integrations.unchanged')
  }

  async testMail(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'integrations.manage')
    const result = await sendTestMail(staff)
    if (result.ok) {
      ctx.session.flash(
        'success',
        ctx.i18n.t(
          result.source === 'none'
            ? 'integrations.mail.test_rendered'
            : 'integrations.mail.test_sent',
          { email: staff.email }
        )
      )
    } else {
      ctx.session.flash(
        'error',
        ctx.i18n.t('integrations.mail.test_not_sent', { reason: result.reason })
      )
    }
    return ctx.response.redirect().toPath(PAGE)
  }

  async updateChatbot(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'integrations.manage')
    const input = await ctx.request.validateUsing(chatbotProviderValidator)
    const changed = await saveChatbotProvider(staff, {
      baseUrl: input.base_url,
      model: input.model,
    })
    return this.#back(ctx, changed ? 'integrations.saved' : 'integrations.unchanged')
  }

  async addChatbotKey(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'integrations.manage')
    const input = await ctx.request.validateUsing(chatbotKeyValidator)
    const outcome = await addChatbotKey(staff, input)
    if (outcome !== 'added') {
      ctx.session.flash(
        'error',
        ctx.i18n.t(`integrations.chatbot.key_${outcome}`, { max: CHATBOT_MAX_KEYS })
      )
      return ctx.response.redirect().toPath(PAGE)
    }
    return this.#back(ctx, 'integrations.chatbot.key_added')
  }

  async removeChatbotKey(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'integrations.manage')
    await removeChatbotKey(staff, ctx.params.key)
    return this.#back(ctx, 'integrations.chatbot.key_removed')
  }

  async updateStorage(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'integrations.manage')
    const input = await ctx.request.validateUsing(storageSettingsValidator)
    const changed = await saveStorage(staff, {
      endpoint: input.endpoint,
      region: input.region,
      bucket: input.bucket,
      accessKeyId: input.access_key_id,
      secretAccessKey: input.secret_access_key,
    })
    return this.#back(ctx, changed ? 'integrations.saved' : 'integrations.unchanged')
  }

  async updateTeamKey(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'integrations.manage')
    const { gemini_key: geminiKey } = await ctx.request.validateUsing(teamKeyValidator)
    const changed = await saveTeamKey(staff, geminiKey)
    return this.#back(ctx, changed ? 'integrations.saved' : 'integrations.unchanged')
  }

  async clear(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'integrations.manage')
    const key = ctx.params.integration as IntegrationKey
    if (!INTEGRATION_KEYS.includes(key)) ctx.response.abort('Unknown integration', 404)
    await clearIntegration(staff, key)
    return this.#back(ctx, 'integrations.cleared')
  }

  #back(ctx: HttpContext, message: string) {
    ctx.session.flash('success', ctx.i18n.t(message))
    return ctx.response.redirect().toPath(PAGE)
  }
}
