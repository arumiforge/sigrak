import i18nManager from '@adonisjs/i18n/services/main'
import { areaUrl } from '#config/hosts'
import { ActionMail } from '#mails/action_mail'

/**
 * "Ada balasan untuk permintaan bantuan Anda" (R2-06): sent only when
 * staff tick "Kirim juga lewat email" on a reply. The mail carries no
 * reply text, only a link to the request in the app.
 */
export default class HelpReplyMail extends ActionMail {
  constructor(data: { email: string; name: string; publicId: string }) {
    const i18n = i18nManager.locale('id')
    const values = { name: data.name }
    super(data.email, {
      subject: i18n.t('help.mail.subject', values),
      heading: i18n.t('help.mail.heading', values),
      paragraphs: [i18n.t('help.mail.body', values)],
      action: {
        label: i18n.t('help.mail.action'),
        url: areaUrl('app', `/bantuan-saya/${data.publicId}`),
      },
      footnotes: [i18n.t('help.mail.footnote')],
    })
  }
}
