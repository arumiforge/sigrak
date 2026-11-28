import i18nManager from '@adonisjs/i18n/services/main'
import type { DateTime } from 'luxon'
import { formatDateTime } from '#services/i18n/format'
import { ActionMail } from '#mails/action_mail'

/**
 * "Buat kata sandi konsol": the one-time link of a new Tim SIGRAK
 * account, also sent again by an admin (R2-01).
 */
export default class StaffInvitationMail extends ActionMail {
  constructor(data: { email: string; name: string; url: string; expiresAt: DateTime }) {
    const i18n = i18nManager.locale('id')
    const values = { name: data.name, expires_at: formatDateTime(data.expiresAt.toJSDate()) }
    super(data.email, {
      subject: i18n.t('staff.mail.subject'),
      heading: i18n.t('staff.mail.heading', values),
      paragraphs: [i18n.t('staff.mail.body')],
      action: { label: i18n.t('staff.mail.action'), url: data.url },
      footnotes: [i18n.t('staff.mail.expires', values), i18n.t('staff.mail.ignore')],
    })
  }
}
