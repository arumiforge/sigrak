import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Invitation from '#models/invitation'
import SchoolMembership from '#models/school_membership'
import User from '#models/user'
import InvitationMail from '#mails/invitation_mail'
import { hashToken } from '#accounts/tokens'
import { PASSWORD, createAiKeys, createSchool, visit } from '#tests/helpers'
import { assertRlsHides, assertSchoolCannotRead, createMember } from '#tests/tenancy'
import {
  allInvitations,
  signInMember,
  cookieOf,
  createStaffWithRole,
  fakeMail,
  guest,
  inertiaPage,
  postForm,
  signIn,
  tokenOf,
  type Session,
} from '#tests/accounts'

/**
 * Invitations (D-182): only the operator invites, only teachers; the
 * token is mailed, only its hash stored; links last 7 days; re-inviting
 * renews the open row; accepting makes or joins an account.
 */
async function operatorOf(school: Awaited<ReturnType<typeof createSchool>>) {
  return createMember(school, 'operator')
}

async function invite(client: Parameters<typeof signIn>[0], operator: Session, email: string) {
  return postForm(client, operator, '/guru/undangan', { email }, '/guru')
}

test.group('Accounts | operator invites teachers', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => fakeMail().restore)

  test('the operator invites by email; only the token hash is stored', async ({
    client,
    assert,
  }) => {
    const { fake, restore } = fakeMail()
    const school = await createSchool('SD Undangan')
    const { user } = await operatorOf(school)
    const operator = await signIn(client, 'app', user.email)

    const { response } = await invite(client, operator, 'Guru.Baru@Uji.test')
    assert.equal(response.header('location'), '/guru')

    const queued = fake.mails.queued((mail) => mail instanceof InvitationMail)
    assert.lengthOf(queued, 1)
    const mail = queued[0] as InvitationMail
    assert.equal(mail.recipient, 'guru.baru@uji.test')
    assert.include(mail.content.subject, 'SD Undangan')
    assert.match(mail.content.action.url, /^http:\/\/app\.sigrak\.test\/undangan\/[\w-]{43}$/)

    const rows = await allInvitations()
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].email, 'guru.baru@uji.test')
    assert.equal(rows[0].role, 'teacher')
    assert.equal(rows[0].invitedBy, user.id)
    assert.equal(rows[0].tokenHash, hashToken(tokenOf(mail)))
    assert.notInclude(JSON.stringify(rows[0].$attributes), tokenOf(mail))
    assert.closeTo(rows[0].expiresAt.diff(DateTime.now(), 'days').days, 7, 0.01)

    const page = await inertiaPage(client, operator, '/guru')
    assert.equal(page.inertiaProps.invitations[0].email, 'guru.baru@uji.test')
    assert.notProperty(page.inertiaProps.invitations[0], 'id')
    restore()
  })

  test('inviting the same email again renews the open row with a new token', async ({
    client,
    assert,
  }) => {
    const { fake } = fakeMail()
    const school = await createSchool('SD Undangan')
    const operator = await signInMember(client, school, 'operator')

    await invite(client, operator, 'guru@uji.test')
    await invite(client, operator, 'guru@uji.test')

    const rows = await allInvitations()
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].sendCount, 2)
    const [first, second] = fake.mails.queued()
    assert.notEqual(tokenOf(first), tokenOf(second))
    assert.equal(rows[0].tokenHash, hashToken(tokenOf(second)))
  })

  test('send again and cancel; a cancelled link stops working', async ({ client, assert }) => {
    const { fake } = fakeMail()
    const school = await createSchool('SD Undangan')
    const operator = await signInMember(client, school, 'operator')
    await invite(client, operator, 'guru@uji.test')
    const [invitation] = await allInvitations()

    await postForm(
      client,
      operator,
      `/guru/undangan/${invitation.publicId}/kirim-ulang`,
      {},
      '/guru'
    )
    assert.lengthOf(fake.mails.queued(), 2)
    const latest = tokenOf(fake.mails.queued()[1])

    await postForm(client, operator, `/guru/undangan/${invitation.publicId}/batal`, {}, '/guru')
    assert.lengthOf(await allInvitations(), 0)

    const visitor = await guest(client)
    const page = await inertiaPage(client, visitor, `/undangan/${latest}`)
    assert.isNull(page.inertiaProps.invitation)
  })

  test('a teacher, or a user without a school, cannot open Guru', async ({ client, assert }) => {
    const school = await createSchool('SD Undangan')
    const teacher = await signInMember(client, school, 'teacher')
    const page = await visit(client, 'app', '/guru', cookieOf(teacher))
    assert.equal(page.status(), 403)

    const { response } = await postForm(
      client,
      teacher,
      '/guru/undangan',
      { email: 'x@uji.test' },
      '/akun'
    )
    assert.equal(response.status(), 403)
    assert.lengthOf(await allInvitations(), 0)

    const loner = await User.create({
      name: 'Sendiri',
      email: 'sendiri@uji.test',
      password: PASSWORD,
      nip: null,
    })
    const alone = await signIn(client, 'app', loner.email)
    const lonely = await visit(client, 'app', '/guru', cookieOf(alone))
    assert.equal(lonely.status(), 403)
  })

  test('IDOR: an operator never reaches another school’s invitation', async ({
    client,
    assert,
  }) => {
    fakeMail()
    const schoolA = await createSchool('SD A')
    const schoolB = await createSchool('SD B')
    const operatorA = await signInMember(client, schoolA, 'operator')
    const operatorB = await signInMember(client, schoolB, 'operator')
    await invite(client, operatorB, 'guru-b@uji.test')
    const [ofB] = await allInvitations()

    for (const action of ['kirim-ulang', 'batal']) {
      const { response } = await postForm(
        client,
        operatorA,
        `/guru/undangan/${ofB.publicId}/${action}`,
        {},
        '/guru'
      )
      assert.equal(response.status(), 404, action)
    }
    const page = await inertiaPage(client, operatorA, '/guru')
    assert.lengthOf(page.inertiaProps.invitations, 0)

    const still = await allInvitations()
    assert.lengthOf(still, 1)
    assert.equal(still[0].sendCount, 1)

    await assertSchoolCannotRead(assert, schoolA, () => Invitation.find(ofB.id))
    await assertSchoolCannotRead(assert, schoolA, () => Invitation.query().where('id', ofB.id))
    await assertRlsHides(assert, schoolA, 'invitations', [ofB.id])
  })
})

test.group('Accounts | accepting an invitation', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => fakeMail().restore)

  async function invited(client: Parameters<typeof signIn>[0], email: string) {
    const { fake } = fakeMail()
    const school = await createSchool('SD Tujuan')
    const operator = await signInMember(client, school, 'operator')
    await invite(client, operator, email)
    return { school, token: tokenOf(fake.mails.queued().at(-1)!) }
  }

  test('a new person makes an account and joins without a session', async ({ client, assert }) => {
    const { school, token } = await invited(client, 'baru@uji.test')
    const visitor = await guest(client)

    const page = await inertiaPage(client, visitor, `/undangan/${token}`)
    assert.equal(page.inertiaProps.invitation.mode, 'new_account')
    assert.equal(page.inertiaProps.invitation.schoolName, 'SD Tujuan')

    const { response, session } = await postForm(client, visitor, `/undangan/${token}`, {
      name: 'Bu Guru Baru',
      password: 'rahasia123',
      password_confirmation: 'rahasia123',
    })
    assert.equal(response.header('location'), '/')

    const user = await User.findByOrFail('email', 'baru@uji.test')
    assert.isNotNull(user.emailVerifiedAt)
    assert.isNotNull(user.trialStartedAt)
    const membership = await SchoolMembership.query()
      .where('user_id', user.id)
      .where('school_id', school.id)
      .firstOrFail()
    assert.equal(membership.role, 'teacher')
    assert.equal(membership.status, 'active')

    const account = await inertiaPage(client, session, '/akun')
    account.assertStatus(200)
    assert.equal(account.inertiaProps.memberships[0].schoolName, 'SD Tujuan')

    const used = await inertiaPage(client, await guest(client), `/undangan/${token}`)
    assert.isNull(used.inertiaProps.invitation)
  })

  test('an unknown, expired or malformed link shows one neutral page', async ({
    client,
    assert,
  }) => {
    const { token } = await invited(client, 'lama@uji.test')
    await db
      .from('invitations')
      .update({ expires_at: DateTime.now().minus({ minutes: 1 }).toSQL() })
    const visitor = await guest(client)

    for (const link of [token, 'A'.repeat(43)]) {
      const page = await inertiaPage(client, visitor, `/undangan/${link}`)
      page.assertStatus(200)
      assert.isNull(page.inertiaProps.invitation)
    }
    const malformed = await client.get('/undangan/pendek').header('host', 'app.sigrak.test')
    assert.equal(malformed.status(), 404)

    await postForm(client, visitor, `/undangan/${token}`, {
      name: 'Terlambat',
      password: 'rahasia123',
      password_confirmation: 'rahasia123',
    })
    assert.isNull(await User.findBy('email', 'lama@uji.test'))
  })

  test('a teacher who signed up alone joins and keeps documents and AI keys', async ({
    client,
    assert,
  }) => {
    // Signed up alone (D-459), made work without a school.
    const visitor = await guest(client, 'app', '/daftar')
    await postForm(client, visitor, '/daftar', {
      name: 'Pak Mandiri',
      email: 'mandiri@uji.test',
      password: 'rahasia123',
      password_confirmation: 'rahasia123',
    })
    const teacher = await User.findByOrFail('email', 'mandiri@uji.test')
    const [key] = await createAiKeys(teacher, 1)
    const [{ id: generationId }] = (await db
      .table('generations')
      .insert({
        public_id: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a51',
        school_id: null,
        user_id: teacher.id,
        template_key: 'demo',
        template_version: 1,
        client_token: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a52',
        specification: JSON.stringify({ topic: 'Siklus air' }),
        status: 'succeeded',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id')) as { id: number }[]

    const { school, token } = await invited(client, 'MANDIRI@uji.test')
    const principal = await createMember(school, 'principal')

    const page = await inertiaPage(client, await guest(client), `/undangan/${token}`)
    assert.equal(page.inertiaProps.invitation.mode, 'sign_in')

    const wrong = await postForm(client, await guest(client), `/undangan/${token}`, {
      password: 'salah-sekali1',
    })
    assert.equal(wrong.response.header('location'), `/undangan/${token}`)
    assert.lengthOf(await SchoolMembership.query().where('user_id', teacher.id), 0)

    const { response } = await postForm(client, await guest(client), `/undangan/${token}`, {
      password: 'rahasia123',
    })
    assert.equal(response.header('location'), '/')

    // Same account, now a member.
    assert.lengthOf(await User.query().where('email', 'mandiri@uji.test'), 1)
    const membership = await SchoolMembership.query()
      .where('user_id', teacher.id)
      .where('school_id', school.id)
      .firstOrFail()
    assert.equal(membership.status, 'active')

    // Nothing moved: the work and the key are still the teacher's own.
    const row = await db.from('generations').where('id', generationId).firstOrFail()
    assert.equal(row.user_id, teacher.id)
    assert.isNull(row.school_id)
    const keyRow = await db.from('ai_credentials').where('id', key.id).firstOrFail()
    assert.equal(keyRow.user_id, teacher.id)

    // The teacher still sees the work inside the school's context…
    const asTeacher = await db.connection('tenant').transaction(async (trx) => {
      await trx.rawQuery(
        `SELECT set_config('app.school_id', ?, true), set_config('app.user_id', ?, true)`,
        [String(school.id), String(teacher.id)]
      )
      return trx.from('generations').where('id', generationId)
    })
    assert.lengthOf(asTeacher, 1)

    // …and the principal of that school does not.
    const asPrincipal = await db.connection('tenant').transaction(async (trx) => {
      await trx.rawQuery(
        `SELECT set_config('app.school_id', ?, true), set_config('app.user_id', ?, true)`,
        [String(school.id), String(principal.user.id)]
      )
      return trx.from('generations').where('id', generationId)
    })
    assert.lengthOf(asPrincipal, 0)
  })

  test('a signed-in teacher with the invited email joins with one click', async ({
    client,
    assert,
  }) => {
    const teacher = await User.create({
      name: 'Bu Sudah Masuk',
      email: 'masuk@uji.test',
      password: PASSWORD,
      nip: null,
    })
    const { school, token } = await invited(client, 'masuk@uji.test')
    const session = await signIn(client, 'app', teacher.email)

    const page = await inertiaPage(client, session, `/undangan/${token}`)
    assert.equal(page.inertiaProps.invitation.mode, 'join')

    const { response, session: after } = await postForm(client, session, `/undangan/${token}`, {})
    assert.equal(response.header('location'), '/')
    const membership = await SchoolMembership.query()
      .where('user_id', teacher.id)
      .where('school_id', school.id)
      .firstOrFail()

    // The new membership is the active one for the next requests.
    const account = await inertiaPage(client, after, '/akun')
    const active = account.inertiaProps.memberships.find(
      (choice: { active: boolean }) => choice.active
    )
    assert.equal(active.publicId, membership.publicId)
  })

  test('signed in as someone else, the invitation is refused', async ({ client, assert }) => {
    const other = await User.create({
      name: 'Orang Lain',
      email: 'lain@uji.test',
      password: PASSWORD,
      nip: null,
    })
    const { token } = await invited(client, 'tujuan@uji.test')
    const session = await signIn(client, 'app', other.email)

    const page = await inertiaPage(client, session, `/undangan/${token}`)
    assert.equal(page.inertiaProps.invitation.mode, 'other_account')

    await postForm(client, session, `/undangan/${token}`, {})
    assert.lengthOf(await SchoolMembership.query().where('user_id', other.id), 0)
    assert.isNull(await User.findBy('email', 'tujuan@uji.test'))
  })

  test('a new account needs a password with letters and numbers', async ({ client, assert }) => {
    const { token } = await invited(client, 'lemah@uji.test')
    const visitor = await guest(client)
    const { session } = await postForm(client, visitor, `/undangan/${token}`, {
      name: 'Lemah',
      password: 'hanyahuruf',
      password_confirmation: 'hanyahuruf',
    })
    const page = await inertiaPage(client, session, `/undangan/${token}`)
    assert.equal(page.inertiaProps.errors.password, 'Kata sandi harus memuat huruf dan angka.')
    assert.isNull(await User.findBy('email', 'lemah@uji.test'))
  })
})

test.group('Accounts | console invitations', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => fakeMail().restore)

  test('an admin invites the first operator; a second principal is refused', async ({
    client,
    assert,
  }) => {
    const { fake } = fakeMail()
    const school = await createSchool('SD Konsol')
    await createMember(school, 'principal')
    const staff = await createStaffWithRole('admin')
    const session = await signIn(client, 'admin', staff.email)

    await postForm(
      client,
      session,
      `/sekolah/${school.id}/undangan`,
      { email: 'operator@uji.test', role: 'operator' },
      `/sekolah/${school.id}`
    )
    const rows = await allInvitations()
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].role, 'operator')
    assert.equal(rows[0].invitedByStaffId, staff.id)
    assert.isNull(rows[0].invitedBy)
    const mail = fake.mails.queued()[0] as InvitationMail
    assert.include(mail.content.paragraphs[0], 'Tim SIGRAK')

    await postForm(
      client,
      session,
      `/sekolah/${school.id}/undangan`,
      { email: 'kepala@uji.test', role: 'principal' },
      `/sekolah/${school.id}`
    )
    assert.lengthOf(await allInvitations(), 1)

    const page = await inertiaPage(client, session, `/sekolah/${school.id}`)
    assert.equal(page.inertiaProps.invitations[0].email, 'operator@uji.test')
    assert.lengthOf(page.inertiaProps.members, 1)
  })

  test('support views the school read-only and cannot invite (D-469)', async ({
    client,
    assert,
  }) => {
    fakeMail()
    const school = await createSchool('SD Konsol')
    await createMember(school, 'principal')
    const staff = await createStaffWithRole('support')
    const session = await signIn(client, 'admin', staff.email)

    const page = await inertiaPage(client, session, `/sekolah/${school.id}`)
    page.assertStatus(200)
    assert.lengthOf(page.inertiaProps.members, 1)
    assert.isFalse(page.inertiaProps.can.manageInvitations)

    const { response } = await postForm(
      client,
      session,
      `/sekolah/${school.id}/undangan`,
      { email: 'operator@uji.test', role: 'operator' },
      `/sekolah/${school.id}`
    )
    assert.equal(response.status(), 403)
    assert.lengthOf(await allInvitations(), 0)
  })

  test('a content staff member cannot open schools or invite', async ({ client, assert }) => {
    const school = await createSchool('SD Konsol')
    const staff = await createStaffWithRole('content')
    const session = await signIn(client, 'admin', staff.email)

    const list = await client
      .get('/sekolah')
      .header('host', 'admin.sigrak.test')
      .withCookie('sigrak_admin_session', session.sessionId)
    assert.equal(list.status(), 403)

    const { response } = await postForm(
      client,
      session,
      `/sekolah/${school.id}/undangan`,
      { email: 'x@uji.test', role: 'operator' },
      '/'
    )
    assert.equal(response.status(), 403)
    assert.lengthOf(await allInvitations(), 0)
  })
})
