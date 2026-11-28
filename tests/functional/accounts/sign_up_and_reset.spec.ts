import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import User from '#models/user'
import PasswordResetToken from '#models/password_reset_token'
import PasswordResetMail from '#mails/password_reset_mail'
import { hashToken } from '#accounts/tokens'
import { PASSWORD, createSchool, createTeacher } from '#tests/helpers'
import { fakeMail, guest, inertiaPage, postForm, signIn, tokenOf } from '#tests/accounts'

const SIGN_UP = {
  name: 'Bu Guru Mandiri',
  email: 'Mandiri@Uji.test',
  password: 'rahasia123',
  password_confirmation: 'rahasia123',
}

test.group('Accounts | self sign-up (D-459)', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => fakeMail().restore)

  test('a teacher signs up alone, is signed in and starts the default trial', async ({
    client,
    assert,
  }) => {
    const visitor = await guest(client, 'app', '/daftar')
    const { response, session } = await postForm(client, visitor, '/daftar', SIGN_UP)
    assert.equal(response.header('location'), '/akun')

    const user = await User.findByOrFail('email', 'mandiri@uji.test')
    assert.equal(user.name, 'Bu Guru Mandiri')
    assert.isNotNull(user.trialStartedAt)
    assert.isNull(user.emailVerifiedAt)
    assert.isNull(user.trialDays)

    const page = await inertiaPage(client, session, '/akun')
    page.assertStatus(200)
    page.assertInertiaComponent('accounts/account')
    assert.deepEqual(page.inertiaProps.memberships, [])
    assert.isTrue(page.inertiaProps.trial.active)
    assert.equal(page.inertiaProps.trial.days, 7)
    assert.equal(page.inertiaProps.trial.daysLeft, 7)
    assert.isNull(page.inertiaProps.role)

    // A teacher without a school still reaches the app (no school rows).
    const calendar = await inertiaPage(client, session, '/kalender')
    calendar.assertStatus(200)
    assert.isNull(calendar.inertiaProps.school)
  })

  test('an email that already has an account is refused, in any letter case', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Uji')
    const teacher = await createTeacher(school)
    const visitor = await guest(client, 'app', '/daftar')

    const { session } = await postForm(client, visitor, '/daftar', {
      ...SIGN_UP,
      email: teacher.email.toUpperCase(),
    })
    const page = await inertiaPage(client, session, '/daftar')
    assert.equal(
      page.inertiaProps.errors.email,
      'Email ini sudah terdaftar. Silakan masuk, atau pakai Lupa kata sandi.'
    )
    assert.lengthOf(await User.query().whereRaw('lower(email) = ?', [teacher.email]), 1)
  })

  test('the password needs 8 characters with letters and numbers (D-183)', async ({
    client,
    assert,
  }) => {
    const visitor = await guest(client, 'app', '/daftar')
    for (const password of ['pendek1', '12345678', 'hanyahuruf']) {
      const { session } = await postForm(client, visitor, '/daftar', {
        ...SIGN_UP,
        password,
        password_confirmation: password,
      })
      const page = await inertiaPage(client, session, '/daftar')
      assert.isString(page.inertiaProps.errors.password, password)
    }
    assert.isNull(await User.findBy('email', 'mandiri@uji.test'))
  })
})

test.group('Accounts | password reset (D-183)', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => fakeMail().restore)

  test('a link is mailed through the queue; the answer is the same for unknown emails', async ({
    client,
    assert,
  }) => {
    const { fake } = fakeMail()
    const teacher = await createTeacher(await createSchool('SD Uji'))
    const visitor = await guest(client, 'app', '/lupa-kata-sandi')

    const known = await postForm(client, visitor, '/lupa-kata-sandi', { email: teacher.email })
    const unknown = await postForm(client, visitor, '/lupa-kata-sandi', {
      email: 'tidak-ada@uji.test',
    })
    assert.equal(known.response.header('location'), '/masuk')
    assert.equal(unknown.response.header('location'), '/masuk')

    const queued = fake.mails.queued()
    assert.lengthOf(queued, 1)
    assert.instanceOf(queued[0], PasswordResetMail)
    assert.equal((queued[0] as PasswordResetMail).recipient, teacher.email)
    assert.lengthOf(fake.mails.sent(), 0)

    const row = await PasswordResetToken.findByOrFail('user_id', teacher.id)
    assert.equal(row.tokenHash, hashToken(tokenOf(queued[0])))
  })

  test('the link sets a new password once and marks the email verified', async ({
    client,
    assert,
  }) => {
    const { fake } = fakeMail()
    const teacher = await createTeacher(await createSchool('SD Uji'))
    const visitor = await guest(client, 'app', '/lupa-kata-sandi')
    await postForm(client, visitor, '/lupa-kata-sandi', { email: teacher.email })
    const token = tokenOf(fake.mails.queued()[0])

    const form = await inertiaPage(client, visitor, `/kata-sandi-baru/${token}`)
    assert.isTrue(form.inertiaProps.valid)
    assert.equal(form.inertiaProps.email, teacher.email)

    const { response } = await postForm(client, visitor, `/kata-sandi-baru/${token}`, {
      password: 'baru-sekali-9',
      password_confirmation: 'baru-sekali-9',
    })
    assert.equal(response.header('location'), '/masuk')
    await signIn(client, 'app', teacher.email, 'baru-sekali-9')
    await teacher.refresh()
    assert.isNotNull(teacher.emailVerifiedAt)

    const again = await inertiaPage(client, await guest(client), `/kata-sandi-baru/${token}`)
    assert.isFalse(again.inertiaProps.valid)
    const reuse = await postForm(client, await guest(client), `/kata-sandi-baru/${token}`, {
      password: 'lagi-lagi-99',
      password_confirmation: 'lagi-lagi-99',
    })
    assert.equal(reuse.response.header('location'), '/lupa-kata-sandi')
  })

  test('an expired link, or an older link after a new request, does not work', async ({
    client,
    assert,
  }) => {
    const { fake } = fakeMail()
    const teacher = await createTeacher(await createSchool('SD Uji'))
    const visitor = await guest(client, 'app', '/lupa-kata-sandi')
    await postForm(client, visitor, '/lupa-kata-sandi', { email: teacher.email })
    await postForm(client, visitor, '/lupa-kata-sandi', { email: teacher.email })
    const [older, newer] = fake.mails.queued().map(tokenOf)

    const old = await inertiaPage(client, visitor, `/kata-sandi-baru/${older}`)
    assert.isFalse(old.inertiaProps.valid)

    await db
      .from('password_reset_tokens')
      .update({ expires_at: DateTime.now().minus({ minutes: 1 }).toSQL() })
    const expired = await postForm(client, visitor, `/kata-sandi-baru/${newer}`, {
      password: 'baru-sekali-9',
      password_confirmation: 'baru-sekali-9',
    })
    assert.equal(expired.response.header('location'), '/lupa-kata-sandi')
    await signIn(client, 'app', teacher.email, PASSWORD)
  })

  test('reset links are limited to 5 a minute per IP', async ({ client, assert }) => {
    fakeMail()
    const visitor = await guest(client, 'app', '/lupa-kata-sandi')
    let last
    for (let attempt = 0; attempt < 6; attempt++) {
      last = await postForm(client, visitor, '/lupa-kata-sandi', { email: `x${attempt}@uji.test` })
    }
    const page = await inertiaPage(client, last!.session, '/lupa-kata-sandi')
    assert.match(page.body().flash?.error ?? '', /Terlalu banyak percobaan/)
  })
})
