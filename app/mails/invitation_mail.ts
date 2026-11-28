import i18nManager from '@adonisjs/i18n/services/main'
import type { DateTime } from 'luxon'
import { formatDateTime } from '#services/i18n/format'
import { ActionMail } from '#mails/action_mail'
import type { MembershipRole } from '#models/school_membership'

export type InvitationMailData = {
  email: string
  schoolName: string
  role: MembershipRole
  /** The operator's name, or null for an invitation from Tim SIGRAK. */
  inviterName: string | null
  url: string
  expiresAt: DateTime
}

/**
 * "Undangan bergabung": the link into a school (D-182).
 */
export default class InvitationMail extends ActionMail {
  constructor(data: InvitationMailData) {
    const t = i18nManager.locale('id').t.bind(i18nManager.locale('id'))
    const values = {
      school: data.schoolName,
      role: t(`accounts.roles.${data.role}`).toLowerCase(),
      inviter: data.inviterName ?? t('accounts.mail.invitation.staff_inviter'),
      expires_at: formatDateTime(data.expiresAt.toJSDate()),
    }
    super(data.email, {
      subject: t('accounts.mail.invitation.subject', values),
      heading: t('accounts.mail.invitation.heading', values),
      paragraphs: [
        t('accounts.mail.invitation.body', values),
        t('accounts.mail.invitation.how', values),
      ],
      action: { label: t('accounts.mail.invitation.action'), url: data.url },
      footnotes: [
        t('accounts.mail.invitation.expires', values),
        t('accounts.mail.invitation.ignore'),
      ],
    })
  }
}
