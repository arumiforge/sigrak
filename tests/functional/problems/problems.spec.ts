import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import Region from '#models/region'
import type StaffUser from '#models/staff_user'
import { seedRegionList } from '#regions/region_list'
import { sessionCookieNames } from '#config/session'
import { createSchool, createStaff, visit } from '#tests/helpers'
import { inertiaPage, postForm, signIn, type Session } from '#tests/accounts'
import { assertRlsHides, createMember } from '#tests/tenancy'

/**
 * Bank Masalah, Bank Praktik Baik and the Forum Masalah→Solusi end to
 * end (R2-07, D-439, D-477): a help request becomes a problem and its
 * sender is told; each team moves only its own step; the owner decides
 * in the forum; merging moves reporters; analyses credit researchers;
 * on Rilis every reporter is told once.
 */

async function props(client: ApiClient, session: Session, path: string) {
  const page = await inertiaPage(client, session, path)
  return page.inertiaProps as Record<string, any>
}

async function statusAt(client: ApiClient, session: Session, path: string) {
  const response = await visit(client, session.area, path, {
    name: sessionCookieNames[session.area],
    sessionId: session.sessionId,
  })
  return response.status()
}

/** POSTs with the CSRF token of a page every staff member may open. */
async function post(
  client: ApiClient,
  session: Session,
  path: string,
  data: Record<string, string | number> = {}
) {
  const { response } = await postForm(client, session, path, data, '/peran')
  return response
}

/** The HTTP status of a POST (403 for a missing ability). */
async function postCode(
  client: ApiClient,
  session: Session,
  path: string,
  data: Record<string, string | number> = {}
) {
  const response = await post(client, session, path, data)
  return response.status()
}

async function statusOf(id: number) {
  const row = await problem(id)
  return row.status as string
}

async function latestId() {
  const row = await latestProblem()
  return Number(row.id)
}

async function meetingId() {
  const row = await db.from('forum_meetings').firstOrFail()
  return Number(row.id)
}

async function staffSession(client: ApiClient, staff: StaffUser) {
  return signIn(client, 'admin', staff.email)
}

/** A teacher of a new school sends a help request; returns its row. */
async function helpRequest(client: ApiClient, schoolName = 'SD Uji A') {
  const school = await createSchool(schoolName)
  const { user } = await createMember(school, 'teacher')
  const session = await signIn(client, 'app', user.email)
  await postForm(client, session, '/minta-bantuan', {
    category: 'school_data',
    message: 'Jadwal kelas 4A tidak muncul sesudah disimpan.',
  })
  const row = await db.from('help_requests').orderBy('id', 'desc').firstOrFail()
  return { school, user, session, row }
}

async function problem(id: number) {
  return db.from('problems').where('id', id).firstOrFail()
}

async function latestProblem() {
  return db.from('problems').orderBy('id', 'desc').firstOrFail()
}

async function actions(subjectType: string, subjectId?: number) {
  const query = db.from('staff_activity_logs').where('subject_type', subjectType).orderBy('id')
  if (subjectId) query.where('subject_id', String(subjectId))
  const rows = await query.select('action')
  return rows.map((row) => row.action as string)
}

async function replies(helpRequestId: number) {
  return db
    .from('help_request_notes')
    .where('help_request_id', helpRequestId)
    .where('kind', 'reply')
    .orderBy('id')
    .select('body')
}

/** Kabupaten Jauh (34.99) in another province, for area tests. */
async function farRegency() {
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
  return Region.findByOrFail('kemendagriCode', '34.99')
}

/** A problem recorded straight in the database at a status. */
async function seedProblem(status = 'new', regionId: number | null = null) {
  const now = new Date()
  const [row] = await db
    .table('problems')
    .insert({
      title: 'Jadwal tidak tersimpan',
      description: 'Operator melaporkan jadwal tidak tersimpan setelah diubah.',
      source: 'field_note',
      region_id: regionId,
      status,
      status_changed_at: now,
      created_at: now,
      updated_at: now,
    })
    .returning('id')
  return Number(row.id)
}

test.group('Problems | Bank Masalah', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('"Jadikan masalah" records the request; the sender is told once', async ({
    client,
    assert,
  }) => {
    const { school, session: sender, row } = await helpRequest(client)
    const support = await createStaff(['support'])
    const staff = await staffSession(client, support)

    const before = await props(client, staff, `/bantuan/${row.id}`)
    assert.isTrue(before.can.toProblem)
    assert.isNull(before.problem)

    const response = await post(client, staff, `/bantuan/${row.id}/jadikan-masalah`, {
      mode: 'new',
      title: 'Jadwal kelas tidak tersimpan',
      description: 'Jadwal yang disimpan operator tidak muncul lagi di halaman Jadwal.',
    })
    assert.equal(response.header('location'), `/bantuan/${row.id}`)

    const created = await latestProblem()
    assert.equal(created.source, 'help_request')
    assert.equal(created.status, 'new')
    assert.equal(Number(created.region_id), school.regionId)
    assert.equal(created.level, 'sd')
    assert.equal(Number(created.recorded_by_staff_id), support.id)
    const report = await db.from('problem_reports').firstOrFail()
    assert.equal(Number(report.problem_id), created.id)
    assert.equal(Number(report.help_request_id), row.id)

    const request = await db.from('help_requests').where('id', row.id).firstOrFail()
    assert.equal(request.status, 'in_progress')
    assert.isNotNull(request.sender_unread_at)
    const notes = await replies(row.id)
    assert.lengthOf(notes, 1)
    assert.include(notes[0].body, 'sudah kami catat')
    assert.includeMembers(await actions('help_request', row.id), [
      'help_request.status',
      'help_request.to_problem',
    ])
    assert.deepEqual(await actions('problem', created.id), [
      'problem.create',
      'problem.report_linked',
    ])

    // The sender sees the notice; the console shows the link; no second link.
    const mine = await props(client, sender, '/bantuan-saya')
    assert.equal(mine.helpUnread, 1)
    const after = await props(client, staff, `/bantuan/${row.id}`)
    assert.equal(after.problem.id, created.id)
    assert.isFalse(after.can.toProblem)
    await post(client, staff, `/bantuan/${row.id}/jadikan-masalah`, {
      mode: 'new',
      title: 'Lagi',
      description: 'Permintaan yang sama dicatat lagi.',
    })
    assert.lengthOf(await db.from('problems'), 1)
    assert.lengthOf(await db.from('problem_reports'), 1)
  })

  test('a second request links to an open problem; closed ones are refused', async ({
    client,
    assert,
  }) => {
    const first = await helpRequest(client)
    const support = await createStaff(['support'])
    const staff = await staffSession(client, support)
    await post(client, staff, `/bantuan/${first.row.id}/jadikan-masalah`, {
      mode: 'new',
      title: 'Jadwal kelas tidak tersimpan',
      description: 'Jadwal yang disimpan operator tidak muncul lagi.',
    })
    const created = await latestProblem()

    const { user } = await createMember(first.school, 'operator')
    await postForm(client, await signIn(client, 'app', user.email), '/minta-bantuan', {
      category: 'school_data',
      message: 'Jadwal saya juga hilang setelah disimpan.',
    })
    const second = await db.from('help_requests').orderBy('id', 'desc').firstOrFail()
    const page = await props(client, staff, `/bantuan/${second.id}`)
    assert.deepInclude(
      page.openProblems.map((item: { id: number }) => item.id),
      created.id
    )
    await post(client, staff, `/bantuan/${second.id}/jadikan-masalah`, {
      mode: 'link',
      problem_id: created.id,
    })
    assert.lengthOf(await db.from('problems'), 1)
    assert.lengthOf(await db.from('problem_reports').where('problem_id', created.id), 2)

    const closed = await seedProblem('closed')
    const third = await helpRequest(client, 'SD Uji B')
    await post(client, staff, `/bantuan/${third.row.id}/jadikan-masalah`, {
      mode: 'link',
      problem_id: closed,
    })
    assert.lengthOf(await db.from('problem_reports').where('problem_id', closed), 0)
    const request = await db.from('help_requests').where('id', third.row.id).firstOrFail()
    assert.equal(request.status, 'new')

    // Roles without problems.record (engineer) cannot turn a request into a problem.
    const engineer = await createStaff(['engineer'])
    const engineerSession = await staffSession(client, engineer)
    const response = await post(
      client,
      engineerSession,
      `/bantuan/${third.row.id}/jadikan-masalah`,
      {
        mode: 'new',
        title: 'Tidak boleh',
        description: 'Engineer tidak mencatat masalah.',
      }
    )
    assert.equal(response.status(), 403)
  })

  test('each team moves only its own step; the owner decides in the forum', async ({
    client,
    assert,
  }) => {
    const support = await createStaff(['support'])
    const researcher = await createStaff(['researcher'])
    const engineer = await createStaff(['engineer'])
    const admin = await createStaff(['admin'])
    const owner = await createStaff(['owner'])
    const field = await staffSession(client, support)
    const research = await staffSession(client, researcher)
    const product = await staffSession(client, engineer)

    const recorded = await post(client, field, '/bank-masalah', {
      title: 'Guru bingung mengisi jadwal',
      description: 'Pada kunjungan sekolah, tiga guru tidak menemukan menu Jadwal.',
      source: 'field_note',
    })
    const id = await latestId()
    assert.equal(recorded.header('location'), `/bank-masalah/${id}`)

    // Product and research cannot triage; support can.
    assert.equal(
      await postCode(client, product, `/bank-masalah/${id}/status`, { status: 'triaged' }),
      403
    )
    assert.equal(
      await postCode(client, research, `/bank-masalah/${id}/status`, { status: 'triaged' }),
      403
    )
    const fieldView = await props(client, field, `/bank-masalah/${id}`)
    assert.includeMembers(fieldView.moves, ['triaged', 'closed'])
    await post(client, field, `/bank-masalah/${id}/status`, { status: 'triaged' })
    assert.equal(await statusOf(id), 'triaged')

    // Dianalisis needs an analysis first, by the research team.
    assert.equal(
      await postCode(client, field, `/bank-masalah/${id}/status`, { status: 'analysed' }),
      403
    )
    await post(client, research, `/bank-masalah/${id}/status`, { status: 'analysed' })
    assert.equal(await statusOf(id), 'triaged')
    await post(client, research, `/bank-masalah/${id}/analisis`, {
      root_cause: 'Menu Jadwal tersembunyi di bawah menu Sekolah pada layar ponsel.',
      regulations: 'Tidak ada aturan yang terkait.',
    })
    await post(client, research, `/bank-masalah/${id}/status`, { status: 'analysed' })
    assert.equal(await statusOf(id), 'analysed')

    // Diputuskan only through the forum, even for the owner.
    const ownerSession = await staffSession(client, owner)
    await post(client, ownerSession, `/bank-masalah/${id}/status`, { status: 'decided' })
    assert.equal(await statusOf(id), 'analysed')

    const adminSession = await staffSession(client, admin)
    await post(client, adminSession, '/forum', { held_on: '2026-12-10' })
    const meeting = await db.from('forum_meetings').firstOrFail()
    await post(client, adminSession, `/forum/${meeting.id}/agenda`, { problem_id: id })
    assert.equal(
      await postCode(client, adminSession, `/forum/${meeting.id}/keputusan`, {
        problem_id: id,
        outcome: 'go',
      }),
      403
    )
    const forumPage = await props(client, ownerSession, `/forum/${meeting.id}`)
    assert.isTrue(forumPage.can.decide)
    assert.lengthOf(forumPage.items, 1)
    await post(client, ownerSession, `/forum/${meeting.id}/keputusan`, {
      problem_id: id,
      outcome: 'go',
      note: 'Kerjakan di siklus berikutnya.',
    })
    assert.equal(await statusOf(id), 'decided')
    const decision = await db.from('forum_decisions').firstOrFail()
    assert.equal(decision.outcome, 'go')
    assert.equal(Number(decision.decided_by_staff_id), owner.id)

    // Tim Produk builds and releases; support cannot.
    assert.equal(
      await postCode(client, field, `/bank-masalah/${id}/status`, { status: 'in_progress' }),
      403
    )
    await post(client, product, `/bank-masalah/${id}/status`, { status: 'in_progress' })
    await post(client, product, `/bank-masalah/${id}/status`, { status: 'released' })
    assert.equal(await statusOf(id), 'released')
    // A step that is not in the flow is refused.
    await post(client, product, `/bank-masalah/${id}/status`, { status: 'new' })
    assert.equal(await statusOf(id), 'released')

    const statusLogs = await db
      .from('staff_activity_logs')
      .where('action', 'problem.status')
      .orderBy('id')
      .select('changes')
    assert.deepEqual(
      statusLogs.map((log) => log.changes.to),
      ['triaged', 'analysed', 'decided', 'in_progress', 'released']
    )
    assert.equal(statusLogs[2].changes.via, 'forum')
  })

  test('on Rilis every reporter is told once, with the release note', async ({
    client,
    assert,
  }) => {
    const first = await helpRequest(client)
    const second = await helpRequest(client, 'SD Uji B')
    const support = await createStaff(['support'])
    const staff = await staffSession(client, support)
    await post(client, staff, `/bantuan/${first.row.id}/jadikan-masalah`, {
      mode: 'new',
      title: 'Jadwal kelas tidak tersimpan',
      description: 'Jadwal yang disimpan operator tidak muncul lagi.',
    })
    const id = await latestId()
    await post(client, staff, `/bantuan/${second.row.id}/jadikan-masalah`, {
      mode: 'link',
      problem_id: id,
    })
    await db.from('problems').where('id', id).update({ status: 'in_progress' })

    // Reading the notices clears the unread mark first.
    await props(client, first.session, `/bantuan-saya/${first.row.public_id}`)
    const engineer = await staffSession(client, await createStaff(['engineer']))
    await post(client, engineer, `/bank-masalah/${id}/status`, {
      status: 'released',
      release_note: 'Tombol Simpan di halaman Jadwal sekarang menyimpan semua kelas.',
    })

    for (const sender of [first, second]) {
      const request = await db.from('help_requests').where('id', sender.row.id).firstOrFail()
      assert.equal(request.status, 'done')
      assert.isNotNull(request.sender_unread_at)
      const notes = await replies(sender.row.id)
      assert.lengthOf(notes, 2)
      assert.include(notes[1].body, 'sudah bisa dipakai')
      assert.include(notes[1].body, 'Tombol Simpan di halaman Jadwal')
    }
    const reports = await db.from('problem_reports').where('problem_id', id)
    assert.isTrue(reports.every((report) => report.notified_at !== null))
    const shipped = await problem(id)
    assert.isTrue(shipped.release_note.startsWith('Tombol Simpan'))
    const opened = await props(client, first.session, `/bantuan-saya/${first.row.public_id}`)
    assert.equal(opened.request.status, 'done')
    assert.include(JSON.stringify(opened.entries), 'sudah bisa dipakai')

    // Back to Dikerjakan and released again: nobody is told twice.
    await post(client, engineer, `/bank-masalah/${id}/status`, { status: 'in_progress' })
    await post(client, engineer, `/bank-masalah/${id}/status`, { status: 'released' })
    assert.lengthOf(await replies(first.row.id), 2)
    assert.lengthOf(await replies(second.row.id), 2)
    const notified = await db
      .from('staff_activity_logs')
      .where('action', 'problem.reporters_notified')
      .select('changes')
    assert.lengthOf(notified, 1)
    assert.equal(notified[0].changes.count, 2)
  })

  test('merging moves reporters, closes the duplicate and tells them if shipped', async ({
    client,
    assert,
  }) => {
    const first = await helpRequest(client)
    const second = await helpRequest(client, 'SD Uji B')
    const support = await createStaff(['support'])
    const staff = await staffSession(client, support)
    for (const [request, title] of [
      [first.row, 'Jadwal tidak tersimpan'],
      [second.row, 'Jadwal hilang setelah disimpan'],
    ] as const) {
      await post(client, staff, `/bantuan/${request.id}/jadikan-masalah`, {
        mode: 'new',
        title,
        description: 'Jadwal yang disimpan operator tidak muncul lagi.',
      })
    }
    const problems = await db.from('problems').orderBy('id')
    const [target, duplicate] = problems.map((row) => Number(row.id))
    await db.from('problems').where('id', target).update({ status: 'released' })
    await db.from('problems').where('id', duplicate).update({ status: 'analysed' })
    const admin = await staffSession(client, await createStaff(['admin']))
    await post(client, admin, '/forum', { held_on: '2026-12-10' })
    const meeting = await db.from('forum_meetings').firstOrFail()
    await post(client, admin, `/forum/${meeting.id}/agenda`, { problem_id: duplicate })

    const detail = await props(client, staff, `/bank-masalah/${duplicate}`)
    assert.deepInclude(
      detail.mergeTargets.map((item: { id: number }) => item.id),
      target
    )
    const response = await post(client, staff, `/bank-masalah/${duplicate}/gabungkan`, {
      target_id: target,
    })
    assert.equal(response.header('location'), `/bank-masalah/${target}`)

    const closed = await problem(duplicate)
    assert.equal(closed.status, 'closed')
    assert.equal(Number(closed.merged_into_id), target)
    assert.lengthOf(await db.from('problem_reports').where('problem_id', target), 2)
    assert.lengthOf(await db.from('forum_decisions'), 0)
    assert.deepEqual(await actions('problem', duplicate), [
      'problem.create',
      'problem.report_linked',
      'problem.merge',
    ])
    // The target already shipped: the moved reporter hears it now, the first one did not get a second notice.
    const moved = await replies(second.row.id)
    assert.lengthOf(moved, 2)
    assert.include(moved[1].body, 'sudah bisa dipakai')
    assert.lengthOf(await replies(first.row.id), 2)

    // Merging into itself or into a closed problem is refused; a merged problem has no moves.
    await post(client, staff, `/bank-masalah/${target}/gabungkan`, { target_id: duplicate })
    assert.equal(await statusOf(target), 'released')
    const mergedView = await props(client, staff, `/bank-masalah/${duplicate}`)
    assert.deepEqual(mergedView.moves, [])
    assert.equal(mergedView.problem.mergedInto.id, target)
  })

  test('analyses credit researchers: chosen staff, outside names, or the author', async ({
    client,
    assert,
  }) => {
    const id = await seedProblem('triaged')
    const author = await createStaff(['researcher'])
    const colleague = await createStaff(['validator'])
    await db.from('staff_users').where('id', colleague.id).update({ name: 'Dewi Validator' })
    await db.from('staff_users').where('id', author.id).update({ name: 'Rina Peneliti' })
    const session = await staffSession(client, author)

    await post(client, session, `/bank-masalah/${id}/analisis`, {
      root_cause: 'Guru tidak tahu menu Jadwal ada di bawah menu Sekolah.',
    })
    await post(client, session, `/bank-masalah/${id}/analisis`, {
      'root_cause': 'Istilah di halaman Jadwal berbeda dengan istilah di sekolah.',
      'evidence_links': 'https://contoh.test/catatan-kunjungan\nhttps://contoh.test/foto',
      'credited_staff_ids[0]': colleague.id,
      'credited_names': 'Dr. Sari Lestari, Universitas Uji',
    })
    // A link that is not a full URL is refused.
    await post(client, session, `/bank-masalah/${id}/analisis`, {
      root_cause: 'Analisis dengan tautan yang salah tulis.',
      evidence_links: 'bukan-tautan',
    })

    const rows = await db.from('problem_analyses').orderBy('id')
    assert.lengthOf(rows, 2)
    assert.deepEqual(rows[0].credited_staff_ids.map(Number), [author.id])
    assert.deepEqual(rows[1].credited_staff_ids.map(Number), [colleague.id])
    assert.deepEqual(rows[1].credited_names, ['Dr. Sari Lestari, Universitas Uji'])
    assert.deepEqual(rows[1].evidence_links, [
      'https://contoh.test/catatan-kunjungan',
      'https://contoh.test/foto',
    ])

    const page = await props(client, session, `/bank-masalah/${id}`)
    assert.deepEqual(page.analyses[0].credits, ['Rina Peneliti'])
    assert.deepEqual(page.analyses[1].credits, [
      'Dewi Validator',
      'Dr. Sari Lestari, Universitas Uji',
    ])
    assert.deepEqual(await actions('problem', id), ['problem.analysis', 'problem.analysis'])

    // Field and product teams cannot analyse; a level-scoped researcher only their level.
    const support = await staffSession(client, await createStaff(['support']))
    assert.equal(
      await postCode(client, support, `/bank-masalah/${id}/analisis`, {
        root_cause: 'Tim Lapangan tidak menulis analisis.',
      }),
      403
    )
    await db.from('problems').where('id', id).update({ level: 'sd' })
    const miOnly = await staffSession(client, await createStaff(['researcher'], { levels: ['mi'] }))
    assert.equal(
      await postCode(client, miOnly, `/bank-masalah/${id}/analisis`, {
        root_cause: 'Peneliti MI tidak menganalisis masalah SD.',
      }),
      403
    )
  })

  test('the area scope limits recording and triage; reading is open to the teams', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Dekat')
    const far = await farRegency()
    const near = school.regionId
    const marketing = await createStaff(['marketing'], { regionIds: [far.id] })
    const session = await staffSession(client, marketing)

    const list = await props(client, session, '/bank-masalah')
    assert.isTrue(list.can.record)
    assert.isFalse(list.recordRegions.unlimited)
    assert.deepEqual(
      list.recordRegions.regions.map((region: { id: number }) => region.id),
      [far.id]
    )

    // Outside the area, or without a region, is refused.
    for (const region of [String(near), '']) {
      const response = await post(client, session, '/bank-masalah', {
        title: 'Masalah di luar wilayah',
        description: 'Masalah ini dicatat di luar cakupan staf.',
        source: 'webinar',
        region_id: region,
      })
      assert.equal(response.status(), 403)
    }
    await post(client, session, '/bank-masalah', {
      title: 'Masalah di wilayah sendiri',
      description: 'Masalah ini dicatat di dalam cakupan staf.',
      source: 'webinar',
      region_id: far.id,
    })
    const own = await latestProblem()
    assert.equal(Number(own.region_id), far.id)

    // A problem in another region: readable, but no triage.
    const other = await seedProblem('new', near)
    const page = await props(client, session, `/bank-masalah/${other}`)
    assert.isFalse(page.can.triage)
    assert.deepEqual(page.moves, [])
    assert.equal(
      await postCode(client, session, `/bank-masalah/${other}/status`, { status: 'triaged' }),
      403
    )
    // Moving its own problem into another region is refused.
    await post(client, session, `/bank-masalah/${own.id}/ubah`, {
      title: 'Masalah di wilayah sendiri',
      description: 'Masalah ini dicatat di dalam cakupan staf.',
      region_id: near,
    })
    const unchanged = await problem(own.id)
    assert.equal(Number(unchanged.region_id), far.id)

    // Finance has no Bank Masalah at all; the list and search work for others.
    const finance = await staffSession(client, await createStaff(['finance']))
    assert.equal(await statusAt(client, finance, '/bank-masalah'), 403)
    assert.equal(await statusAt(client, finance, '/forum'), 403)
    const researcher = await staffSession(client, await createStaff(['researcher']))
    const all = await props(client, researcher, '/bank-masalah')
    assert.lengthOf(all.problems, 2)
    assert.isFalse(all.can.record)
    const found = await props(
      client,
      researcher,
      `/bank-masalah?cari=BM-${String(own.id).padStart(4, '0')}`
    )
    assert.deepEqual(
      found.problems.map((row: { id: number }) => row.id),
      [own.id]
    )
    const byStatus = await props(client, researcher, '/bank-masalah?status=new')
    assert.equal(byStatus.counts.new, 2)
  })

  test('the forum agenda: order, remove, decisions before closing', async ({ client, assert }) => {
    const [a, b, c] = [
      await seedProblem('analysed'),
      await seedProblem('analysed'),
      await seedProblem('triaged'),
    ]
    const admin = await staffSession(client, await createStaff(['admin']))
    const owner = await staffSession(client, await createStaff(['owner']))
    await post(client, admin, '/forum', { held_on: '2026-12-10' })
    const meeting = await meetingId()
    const base = `/forum/${meeting}`

    const page = await props(client, admin, base)
    assert.deepEqual(page.candidates.map((item: { id: number }) => item.id).sort(), [a, b].sort())
    await post(client, admin, `${base}/agenda`, { problem_id: a })
    await post(client, admin, `${base}/agenda`, { problem_id: b })
    // Only analysed problems; never twice.
    await post(client, admin, `${base}/agenda`, { problem_id: c })
    await post(client, admin, `${base}/agenda`, { problem_id: a })
    assert.lengthOf(await db.from('forum_decisions'), 2)

    await post(client, admin, `${base}/agenda/pindah`, { problem_id: b, direction: 'up' })
    const order = await db.from('forum_decisions').orderBy('position').select('problem_id')
    assert.deepEqual(
      order.map((row) => Number(row.problem_id)),
      [b, a]
    )

    // Closing needs every decision.
    await post(client, admin, `${base}/selesai`)
    const planned = await db.from('forum_meetings').firstOrFail()
    assert.equal(planned.status, 'planned')
    await post(client, owner, `${base}/keputusan`, { problem_id: b, outcome: 'decline' })
    await post(client, owner, `${base}/keputusan`, { problem_id: a, outcome: 'defer' })
    assert.equal(await statusOf(b), 'closed')
    assert.equal(await statusOf(a), 'analysed')
    // A decision is final.
    await post(client, owner, `${base}/keputusan`, { problem_id: a, outcome: 'go' })
    assert.equal(await statusOf(a), 'analysed')

    await post(client, admin, `${base}/ubah`, {
      held_on: '2026-12-10',
      notes: 'Dua masalah dibahas.',
    })
    await post(client, admin, `${base}/selesai`)
    const held = await db.from('forum_meetings').firstOrFail()
    assert.equal(held.status, 'held')
    assert.equal(held.notes, 'Dua masalah dibahas.')
    // A held meeting's agenda is locked; the deferred problem goes on the next one.
    await post(client, admin, `${base}/agenda/hapus`, { problem_id: a })
    assert.lengthOf(await db.from('forum_decisions'), 2)
    assert.deepEqual(await actions('forum_meeting', meeting), [
      'forum_meeting.create',
      'forum_meeting.agenda_add',
      'forum_meeting.agenda_add',
      'forum_meeting.agenda_move',
      'forum_meeting.decision',
      'forum_meeting.decision',
      'forum_meeting.update',
      'forum_meeting.held',
    ])
    // View-only teams read the forum but cannot plan.
    const support = await staffSession(client, await createStaff(['support']))
    const view = await props(client, support, base)
    assert.isFalse(view.can.manage)
    assert.isFalse(view.can.decide)
    assert.equal(await postCode(client, support, '/forum', { held_on: '2026-12-24' }), 403)
  })

  test('Bank Praktik Baik credits authors; only the research team manages it', async ({
    client,
    assert,
  }) => {
    const id = await seedProblem('analysed')
    const researcher = await staffSession(client, await createStaff(['researcher']))
    await post(client, researcher, '/bank-praktik-baik', {
      title: 'Jadwal piket kelas dengan kartu warna',
      summary: 'Guru kelas 3 memakai kartu warna supaya murid tahu tugas piketnya.',
      type: 'classroom_research',
      authors: 'Siti Aminah\nBudi Santoso',
      link: 'https://contoh.test/ptk-piket',
      level: 'sd',
      year: 2025,
      problem_id: id,
    })
    const row = await db.from('good_practices').firstOrFail()
    assert.deepEqual(row.authors, ['Siti Aminah', 'Budi Santoso'])
    assert.equal(Number(row.problem_id), id)
    // Authors are required; a link must be a full URL.
    await post(client, researcher, '/bank-praktik-baik', {
      title: 'Tanpa penulis',
      summary: 'Entri ini tidak punya penulis.',
      type: 'practice',
      authors: '',
    })
    await post(client, researcher, '/bank-praktik-baik', {
      title: 'Tautan salah',
      summary: 'Entri ini punya tautan yang salah.',
      type: 'practice',
      authors: 'Siti Aminah',
      link: 'javascript:alert(1)',
    })
    assert.lengthOf(await db.from('good_practices'), 1)

    const support = await staffSession(client, await createStaff(['support']))
    const list = await props(client, support, '/bank-praktik-baik?jenis=classroom_research')
    assert.lengthOf(list.practices, 1)
    assert.isFalse(list.can.manage)
    assert.equal(await postCode(client, support, `/bank-praktik-baik/${row.id}/hapus`), 403)
    const detail = await props(client, support, `/bank-masalah/${id}`)
    assert.deepEqual(detail.practices[0].authors, ['Siti Aminah', 'Budi Santoso'])

    await post(client, researcher, `/bank-praktik-baik/${row.id}/hapus`)
    assert.lengthOf(await db.from('good_practices'), 0)
    assert.deepEqual(await actions('good_practice'), [
      'good_practice.create',
      'good_practice.delete',
    ])
  })

  test('schools never read the problem tables (RLS)', async ({ assert }) => {
    const school = await createSchool('SD Lain')
    const id = await seedProblem('new')
    await assertRlsHides(assert, school, 'problems', [id])
  })
})
