import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import Region from '#models/region'
import School from '#models/school'
import User from '#models/user'
import HelpReplyMail from '#help/help_reply_mail'
import { seedRegionList } from '#regions/region_list'
import { sessionCookieNames } from '#config/session'
import { PASSWORD, createSchool, createStaff, visit } from '#tests/helpers'
import { fakeMail, inertiaPage, postForm, signIn, type Session } from '#tests/accounts'
import { createMember } from '#tests/tenancy'

/**
 * Minta Bantuan end to end (R2-06, D-320): a school user sends a
 * request with the page they were on; staff see it inside their area,
 * reply, change the status, take it, and add internal notes; the
 * sender sees the status and replies and is told in the app (mail
 * optional). Every staff change is logged.
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

/** Sends a request through the form as `member`; returns its row. */
async function send(
  client: ApiClient,
  session: Session,
  data: Record<string, string> = {
    category: 'school_data',
    message: 'Jadwal kelas 4A tidak muncul sesudah disimpan.',
    page_url: '/jadwal?kelas=4A',
  }
) {
  const { response } = await postForm(client, session, '/minta-bantuan', data)
  return response
}

async function latestRequest() {
  return db.from('help_requests').orderBy('id', 'desc').firstOrFail()
}

/** A school in another kabupaten (Kabupaten Jauh, 34.99), for scope tests. */
async function farSchool() {
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
  const regency = await Region.findByOrFail('kemendagriCode', '34.99')
  const district = await Region.findByOrFail('kemendagriCode', '34.99.01')
  const school = await School.create({
    name: 'MI Jauh',
    level: 'mi',
    regionId: regency.id,
    districtId: district.id,
    district: district.name,
    address: 'Jalan Jauh',
  })
  return { school, regency }
}

test.group('Help | Minta bantuan and console', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => fakeMail().restore)

  test('a teacher sends a request with the page attached', async ({ client, assert }) => {
    const school = await createSchool('SD Uji A')
    const { user } = await createMember(school, 'teacher')
    const session = await signIn(client, 'app', user.email)

    const form = await props(client, session, '/minta-bantuan?halaman=%2Fjadwal%3Fkelas%3D4A')
    assert.equal(form.pageUrl, '/jadwal?kelas=4A')
    assert.includeMembers(form.categories, ['account', 'school_data', 'other'])

    const response = await send(client, session)
    const row = await latestRequest()
    assert.equal(response.header('location'), `/bantuan-saya/${row.public_id}`)
    assert.equal(Number(row.school_id), school.id)
    assert.equal(Number(row.user_id), user.id)
    assert.equal(row.membership_role, 'teacher')
    assert.equal(row.category, 'school_data')
    assert.equal(row.page_url, '/jadwal?kelas=4A')
    assert.equal(row.status, 'new')
    assert.isNull(row.sender_unread_at)

    const mine = await props(client, session, '/bantuan-saya')
    assert.lengthOf(mine.requests, 1)
    assert.equal(mine.requests[0].status, 'new')
    assert.notProperty(mine.requests[0], 'number')
  })

  test('the form checks category and message and cleans the page', async ({ client, assert }) => {
    const school = await createSchool('SD Uji A')
    const { user } = await createMember(school, 'teacher')
    const session = await signIn(client, 'app', user.email)

    const short = await send(client, session, { category: 'other', message: 'Tolong' })
    assert.equal(short.status(), 302)
    const wrong = await send(client, session, {
      category: 'unknown',
      message: 'Kategori yang tidak ada di daftar.',
    })
    assert.equal(wrong.status(), 302)
    assert.equal(
      Number(((await db.from('help_requests').count('* as count').first()) as any).count),
      0
    )

    await send(client, session, {
      category: 'other',
      message: 'Halaman dari situs lain tidak disimpan.',
      page_url: '//contoh.test/curang',
    })
    const crossSite = await latestRequest()
    assert.isNull(crossSite.page_url)
    await send(client, session, {
      category: 'other',
      message: 'Alamat lengkap hanya disimpan jalurnya.',
      page_url: 'https://app.sigrak.test/kelas/1?tab=guru',
    })
    const fullUrl = await latestRequest()
    assert.equal(fullUrl.page_url, '/kelas/1?tab=guru')
  })

  test('a teacher without a school can ask for help too (D-459)', async ({ client, assert }) => {
    const alone = await User.create({
      name: 'Guru Mandiri',
      email: 'mandiri@uji.test',
      password: PASSWORD,
      nip: null,
    })
    const session = await signIn(client, 'app', alone.email)
    await send(client, session, { category: 'account', message: 'Saya belum punya sekolah.' })
    const row = await latestRequest()
    assert.isNull(row.school_id)
    assert.isNull(row.membership_role)

    // Only staff with an unlimited area see it.
    const support = await createStaff(['support'])
    const supportSession = await signIn(client, 'admin', support.email)
    assert.lengthOf(await propAt(client, supportSession, '/bantuan', 'requests'), 1)
    const { regency } = await farSchool()
    const scoped = await createStaff(['support'], { regionIds: [regency.id] })
    const scopedSession = await signIn(client, 'admin', scoped.email)
    assert.lengthOf(await propAt(client, scopedSession, '/bantuan', 'requests'), 0)
    assert.equal(await statusAt(client, scopedSession, `/bantuan/${row.id}`), 403)
  })

  test('staff reply with a status change; the sender is told and reads it', async ({
    client,
    assert,
  }) => {
    const { fake } = fakeMail()
    const school = await createSchool('SD Uji A')
    const { user } = await createMember(school, 'teacher')
    const sender = await signIn(client, 'app', user.email)
    await send(client, sender)
    const row = await latestRequest()

    const support = await createStaff(['support'])
    let staff = await signIn(client, 'admin', support.email)
    const detail = await props(client, staff, `/bantuan/${row.id}`)
    assert.isTrue(detail.can.manage)
    assert.isTrue(detail.can.openSchool)
    assert.isTrue(detail.can.toProblem)
    assert.equal(detail.request.senderName, user.name)
    assert.equal(detail.request.pageUrl, '/jadwal?kelas=4A')

    ;({ session: staff } = await postForm(
      client,
      staff,
      `/bantuan/${row.id}/balas`,
      {
        body: 'Coba muat ulang halaman Jadwal, lalu simpan lagi.',
        status: 'in_progress',
        email: '1',
      },
      `/bantuan/${row.id}`
    ))
    ;({ session: staff } = await postForm(
      client,
      staff,
      `/bantuan/${row.id}/catatan`,
      { body: 'Mungkin terkait cache jadwal.' },
      `/bantuan/${row.id}`
    ))

    const updated = await db.from('help_requests').where('id', row.id).firstOrFail()
    assert.equal(updated.status, 'in_progress')
    assert.isNotNull(updated.sender_unread_at)
    const notes = await db
      .from('help_request_notes')
      .where('help_request_id', row.id)
      .orderBy('id')
      .select('kind', 'status', 'emailed')
    assert.deepEqual(
      notes.map((note) => note.kind),
      ['reply', 'status', 'note']
    )
    assert.isTrue(notes[0].emailed)
    const mails = fake.mails.queued((mail) => mail instanceof HelpReplyMail)
    assert.lengthOf(mails, 1)
    assert.include((mails[0] as HelpReplyMail).content.action.url, `/bantuan-saya/${row.public_id}`)

    const actions = await db
      .from('staff_activity_logs')
      .where('subject_type', 'help_request')
      .where('subject_id', String(row.id))
      .orderBy('id')
      .select('action')
    assert.deepEqual(
      actions.map((log) => log.action),
      ['help_request.status', 'help_request.reply', 'help_request.note']
    )

    // The sender sees the dot in the account menu, then reads the reply.
    const list = await props(client, sender, '/bantuan-saya')
    assert.equal(list.helpUnread, 1)
    assert.isTrue(list.requests[0].unread)
    assert.equal(list.requests[0].replies, 1)
    const opened = await props(client, sender, `/bantuan-saya/${row.public_id}`)
    assert.equal(opened.request.status, 'in_progress')
    assert.deepEqual(
      opened.entries.map((entry: { kind: string }) => entry.kind),
      ['reply', 'status']
    )
    assert.notInclude(JSON.stringify(opened), 'cache jadwal')
    const after = await props(client, sender, '/bantuan-saya')
    assert.equal(after.helpUnread, 0)
    assert.isFalse(after.requests[0].unread)
  })

  test('status buttons and "Ambil" are logged; the sender sees Selesai', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Uji A')
    const { user } = await createMember(school, 'operator')
    const sender = await signIn(client, 'app', user.email)
    await send(client, sender)
    const row = await latestRequest()

    const admin = await createStaff(['admin'])
    let staff = await signIn(client, 'admin', admin.email)
    ;({ session: staff } = await postForm(
      client,
      staff,
      `/bantuan/${row.id}/ambil`,
      {},
      `/bantuan/${row.id}`
    ))
    ;({ session: staff } = await postForm(
      client,
      staff,
      `/bantuan/${row.id}/status`,
      { status: 'done' },
      `/bantuan/${row.id}`
    ))
    const updated = await db.from('help_requests').where('id', row.id).firstOrFail()
    assert.equal(Number(updated.assignee_staff_id), admin.id)
    assert.equal(updated.status, 'done')

    const mine = await props(client, staff, '/bantuan?petugas=saya')
    assert.lengthOf(mine.requests, 1)
    assert.lengthOf(await propAt(client, staff, '/bantuan?petugas=kosong', 'requests'), 0)
    assert.lengthOf(await propAt(client, staff, '/bantuan?status=new', 'requests'), 0)
    assert.lengthOf(await propAt(client, staff, '/bantuan?status=done', 'requests'), 1)
    assert.lengthOf(await propAt(client, staff, '/bantuan?jenis=exam', 'requests'), 0)

    const logs = await db
      .from('staff_activity_logs')
      .where('subject_type', 'help_request')
      .orderBy('id')
      .select('action', 'changes')
    assert.deepEqual(
      logs.map((log) => log.action),
      ['help_request.assign', 'help_request.status']
    )
    assert.deepInclude(logs[1].changes, { from: 'new', to: 'done' })

    const opened = await props(client, sender, `/bantuan-saya/${row.public_id}`)
    assert.equal(opened.request.status, 'done')
  })

  test('the area scope limits the list, the region filter and the actions', async ({
    client,
    assert,
  }) => {
    const near = await createSchool('SD Dekat')
    const { school: far, regency: farRegency } = await farSchool()
    for (const school of [near, far]) {
      const { user } = await createMember(school, 'teacher')
      await send(client, await signIn(client, 'app', user.email))
    }
    const nearRow = await db.from('help_requests').where('school_id', near.id).firstOrFail()

    const scoped = await createStaff(['support'], { regionIds: [farRegency.id] })
    const staff = await signIn(client, 'admin', scoped.email)
    const list = await props(client, staff, '/bantuan')
    assert.deepEqual(
      list.requests.map((row: { schoolName: string }) => row.schoolName),
      ['MI Jauh']
    )
    assert.deepEqual(
      list.regions.map((region: { id: number }) => region.id),
      [farRegency.id]
    )
    assert.equal(await statusAt(client, staff, `/bantuan/${nearRow.id}`), 403)
    const { response } = await postForm(
      client,
      staff,
      `/bantuan/${nearRow.id}/balas`,
      { body: 'Tidak boleh', status: 'done' },
      '/bantuan'
    )
    assert.equal(response.status(), 403)

    // An unlimited admin filters by region.
    const admin = await createStaff(['admin'])
    const adminSession = await signIn(client, 'admin', admin.email)
    const all = await props(client, adminSession, '/bantuan')
    assert.lengthOf(all.requests, 2)
    assert.lengthOf(all.regions, 2)
    const filtered = await props(client, adminSession, `/bantuan?wilayah=${farRegency.id}`)
    assert.lengthOf(filtered.requests, 1)
    assert.equal(filtered.filters.region, farRegency.id)
    const untouched = await db.from('help_requests').where('id', nearRow.id).firstOrFail()
    assert.equal(untouched.status, 'new')
  })

  test('view-only roles read but cannot act; others are kept out', async ({ client, assert }) => {
    const school = await createSchool('SD Uji A')
    const { user } = await createMember(school, 'teacher')
    await send(client, await signIn(client, 'app', user.email))
    const row = await latestRequest()

    const engineer = await createStaff(['engineer'])
    const engineerSession = await signIn(client, 'admin', engineer.email)
    const detail = await props(client, engineerSession, `/bantuan/${row.id}`)
    assert.isFalse(detail.can.manage)
    assert.isFalse(detail.can.openSchool)
    for (const [path, data] of [
      [`/bantuan/${row.id}/balas`, { body: 'Halo', status: 'done' }],
      [`/bantuan/${row.id}/status`, { status: 'done' }],
      [`/bantuan/${row.id}/ambil`, {}],
      [`/bantuan/${row.id}/catatan`, { body: 'Catatan' }],
    ] as const) {
      const { response } = await postForm(client, engineerSession, path, data, '/bantuan')
      assert.equal(response.status(), 403, path)
    }

    const marketing = await createStaff(['marketing'], { regionIds: [school.regionId] })
    const marketingSession = await signIn(client, 'admin', marketing.email)
    assert.equal(await statusAt(client, marketingSession, '/bantuan'), 403)
    assert.equal(await statusAt(client, marketingSession, `/bantuan/${row.id}`), 403)
    assert.equal((await db.from('help_request_notes').count('* as count').first())!.count, '0')
  })
})
