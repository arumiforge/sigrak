import type { Job } from 'bullmq'
import mail from '@adonisjs/mail/services/main'
import type { MailersList, MessageBodyTemplates, NodeMailerMessage } from '@adonisjs/mail/types'

export const SEND_MAIL_JOB = 'send-mail'

/**
 * A compiled message as `mail.sendLater()` hands it to the messenger:
 * plain JSON (addresses, subject, the view names and their data), no
 * rendered body. The worker renders the views.
 */
export type SendMailJobData = {
  mailerName: string
  mailMessage: { message: NodeMailerMessage; views: MessageBodyTemplates }
  sendConfig: unknown
  [key: string]: unknown
}

/**
 * `default` queue job: sends one queued mail with the mailer it was
 * queued on. Fails the job when the transport refuses it, so the
 * failure is logged with the job (no queue-level retries, config/queue.ts).
 */
export const sendMail = {
  jobName: SEND_MAIL_JOB,
  async handle(job: Job) {
    const { mailerName, mailMessage, sendConfig } = job.data as SendMailJobData
    const response = await mail
      .use(mailerName as keyof MailersList)
      .sendCompiled(mailMessage, sendConfig ?? undefined)
    return { messageId: response.messageId }
  },
}
