import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'
import { JSONTransport } from '@adonisjs/mail/transports/json'
import type { InferMailers } from '@adonisjs/mail/types'

/**
 * Transactional mail only: invitations and password reset links
 * (D-110). The code names no provider (D-431): `smtp` is Gmail SMTP for
 * now (smtp.gmail.com:587, STARTTLS, an App Password), and another
 * provider is a settings change. `json` renders the message and sends
 * nothing; it is the default outside production, and tests also swap
 * in the fake mailer.
 *
 * Every mail is queued (start/mail.ts) and sent by `worker-default`.
 * Values from the console when env is empty (D-431) come with the
 * console's integration settings.
 */
const mailConfig = defineConfig({
  default: env.get('MAIL_MAILER', 'json'),

  from: {
    address: env.get('MAIL_FROM_ADDRESS', `no-reply@${env.get('APP_DOMAIN')}`),
    name: env.get('MAIL_FROM_NAME', 'SIGRAK'),
  },

  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST', 'smtp.gmail.com'),
      port: env.get('SMTP_PORT', 587),
      secure: false,
      requireTLS: true,
      auth: {
        type: 'login',
        user: env.get('SMTP_USERNAME', ''),
        pass: env.get('SMTP_PASSWORD')?.release() ?? '',
      },
    }),
    json: () => new JSONTransport(),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
