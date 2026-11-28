import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import EmailConfirmationToken from '#models/email_confirmation_token'
import User from '#models/user'
import EmailConfirmationMail from '#mails/email_confirmation_mail'
import { hashToken } from '#accounts/tokens'
import { createSchool, visit } from '#tests/helpers'
import {
  fakeMail,
  guest,
  inertiaPage,
  memberUser,
  postForm,
  signIn,
  signInMember,
  tokenOf,
  type Session,
} from '#tests/accounts'

/**
 * Sign-up confirmation (D-469): a self sign-up gets a mail with a link
 * (hash stored, 3 days, works once); the app stays usable with a
 * reminder until the email is confirmed; Akun sends the link again; an
 * invitation or a reset link also confirms the email.
 */
const SIGN_UP = {
  name: 'Bu Guru Mandiri',
  email: 'mandiri@uji.test',
  password: 'rahasia123',
  password_confirmation: 'rahasia123',
}

async function signUp(client: ApiClient) {
  const visitor = await guest(client, 'app', '/daftar')
  const { session } = await postForm(client, visitor, '/daftar', SIGN_UP)
  const user = await User.findByOrFail('email', SIGN_UP.email)
  return { session, user }
}

async function confirm(client: ApiClient, session: Session, token: string) {
  return postForm(client, session, `/konfirmasi-email/${token}`, {})
}

test.group('Accounts | sign-up confirmation (D-469)', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => fakeMail().restore)

  test('sign-up queues a confirmation mail; only the token hash is stored', async ({
    client,
    assert,
  }) => {
    const { fake } = fakeMail()
    const { user } = await signUp(client)

    const queued = fake.mails.queued()
    assert.lengthOf(queued, 1)
    assert.instanceOf(queued[0], EmailConfirmationMail)
    assert.equal((queued[0] as EmailConfirmationMail).recipient, SIGN_UP.email)
    assert.lengthOf(fake.mails.sent(), 0)

    const token = tokenOf(queued[0])
    assert.include((queued[0] as EmailConfirmationMail).content.action.url, '/konfirmasi-email/')
    const row = await EmailConfirmationToken.findByOrFail('user_id', user.id)
    assert.equal(row.tokenHash, hashToken(token))
    assert.notEqual(row.tokenHash, token)
    assert.equal(row.email, SIGN_UP.email)
    const hours = row.expiresAt.diff(DateTime.now(), 'hours').hours
    assert.isAbove(hours, 71)
    assert.isAtMost(hours, 72)
  })

  test('the app stays usable with a reminder until the email is confirmed', async ({
    client,
    assert,
  }) => {
    const { fake } = fakeMail()
    const { session, user } = await signUp(client)

    for (const path of ['/akun', '/kalender', '/coba-ai']) {
      const page = await inertiaPage(client, session, path)
      page.assertStatus(200)
      assert.equal(page.inertiaProps.emailToConfirm, SIGN_UP.email, path)
    }

    const token = tokenOf(fake.mails.queued()[0])
    const form = await inertiaPage(client, session, `/konfirmasi-email/${token}`)
    form.assertInertiaComponent('auth/confirm_email')
    assert.isTrue(form.inertiaProps.valid)
    assert.equal(form.inertiaProps.email, SIGN_UP.email)
    assert.isTrue(form.inertiaProps.signedIn)
    // Opening the link alone (a mail scanner) confirms nothing.
    await user.refresh()
    assert.isNull(user.emailVerifiedAt)

    const { response } = await confirm(client, session, token)
    assert.equal(response.header('location'), '/akun')
    await user.refresh()
    assert.isNotNull(user.emailVerifiedAt)
    assert.isNull(await EmailConfirmationToken.findBy('user_id', user.id))

    const after = await inertiaPage(client, session, '/akun')
    assert.isNull(after.inertiaProps.emailToConfirm)
    assert.isTrue(after.inertiaProps.profile.emailVerified)
    assert.equal(after.body().flash?.success, 'Terima kasih, email Anda sudah dikonfirmasi.')

    // The link works once.
    const again = await inertiaPage(client, session, `/konfirmasi-email/${token}`)
    assert.isFalse(again.inertiaProps.valid)
  })

  test('the link also works without a session, then leads to Masuk', async ({ client, assert }) => {
    const { fake } = fakeMail()
    const { user } = await signUp(client)
    const token = tokenOf(fake.mails.queued()[0])

    const visitor = await guest(client)
    const page = await inertiaPage(client, visitor, `/konfirmasi-email/${token}`)
    page.assertStatus(200)
    assert.isTrue(page.inertiaProps.valid)
    assert.isFalse(page.inertiaProps.signedIn)

    const { response } = await confirm(client, visitor, token)
    assert.equal(response.header('location'), '/masuk')
    await user.refresh()
    assert.isNotNull(user.emailVerifiedAt)
  })

  test('an expired, unknown, malformed or replaced link does not confirm', async ({
    client,
    assert,
  }) => {
    const { fake } = fakeMail()
    const { session, user } = await signUp(client)
    const older = tokenOf(fake.mails.queued()[0])

    // Sending again replaces the open link.
    const resent = await postForm(client, session, '/akun/konfirmasi-email', {}, '/akun')
    assert.equal(resent.response.status(), 302)
    const queued = fake.mails.queued()
    assert.lengthOf(queued, 2)
    const newer = tokenOf(queued[1])
    assert.notEqual(newer, older)
    assert.lengthOf(await EmailConfirmationToken.query().where('user_id', user.id), 1)

    const visitor = await guest(client)
    const replaced = await inertiaPage(client, visitor, `/konfirmasi-email/${older}`)
    assert.isFalse(replaced.inertiaProps.valid)
    const refused = await confirm(client, visitor, older)
    assert.equal(refused.response.header('location'), `/konfirmasi-email/${older}`)

    const unknown = await inertiaPage(client, visitor, `/konfirmasi-email/${'A'.repeat(43)}`)
    assert.isFalse(unknown.inertiaProps.valid)
    const malformed = await visit(client, 'app', '/konfirmasi-email/pendek')
    assert.equal(malformed.status(), 404)

    await db
      .from('email_confirmation_tokens')
      .update({ expires_at: DateTime.now().minus({ minutes: 1 }).toSQL() })
    await confirm(client, visitor, newer)
    await user.refresh()
    assert.isNull(user.emailVerifiedAt)
  })

  test('Akun sends the link again, at most 3 times in 10 minutes', async ({ client, assert }) => {
    const { fake } = fakeMail()
    const { session } = await signUp(client)
    for (let attempt = 0; attempt < 4; attempt++) {
      await postForm(client, session, '/akun/konfirmasi-email', {}, '/akun')
    }
    // One mail at sign-up, three resends; the fourth is refused.
    assert.lengthOf(fake.mails.queued(), 4)
    const page = await inertiaPage(client, session, '/akun')
    assert.match(page.body().flash?.error ?? '', /Coba lagi dalam 10 menit/)
  })

  test('a confirmed account gets no new link', async ({ client, assert }) => {
    const { fake } = fakeMail()
    const school = await createSchool('SD Uji')
    const member = await memberUser(school)
    member.emailVerifiedAt = DateTime.now()
    await member.save()
    const session = await signIn(client, 'app', member.email)

    const page = await inertiaPage(client, session, '/akun')
    assert.isNull(page.inertiaProps.emailToConfirm)

    await postForm(client, session, '/akun/konfirmasi-email', {}, '/akun')
    assert.lengthOf(fake.mails.queued(), 0)
    const after = await inertiaPage(client, session, '/akun')
    assert.equal(after.body().flash?.success, 'Email Anda sudah dikonfirmasi.')
  })

  test('a reset link also confirms the email and spends the open link', async ({
    client,
    assert,
  }) => {
    const { fake } = fakeMail()
    const { user } = await signUp(client)
    const confirmToken = tokenOf(fake.mails.queued()[0])

    const visitor = await guest(client, 'app', '/lupa-kata-sandi')
    await postForm(client, visitor, '/lupa-kata-sandi', { email: SIGN_UP.email })
    const resetToken = tokenOf(fake.mails.queued()[1])
    await postForm(client, visitor, `/kata-sandi-baru/${resetToken}`, {
      password: 'baru-sekali-9',
      password_confirmation: 'baru-sekali-9',
    })

    await user.refresh()
    assert.isNotNull(user.emailVerifiedAt)
    assert.isNull(await EmailConfirmationToken.findBy('user_id', user.id))
    const page = await inertiaPage(client, visitor, `/konfirmasi-email/${confirmToken}`)
    assert.isFalse(page.inertiaProps.valid)
  })

  test('accepting an invitation also confirms the email', async ({ client, assert }) => {
    const { fake } = fakeMail()
    const { session, user } = await signUp(client)

    const school = await createSchool('SD Tujuan')
    const operator = await signInMember(client, school, 'operator')
    await postForm(client, operator, '/guru/undangan', { email: SIGN_UP.email }, '/guru')
    const invitationToken = tokenOf(fake.mails.queued().at(-1)!)

    await postForm(client, session, `/undangan/${invitationToken}`, {})
    await user.refresh()
    assert.isNotNull(user.emailVerifiedAt)
    assert.isNull(await EmailConfirmationToken.findBy('user_id', user.id))
  })
})
