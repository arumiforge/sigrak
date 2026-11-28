import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { MailResponse } from '@adonisjs/mail'
import type { MailTransportContract, NodeMailerMessage } from '@adonisjs/mail/types'
import StaffActivityLog from '#models/staff_activity_log'
import InvitationMail from '#mails/invitation_mail'
import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'
import { SEND_MAIL_JOB, sendMail, type SendMailJobData } from '#jobs/send_mail'
import { mailerFor, mailSeams, mailSource } from '#integrations/mail'
import { decryptPayload, readIntegration } from '#integrations/store'
import { createStaff } from '#tests/helpers'
import { fakeMail, inertiaPage, postForm, signIn, type Session } from '#tests/accounts'
import type { ApiClient } from '@japa/api-client'
import { queue } from '#services/queue/queues'

/**
 * Pengaturan → Integrasi (R2-03, D-431, F-005): values encrypted with
 * the app key and never sent back in full, env before console for
 * mail, owner-only changes, and a log row for every change.
 */

const PAGE = '/pengaturan/integrasi'
const PASSWORD_VALUE = 'app-pass-uji-9f3c'

const mailForm = (overrides: Record<string, string | number> = {}) => ({
  host: 'smtp.uji.test',
  port: 587,
  security: 'starttls',
  username: 'pengirim@uji.test',
  password: PASSWORD_VALUE,
  from_address: 'Kabar@Uji.test',
  from_name: 'SIGRAK Uji',
  ...overrides,
})

/** A transport that keeps every message instead of sending it. */
function captureTransport() {
  const sent: NodeMailerMessage[] = []
  const transport: MailTransportContract = {
    async send(message) {
      sent.push(message)
      return new MailResponse('uji-1', { from: '', to: [] }, {})
    },
  }
  return { sent, transport }
}

async function ownerSession(client: ApiClient) {
  const owner = await createStaff(['owner'])
  return { owner, session: await signIn(client, 'admin', owner.email) }
}

function post(client: ApiClient, session: Session, path: string, data = {}) {
  return postForm(client, session, path, data, '/')
}

async function rowCount(table: string) {
  const [row] = await db.from(table).count('* as c')
  return Number(row.c)
}

async function mailerName(name?: string) {
  const mailer = await mailerFor(name)
  return mailer.name
}

async function actionsOf(subjectId: string) {
  const logs = await StaffActivityLog.query().where('subject_id', subjectId).orderBy('id')
  return logs.map((log) => log.action)
}

async function logsOf(action: string) {
  return StaffActivityLog.query().where('action', action).orderBy('id', 'asc')
}

test.group('Integrations | settings', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => () => mailSeams.restore())

  test('mail values are stored encrypted and the page shows only the last four characters', async ({
    client,
    assert,
  }) => {
    const { session } = await ownerSession(client)
    const { response } = await post(client, session, `${PAGE}/email`, mailForm())
    assert.equal(response.header('location'), PAGE)

    const row = await db.from('integration_settings').where('key', 'mail').firstOrFail()
    assert.notInclude(row.payload, PASSWORD_VALUE)
    assert.notInclude(row.payload, 'smtp.uji.test')
    const value = decryptPayload('mail', row.payload)
    assert.equal(value.password, PASSWORD_VALUE)
    assert.equal(value.fromAddress, 'kabar@uji.test')
    // Bound to its key: the same payload does not open as another integration.
    assert.throws(() => decryptPayload('storage', row.payload))

    const page = await inertiaPage(client, session, PAGE)
    page.assertStatus(200)
    const props = page.inertiaProps
    assert.deepEqual(props.mail.password, { set: true, last4: '9f3c' })
    assert.equal(props.mail.values.host, 'smtp.uji.test')
    assert.notInclude(JSON.stringify(props), PASSWORD_VALUE)
  })

  test('an empty secret keeps the saved one; each change is logged without secrets', async ({
    client,
    assert,
  }) => {
    const { owner, session } = await ownerSession(client)
    await post(client, session, `${PAGE}/email`, mailForm())
    await post(client, session, `${PAGE}/email`, mailForm({ password: '', port: 2525 }))
    await post(client, session, `${PAGE}/email`, mailForm({ password: '', port: 2525 }))

    const saved = await readIntegration('mail')
    assert.equal(saved!.value.password, PASSWORD_VALUE)
    assert.equal(saved!.value.port, 2525)

    const logs = await logsOf('integration.updated')
    assert.lengthOf(logs, 2, 'an unchanged save is not logged')
    assert.equal(logs[0].staffUserId, owner.id)
    assert.equal(logs[0].subjectType, 'integration')
    assert.equal(logs[0].subjectId, 'mail')
    assert.equal(logs[0].changes.password, 'changed')
    assert.deepEqual(logs[0].changes.host, { from: null, to: 'smtp.uji.test' })
    assert.deepEqual(logs[1].changes, { port: { from: 587, to: 2525 } })
    for (const log of logs) assert.notInclude(JSON.stringify(log.changes), PASSWORD_VALUE)
  })

  test('only the owner changes integrations; admin and engineer only read', async ({
    client,
    assert,
  }) => {
    for (const role of ['admin', 'engineer'] as const) {
      const staff = await createStaff([role])
      const session = await signIn(client, 'admin', staff.email)
      const page = await inertiaPage(client, session, PAGE)
      page.assertStatus(200)
      assert.isFalse(page.inertiaProps.can.manage)

      for (const [path, data] of [
        [`${PAGE}/email`, mailForm()],
        [`${PAGE}/email/uji`, {}],
        [`${PAGE}/chatbot`, { base_url: 'https://api.uji.test/v1', model: 'gpt-uji' }],
        [`${PAGE}/chatbot/kunci`, { label: 'Utama', secret: 'sk-uji-123456' }],
        [`${PAGE}/kunci-ai`, { gemini_key: 'gemini-uji-123456' }],
        [`${PAGE}/mail/kosongkan`, {}],
      ] as const) {
        const { response } = await post(client, session, path, data)
        assert.equal(response.status(), 403, `${role} ${path}`)
      }
    }
    assert.equal(await rowCount('integration_settings'), 0)

    const support = await createStaff(['support'])
    const supportSession = await signIn(client, 'admin', support.email)
    const page = await inertiaPage(client, supportSession, PAGE)
    page.assertStatus(403)
  })

  test('env wins for mail when MAIL_MAILER is set; otherwise complete console values', async ({
    client,
    assert,
  }) => {
    const { session } = await ownerSession(client)
    const { sent, transport } = captureTransport()
    mailSeams.transport(() => transport)

    mailSeams.envMailer(undefined)
    assert.equal(await mailSource(), 'none')
    assert.equal(await mailerName(), 'json')

    await post(client, session, `${PAGE}/email`, mailForm())
    assert.equal(await mailSource(), 'console')
    assert.equal(await mailerName(), 'console')
    assert.equal(await mailerName('json'), 'console', 'the default mailer maps to console')

    mailSeams.envMailer('json')
    assert.equal(await mailSource(), 'env')
    assert.equal(await mailerName(), 'json')
    const page = await inertiaPage(client, session, PAGE)
    assert.equal(page.inertiaProps.mail.source, 'env')
    assert.equal(page.inertiaProps.mail.envMailer, 'json')

    // worker-default sends a queued mail with the console values.
    mailSeams.envMailer(undefined)
    await queue('default').obliterate({ force: true })
    await mail.sendLater(
      new InvitationMail({
        email: 'guru@uji.test',
        schoolName: 'SD Integrasi',
        role: 'teacher',
        inviterName: 'Pak Operator',
        url: 'http://app.sigrak.test/undangan/abc',
        expiresAt: DateTime.now().plus({ days: 7 }),
      })
    )
    const [job] = await queue('default').getJobs(['waiting'])
    assert.equal(job.name, SEND_MAIL_JOB)
    await sendMail.handle({ data: job.data as SendMailJobData } as never)
    await queue('default').obliterate({ force: true })

    assert.lengthOf(sent, 1)
    assert.deepEqual(sent[0].from, { address: 'kabar@uji.test', name: 'SIGRAK Uji' })
    assert.deepEqual(sent[0].to, ['guru@uji.test'])
  })

  test('"Kirim email uji" sends to the staff member with the settings in use', async ({
    client,
    assert,
  }) => {
    const { owner, session } = await ownerSession(client)
    const { sent, transport } = captureTransport()
    mailSeams.transport(() => transport)
    mailSeams.envMailer(undefined)
    await post(client, session, `${PAGE}/email`, mailForm())

    const { response, session: next } = await post(client, session, `${PAGE}/email/uji`)
    assert.equal(response.header('location'), PAGE)
    assert.lengthOf(sent, 1)
    assert.deepEqual(sent[0].to, [owner.email])
    assert.equal(sent[0].subject, 'Email uji dari konsol SIGRAK')
    const page = await inertiaPage(client, next, PAGE)
    assert.include(page.body().flash?.success ?? '', owner.email)

    const failing: MailTransportContract = {
      async send() {
        throw new Error('Invalid login: 535 Username and Password not accepted')
      },
    }
    mailSeams.transport(() => failing)
    await post(client, session, `${PAGE}/email/uji`)
    const logs = await logsOf('integration.mail_tested')
    assert.deepEqual(
      logs.map((log) => log.changes),
      [
        { source: 'console', ok: true },
        { source: 'console', ok: false },
      ]
    )
  })

  test('the fake mailer of the tests still catches the test mail', async ({ client, assert }) => {
    const { fake, restore } = fakeMail()
    try {
      const { owner, session } = await ownerSession(client)
      await post(client, session, `${PAGE}/email/uji`)
      const mails = fake.mails.sent()
      assert.lengthOf(mails, 1)
      assert.isTrue(mails[0].message.hasTo(owner.email))
    } finally {
      restore()
    }
  })

  test('chatbot keys: added, refused twice, removed; the page sees only last four', async ({
    client,
    assert,
  }) => {
    const { session } = await ownerSession(client)
    await post(client, session, `${PAGE}/chatbot`, {
      base_url: 'https://api.uji.test/v1',
      model: 'gpt-uji-mini',
    })
    await post(client, session, `${PAGE}/chatbot/kunci`, {
      label: 'Utama',
      secret: 'sk-uji-aaaa1111',
    })
    await post(client, session, `${PAGE}/chatbot/kunci`, {
      label: 'Kedua',
      secret: 'sk-uji-bbbb2222',
    })
    await post(client, session, `${PAGE}/chatbot/kunci`, {
      label: 'Lagi',
      secret: 'sk-uji-aaaa1111',
    })

    let page = await inertiaPage(client, session, PAGE)
    const { chatbot } = page.inertiaProps
    assert.equal(chatbot.baseUrl, 'https://api.uji.test/v1')
    assert.deepEqual(
      chatbot.keys.map((key: { label: string; last4: string }) => [key.label, key.last4]),
      [
        ['Utama', '1111'],
        ['Kedua', '2222'],
      ]
    )
    assert.notInclude(JSON.stringify(page.inertiaProps), 'sk-uji-aaaa1111')

    await post(client, session, `${PAGE}/chatbot/kunci/${chatbot.keys[0].id}/hapus`)
    page = await inertiaPage(client, session, PAGE)
    assert.deepEqual(
      page.inertiaProps.chatbot.keys.map((key: { label: string }) => key.label),
      ['Kedua']
    )
    assert.deepEqual(await actionsOf('chatbot'), [
      'integration.updated',
      'integration.key_added',
      'integration.key_added',
      'integration.key_removed',
    ])
  })

  test('storage and the team key keep their secrets; clearing removes and logs', async ({
    client,
    assert,
  }) => {
    const { session } = await ownerSession(client)
    const storage = {
      endpoint: 'https://akun-uji.r2.cloudflarestorage.com',
      region: 'auto',
      bucket: 'sigrak-uji',
      access_key_id: 'AKIAUJI0001',
      secret_access_key: 'rahasia-uji-0002',
    }
    await post(client, session, `${PAGE}/penyimpanan`, storage)
    await post(client, session, `${PAGE}/penyimpanan`, {
      ...storage,
      bucket: 'sigrak-uji-2',
      access_key_id: '',
      secret_access_key: '',
    })
    const saved = await readIntegration('storage')
    assert.equal(saved!.value.bucket, 'sigrak-uji-2')
    assert.equal(saved!.value.secretAccessKey, 'rahasia-uji-0002')

    await post(client, session, `${PAGE}/kunci-ai`, { gemini_key: 'gemini-uji-key-7777' })
    let page = await inertiaPage(client, session, PAGE)
    assert.deepEqual(page.inertiaProps.storage.secretAccessKey, { set: true, last4: '0002' })
    assert.deepEqual(page.inertiaProps.teamKey, { set: true, last4: '7777' })

    await post(client, session, `${PAGE}/storage/kosongkan`)
    assert.isNull(await readIntegration('storage'))
    page = await inertiaPage(client, session, PAGE)
    assert.isFalse(page.inertiaProps.storage.saved)
    assert.lengthOf(await logsOf('integration.cleared'), 1)

    const { response } = await post(client, session, `${PAGE}/nothing/kosongkan`)
    assert.equal(response.status(), 404)
  })

  test('invalid values are refused with field errors', async ({ client, assert }) => {
    const { session } = await ownerSession(client)
    const { response } = await post(
      client,
      session,
      `${PAGE}/email`,
      mailForm({ host: 'smtp uji', port: 70000, from_address: 'bukan-email' })
    )
    assert.equal(response.status(), 302)
    assert.isNull(await readIntegration('mail'))
    const bad = await post(client, session, `${PAGE}/chatbot`, {
      base_url: 'http://tanpa-https.test',
      model: 'gpt',
    })
    assert.equal(bad.response.status(), 302)
    assert.isNull(await readIntegration('chatbot'))
  })
})
