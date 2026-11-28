import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import emitter from '@adonisjs/core/services/emitter'
import { DateTime } from 'luxon'
import type { MailEvents } from '@adonisjs/mail/types'
import InvitationMail from '#mails/invitation_mail'
import { SEND_MAIL_JOB, type SendMailJobData } from '#jobs/send_mail'
import { queue } from '#services/queue/queues'
import { startWorker, type WorkerHandle } from '#services/queue/worker'
import { eventually } from '#tests/helpers'

/**
 * Mail goes through the `default` queue (D-110, D-431): the web process
 * only queues; worker-default renders and sends. The json mailer renders
 * the message and sends nothing, so no real mail leaves the test.
 */
test.group('Accounts | mail through the queue', (group) => {
  let worker: WorkerHandle | undefined

  group.each.setup(async () => {
    await queue('default').obliterate({ force: true })
    return async () => {
      await worker?.close(0)
      worker = undefined
      await queue('default').obliterate({ force: true })
    }
  })

  function invitationMail() {
    return new InvitationMail({
      email: 'guru@uji.test',
      schoolName: 'SD Antrean',
      role: 'teacher',
      inviterName: 'Pak Operator',
      url: 'http://app.sigrak.test/undangan/abc',
      expiresAt: DateTime.fromISO('2026-12-05T10:00:00+07:00'),
    })
  }

  test('sendLater puts the compiled mail on the default queue', async ({ assert }) => {
    await mail.sendLater(invitationMail())

    const [job] = await queue('default').getJobs(['waiting'])
    assert.equal(job.name, SEND_MAIL_JOB)
    const data = job.data as SendMailJobData
    assert.equal(data.mailerName, 'json')
    assert.equal(data.mailMessage.message.subject, 'Undangan bergabung ke SD Antrean di SIGRAK')
    assert.deepEqual(data.mailMessage.message.to, ['guru@uji.test'])
    assert.equal(data.mailMessage.views.html?.template, 'emails/action_html')
  })

  test('worker-default renders and sends the queued mail', async ({ assert, cleanup }) => {
    const sent: { html: string; text: string }[] = []
    const listener = (event: MailEvents['mail:sent']) => {
      sent.push({ html: String(event.message.html), text: String(event.message.text) })
    }
    emitter.on('mail:sent', listener)
    cleanup(() => emitter.off('mail:sent', listener))

    worker = await startWorker('default')
    await mail.sendLater(invitationMail())
    const [job] = await queue('default').getJobs(['waiting', 'active', 'completed'])

    await eventually(async () => {
      const state = await job.getState()
      if (state === 'failed') throw new Error('send-mail failed')
      return state === 'completed'
    })
    assert.lengthOf(sent, 1)
    assert.include(sent[0].html, 'Pak Operator mengundang Anda')
    assert.include(sent[0].html, 'http://app.sigrak.test/undangan/abc')
    assert.include(sent[0].html, '05/12/2026 10.00 WIB')
    assert.include(sent[0].text, 'Terima undangan: http://app.sigrak.test/undangan/abc')
  })
})
