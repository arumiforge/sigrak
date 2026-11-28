/*
|--------------------------------------------------------------------------
| Mail through the queue
|--------------------------------------------------------------------------
|
| `mail.sendLater()` renders nothing in the web process: it puts the
| compiled message on the `default` queue, and `worker-default` renders
| and sends it (D-110, D-431). A slow or failing SMTP server never holds
| up a request. Tests call `mail.fake()`, which keeps queued mail in
| memory and never reaches this messenger.
|
*/

import mail from '@adonisjs/mail/services/main'
import { SEND_MAIL_JOB, type SendMailJobData } from '#jobs/send_mail'
import { dispatch } from '#services/queue/queues'

mail.setMessenger((mailer) => ({
  async queue(mailMessage, sendConfig) {
    const data: SendMailJobData = {
      mailerName: mailer.name,
      mailMessage: JSON.parse(JSON.stringify(mailMessage)),
      sendConfig: sendConfig ?? null,
    }
    return dispatch('default', SEND_MAIL_JOB, data)
  },
}))
