import i18nManager from '@adonisjs/i18n/services/main'
import type { DateTime } from 'luxon'
import { formatDateTime } from '#services/i18n/format'
import { ActionMail } from '#mails/action_mail'

/**
 * "Atur kata sandi baru": the one-time link from Lupa kata sandi
 * (D-183).
 */
export default class PasswordResetMail extends ActionMail {
  constructor(data: { email: string; name: string; url: string; expiresAt: DateTime }) {
    const i18n = i18nManager.locale('id')
    const values = { name: data.name, expires_at: formatDateTime(data.expiresAt.toJSDate()) }
    super(data.email, {
      subject: i18n.t('auth.mail.reset.subject'),
      heading: i18n.t('auth.mail.reset.heading', values),
      paragraphs: [i18n.t('auth.mail.reset.body')],
      action: { label: i18n.t('auth.mail.reset.action'), url: data.url },
      footnotes: [i18n.t('auth.mail.reset.expires', values), i18n.t('auth.mail.reset.ignore')],
    })
  }
}
