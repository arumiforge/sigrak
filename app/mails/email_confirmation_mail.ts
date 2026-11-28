import i18nManager from '@adonisjs/i18n/services/main'
import type { DateTime } from 'luxon'
import { formatDateTime } from '#services/i18n/format'
import { ActionMail } from '#mails/action_mail'

/**
 * "Konfirmasi email": the link sent after a self sign-up, and again
 * from Akun (D-469).
 */
export default class EmailConfirmationMail extends ActionMail {
  constructor(data: { email: string; name: string; url: string; expiresAt: DateTime }) {
    const i18n = i18nManager.locale('id')
    const values = { name: data.name, expires_at: formatDateTime(data.expiresAt.toJSDate()) }
    super(data.email, {
      subject: i18n.t('auth.mail.confirm.subject'),
      heading: i18n.t('auth.mail.confirm.heading', values),
      paragraphs: [i18n.t('auth.mail.confirm.body')],
      action: { label: i18n.t('auth.mail.confirm.action'), url: data.url },
      footnotes: [i18n.t('auth.mail.confirm.expires', values), i18n.t('auth.mail.confirm.ignore')],
    })
  }
}
