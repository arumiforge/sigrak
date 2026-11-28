import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'
import Region from '#models/region'
import type School from '#models/school'
import { seedRegionList } from '#regions/region_list'
import { readSchoolView } from '#help/support_sessions'
import { sessionCookieNames } from '#config/session'
import { createCalendar, createSchool, createStaff, visit } from '#tests/helpers'
import { inertiaPage, postForm, signIn, type Session } from '#tests/accounts'
import { createMember } from '#tests/tenancy'

/**
 * Support sessions (R2-06, D-341, D-469): "Lihat sekolah ini" opens one
 * internal row per session, the school view is read-only (the database
 * refuses writes), religion and health data never reach the page, a
 * banner shows on every console page, "Akhiri" closes the row and a
 * session times out after two hours.
 */

function get(client: ApiClient, session: Session, path: string) {
  return visit(client, session.area, path, {
    name: sessionCookieNames[session.area],
    sessionId: session.sessionId,
  })
}

async function props(client: ApiClient, session: Session, path: string) {
  const page = await inertiaPage(client, session, path)
  return page.inertiaProps as Record<string, any>
}

async function statusAt(client: ApiClient, session: Session, path: string) {
  const response = await get(client, session, path)
  return response.status()
}

async function propAt(client: ApiClient, session: Session, path: string, key: string) {
  const page = await props(client, session, path)
  return page[key]
}

/** A school with a member, an open year, a class with a homeroom teacher and a school event. */
async function schoolWithData(name = 'SD Uji A') {
  const school = await createSchool(name)
  const { user } = await createMember(school, 'operator')
  const now = new Date()
  const [year] = (await db
    .table('academic_years')
    .insert({
      public_id: randomUUID(),
      school_id: school.id,
      name: '2026/2027',
      starts_on: '2026-07-01',
      even_semester_starts_on: '2027-01-01',
      ends_on: '2027-06-30',
      created_at: now,
      updated_at: now,
    })
    .returning('id')) as { id: number }[]
  await db.table('classes').insert({
    public_id: randomUUID(),
    school_id: school.id,
    academic_year_id: year.id,
    grade: 4,
    name: 'A',
    homeroom_teacher_id: user.id,
    created_at: now,
    updated_at: now,
  })
  await createCalendar(school, ['Rapat orang tua'])
  return { school, user }
}

async function sessionRows(school?: School) {
  const query = db.from('support_sessions').orderBy('id')
  if (school) query.where('school_id', school.id)
  return query
}

test.group('Help | support sessions', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('"Lihat sekolah ini" opens one row and the read-only school view', async ({
    client,
    assert,
  }) => {
    const { school, user } = await schoolWithData()
    const support = await createStaff(['support'])
    let staff = await signIn(client, 'admin', support.email)

    const schoolPage = await props(client, staff, `/sekolah/${school.id}`)
    assert.isTrue(schoolPage.can.openSchool)
    assert.equal(schoolPage.supportSessionHours, 2)
    assert.isNull(schoolPage.supportSession)

    const started = await postForm(
      client,
      staff,
      `/sekolah/${school.id}/lihat`,
      {},
      `/sekolah/${school.id}`
    )
    staff = started.session
    assert.equal(started.response.header('location'), '/lihat-sekolah')

    const view = await props(client, staff, '/lihat-sekolah')
    assert.equal(view.school.name, 'SD Uji A')
    assert.deepEqual(
      view.members.map((member: { name: string }) => member.name),
      [user.name]
    )
    assert.equal(view.classes[0].homeroomName, user.name)
    assert.equal(view.years[0].name, '2026/2027')
    assert.equal(view.events[0].title, 'Rapat orang tua')
    assert.equal(view.supportSession.schoolName, 'SD Uji A')

    // Page views add no rows; the banner shows on other console pages.
    await props(client, staff, '/lihat-sekolah')
    const elsewhere = await props(client, staff, '/sekolah')
    assert.equal(elsewhere.supportSession.schoolName, 'SD Uji A')
    const rows = await sessionRows()
    assert.lengthOf(rows, 1)
    assert.equal(Number(rows[0].staff_user_id), support.id)
    assert.isNull(rows[0].ended_at)

    const ended = await postForm(client, staff, '/lihat-sekolah/akhiri', {}, '/lihat-sekolah')
    staff = ended.session
    assert.equal(ended.response.header('location'), `/sekolah/${school.id}`)
    const [closed] = await sessionRows()
    assert.isNotNull(closed.ended_at)
    assert.isNull(await propAt(client, staff, '/sekolah', 'supportSession'))
    const back = await get(client, staff, '/lihat-sekolah')
    assert.equal(back.header('location'), '/sekolah')

    const logs = await db
      .from('staff_activity_logs')
      .where('subject_type', 'support_session')
      .orderBy('id')
      .select('action')
    assert.deepEqual(
      logs.map((log) => log.action),
      ['support_session.start', 'support_session.end']
    )
  })

  test('opening another school closes the first; one open row per staff member', async ({
    client,
    assert,
  }) => {
    const { school: first } = await schoolWithData('SD Satu')
    const { school: second } = await schoolWithData('SD Dua')
    const support = await createStaff(['support'])
    let staff = await signIn(client, 'admin', support.email)
    ;({ session: staff } = await postForm(
      client,
      staff,
      `/sekolah/${first.id}/lihat`,
      {},
      '/sekolah'
    ))
    ;({ session: staff } = await postForm(
      client,
      staff,
      `/sekolah/${first.id}/lihat`,
      {},
      '/sekolah'
    ))
    assert.lengthOf(await sessionRows(), 1)
    ;({ session: staff } = await postForm(
      client,
      staff,
      `/sekolah/${second.id}/lihat`,
      {},
      '/sekolah'
    ))
    const rows = await sessionRows()
    assert.lengthOf(rows, 2)
    assert.isNotNull(rows[0].ended_at)
    assert.isNull(rows[1].ended_at)
    const viewed = await propAt(client, staff, '/lihat-sekolah', 'school')
    assert.equal(viewed.name, 'SD Dua')
  })

  test('a session times out after two hours', async ({ client, assert }) => {
    const { school } = await schoolWithData()
    const support = await createStaff(['support'])
    let staff = await signIn(client, 'admin', support.email)
    ;({ session: staff } = await postForm(
      client,
      staff,
      `/sekolah/${school.id}/lihat`,
      {},
      '/sekolah'
    ))
    await db
      .from('support_sessions')
      .update({ started_at: db.raw(`now() - interval '2 hours 5 minutes'`) })

    const response = await get(client, staff, '/lihat-sekolah')
    assert.equal(response.header('location'), '/sekolah')
    const [row] = await sessionRows()
    assert.isNotNull(row.ended_at)
    const length = new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()
    assert.equal(length, 2 * 60 * 60 * 1000)
    assert.isNull(await propAt(client, staff, '/sekolah', 'supportSession'))
  })

  test('the view is read-only: the database refuses writes', async ({ assert }) => {
    const { school } = await schoolWithData()
    const attempts = [
      "UPDATE schools SET name = 'Diubah' WHERE id = ?",
      'DELETE FROM classes WHERE school_id = ?',
      `INSERT INTO help_requests (public_id, school_id, category, message, status, status_changed_at, created_at, updated_at)
         VALUES (gen_random_uuid(), ?, 'other', 'Tulisan saat sesi', 'new', now(), now(), now())`,
    ]
    for (const sql of attempts) {
      await assert.rejects(
        () => readSchoolView(school.id, (trx) => trx.rawQuery(sql, [school.id]).then(() => {})),
        /read-only transaction/
      )
    }
    const unchanged = await db.from('schools').where('id', school.id).firstOrFail()
    assert.equal(unchanged.name, 'SD Uji A')
    assert.lengthOf(await db.from('classes').where('school_id', school.id), 1)
    assert.lengthOf(await db.from('help_requests'), 0)

    // The role itself cannot write either, even outside READ ONLY mode.
    await assert.rejects(
      () =>
        db.connection('tenant').transaction(async (trx) => {
          await trx.rawQuery('SET LOCAL ROLE sigrak_staff_readonly')
          await trx.rawQuery('UPDATE schools SET name = ? WHERE id = ?', ['Diubah', school.id])
        }),
      /permission denied/
    )
  })

  test('religion and health fields never reach the page', async ({ client, assert }) => {
    const { school } = await schoolWithData()
    const support = await createStaff(['support'])
    let staff = await signIn(client, 'admin', support.email)
    ;({ session: staff } = await postForm(
      client,
      staff,
      `/sekolah/${school.id}/lihat`,
      {},
      '/sekolah'
    ))
    const page = await inertiaPage(client, staff, '/lihat-sekolah')
    const keys = new Set<string>()
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk)
      else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          keys.add(key)
          walk(child)
        }
      }
    }
    // Shared shell props (translations, menu abilities) are copy, not school data.
    const schoolProps = { ...(page.inertiaProps as Record<string, unknown>) }
    delete schoolProps.messages
    delete schoolProps.staffAbilities
    walk(schoolProps)
    for (const key of keys) {
      assert.notMatch(key, /religion|agama|health|kesehatan/i)
    }
    assert.isTrue(keys.has('members'))
  })

  test('who may open a school and see the session list', async ({ client, assert }) => {
    const { school } = await schoolWithData()

    // The owner sees the list but does not open schools (support's job, R2-01).
    const owner = await createStaff(['owner'])
    const ownerSession = await signIn(client, 'admin', owner.email)
    const { response: ownerStart } = await postForm(
      client,
      ownerSession,
      `/sekolah/${school.id}/lihat`,
      {},
      '/sekolah'
    )
    assert.equal(ownerStart.status(), 403)
    assert.equal(await statusAt(client, ownerSession, '/sesi-bantuan'), 200)

    // Support opens schools but does not see the internal list.
    const support = await createStaff(['support'])
    let staff = await signIn(client, 'admin', support.email)
    assert.equal(await statusAt(client, staff, '/sesi-bantuan'), 403)
    ;({ session: staff } = await postForm(
      client,
      staff,
      `/sekolah/${school.id}/lihat`,
      {},
      '/sekolah'
    ))
    const list = await props(client, ownerSession, '/sesi-bantuan')
    assert.lengthOf(list.sessions, 1)
    assert.equal(list.sessions[0].schoolName, 'SD Uji A')
    assert.isNull(list.sessions[0].endedAt)

    // A support member limited to another area cannot open this school.
    await seedRegionList(db.connection(), {
      kemendagriCode: '34',
      name: 'DI Yogyakarta',
      children: [
        {
          kemendagriCode: '34.99',
          name: 'Jauh',
          regencyKind: 'kabupaten',
          children: [{ kemendagriCode: '34.99.01', name: 'Jauh' }],
        },
      ],
    })
    const farRegency = await Region.findByOrFail('kemendagriCode', '34.99')
    const scoped = await createStaff(['support'], { regionIds: [farRegency.id] })
    const scopedSession = await signIn(client, 'admin', scoped.email)
    const { response } = await postForm(
      client,
      scopedSession,
      `/sekolah/${school.id}/lihat`,
      {},
      '/sekolah'
    )
    assert.equal(response.status(), 403)
    assert.lengthOf(await sessionRows(), 1)
  })
})
