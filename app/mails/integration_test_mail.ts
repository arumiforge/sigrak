import i18nManager from '@adonisjs/i18n/services/main'
import { areaUrl } from '#config/hosts'
import { ActionMail } from '#mails/action_mail'

/**
 * "Email uji" from the console's integration settings (D-431): shows
 * the mail settings work. Sent to the staff member who pressed the
 * button, never to a typed address.
 */
export default class IntegrationTestMail extends ActionMail {
  constructor(data: { email: string; name: string; source: string }) {
    const i18n = i18nManager.locale('id')
    super(data.email, {
      subject: i18n.t('integrations.mail.test_mail.subject'),
      heading: i18n.t('integrations.mail.test_mail.heading', { name: data.name }),
      paragraphs: [
        i18n.t('integrations.mail.test_mail.body', {
          source: i18n.t(`integrations.mail.sources.${data.source}`),
        }),
      ],
      action: {
        label: i18n.t('integrations.mail.test_mail.action'),
        url: areaUrl('admin', '/pengaturan/integrasi'),
      },
      footnotes: [i18n.t('integrations.mail.test_mail.ignore')],
    })
  }
}
