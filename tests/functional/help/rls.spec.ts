import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import { DateTime } from 'luxon'
import User from '#models/user'
import HelpRequest from '#help/models/help_request'
import { myHelpRequests, openMyHelpRequest, sendHelpRequest } from '#help/help_requests'
import { SchoolContext } from '#tenancy/school_context'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import { PASSWORD, createStaff } from '#tests/helpers'
import { signIn } from '#tests/accounts'
import { visit } from '#tests/helpers'
import { sessionCookieNames } from '#config/session'
import {
  assertRlsHides,
  assertSchoolCannotRead,
  asSchool,
  createMember,
  createTwoSchools,
} from '#tests/tenancy'

/**
 * Tenancy of Minta Bantuan (R2-06): school A never reads school B's
 * requests or notes, by the app or straight through SQL; a request
 * without a school belongs to its sender only; internal notes never
 * reach the school; support sessions are invisible to every school.
 */

/** A request of `member` in their school, plus one reply, one status entry and one internal note. */
async function requestWithNotes(member: { user: User; membership: { schoolId: number } }) {
  const request = await HelpRequest.create(
    {
      schoolId: member.membership.schoolId,
      userId: member.user.id,
      membershipRole: 'teacher',
      category: 'school_data',
      message: 'Jadwal kelas 4A tidak muncul.',
      pageUrl: '/jadwal',
      status: 'in_progress',
      statusChangedAt: DateTime.now(),
      senderUnreadAt: DateTime.now(),
    },
    { connection: 'pg' }
  )
  const staff = await createStaff(['support'])
  const now = new Date()
  const notes = (await db
    .table('help_request_notes')
    .insert([
      {
        help_request_id: request.id,
        staff_user_id: staff.id,
        kind: 'reply',
        body: 'Sudah kami cek.',
        created_at: now,
      },
      {
        help_request_id: request.id,
        staff_user_id: staff.id,
        kind: 'status',
        status: 'in_progress',
        created_at: now,
      },
      {
        help_request_id: request.id,
        staff_user_id: staff.id,
        kind: 'note',
        body: 'Rahasia tim.',
        created_at: now,
      },
    ])
    .returning(['id', 'kind'])) as { id: number; kind: string }[]
  return { request, notes, staff }
}

test.group('Help | RLS and IDOR', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('school A never reads school B requests or notes', async ({ assert }) => {
    const { a, b } = await createTwoSchools()
    const { request, notes } = await requestWithNotes(b)

    await assertSchoolCannotRead(assert, a.school, () =>
      HelpRequest.query().where('id', request.id).first()
    )
    await assertSchoolCannotRead(assert, a.school, () => HelpRequest.query())
    await assertRlsHides(assert, a.school, 'help_requests', [request.id])
    await assertRlsHides(
      assert,
      a.school,
      'help_request_notes',
      notes.map((note) => Number(note.id))
    )

    // School B sees its own request.
    const own = await asSchool(b.school, () => HelpRequest.query().where('id', request.id).first())
    assert.equal(own?.id, request.id)
  })

  test('internal notes stay hidden from the school, even through SQL', async ({ assert }) => {
    const { b } = await createTwoSchools()
    const { request } = await requestWithNotes(b)
    const kinds = await asSchool(
      b.school,
      async () => {
        const trx = SchoolContext.current()!.trx!
        const result = await trx.rawQuery(
          `SELECT kind FROM help_request_notes WHERE help_request_id = ? ORDER BY kind`,
          [request.id]
        )
        return (result.rows as { kind: string }[]).map((row) => row.kind)
      },
      b.user.id
    )
    assert.deepEqual(kinds, ['reply', 'status'])

    const opened = await asSchool(
      b.school,
      () => openMyHelpRequest(b.user.id, request.publicId),
      b.user.id
    )
    assert.deepEqual(
      opened.notes.map((note) => note.kind),
      ['reply', 'status']
    )
  })

  test('a school cannot write notes or move a request to another school', async ({ assert }) => {
    const { a, b } = await createTwoSchools()
    const { request } = await requestWithNotes(b)

    await assert.rejects(() =>
      asSchool(b.school, async () => {
        const trx = SchoolContext.current()!.trx!
        await trx.table('help_request_notes').insert({
          help_request_id: request.id,
          kind: 'reply',
          body: 'Balasan palsu',
          created_at: new Date(),
        })
      })
    )
    await assert.rejects(() =>
      asSchool(b.school, async () => {
        const trx = SchoolContext.current()!.trx!
        await trx.from('help_requests').where('id', request.id).update({ school_id: a.school.id })
      })
    )
    // Inserting a request for another school is refused by the policy.
    await assert.rejects(() =>
      asSchool(a.school, async () => {
        const trx = SchoolContext.current()!.trx!
        await trx.table('help_requests').insert({
          public_id: '01900000-0000-7000-8000-000000000001',
          school_id: b.school.id,
          user_id: a.user.id,
          category: 'other',
          message: 'Atas nama sekolah lain',
          status: 'new',
          status_changed_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        })
      })
    )
  })

  test('a request without a school belongs to its sender only', async ({ assert }) => {
    const alone = await User.create({
      name: 'Guru Mandiri',
      email: 'mandiri@uji.test',
      password: PASSWORD,
      nip: null,
    })
    const other = await User.create({
      name: 'Guru Lain',
      email: 'lain@uji.test',
      password: PASSWORD,
      nip: null,
    })
    const { a } = await createTwoSchools()
    const request = await sendHelpRequest(alone, undefined, {
      category: 'account',
      message: 'Saya belum punya sekolah.',
      pageUrl: null,
    })
    assert.isNull(request.schoolId)

    const asUser = (userId: number) =>
      SchoolContext.run({ schoolId: null, userId }, () => myHelpRequests(userId))
    assert.lengthOf(await asUser(alone.id), 1)
    assert.lengthOf(await asUser(other.id), 0)
    const rawOther = await tenantTransaction(
      async (trx) =>
        trx.rawQuery('SELECT id FROM help_requests WHERE id = ?', [request.id]).then((r) => r.rows),
      { schoolId: null, userId: other.id }
    )
    assert.deepEqual(rawOther, [])
    await assertRlsHides(assert, a.school, 'help_requests', [request.id])
  })

  test('support sessions are invisible to every school', async ({ assert }) => {
    const { a } = await createTwoSchools()
    const staff = await createStaff(['support'])
    const [row] = (await db
      .table('support_sessions')
      .insert({ staff_user_id: staff.id, school_id: a.school.id, started_at: new Date() })
      .returning('id')) as { id: number }[]
    const rows = await asSchool(a.school, async () => {
      const trx = SchoolContext.current()!.trx!
      const result = await trx.rawQuery('SELECT id FROM support_sessions')
      return result.rows
    })
    assert.deepEqual(rows, [])
    assert.isAbove(Number(row.id), 0)
  })

  test('over HTTP a user opens only their own requests', async ({ client, assert }) => {
    const { a, b } = await createTwoSchools()
    const colleague = await createMember(b.school, 'teacher')
    const { request } = await requestWithNotes(b)

    const cookie = (sessionId: string) => ({ name: sessionCookieNames.app, sessionId })
    const owner = await signIn(client, 'app', b.user.email)
    const ownPage = await visit(
      client,
      'app',
      `/bantuan-saya/${request.publicId}`,
      cookie(owner.sessionId)
    )
    assert.equal(ownPage.status(), 200)

    for (const email of [a.user.email, colleague.user.email]) {
      const session = await signIn(client, 'app', email)
      const response = await visit(
        client,
        'app',
        `/bantuan-saya/${request.publicId}`,
        cookie(session.sessionId)
      )
      assert.equal(response.status(), 404, email)
      const list = await visit(
        client,
        'app',
        '/bantuan-saya',
        cookie(session.sessionId)
      ).withInertia()
      assert.lengthOf(list.inertiaProps.requests as unknown[], 0)
    }
  })
})
