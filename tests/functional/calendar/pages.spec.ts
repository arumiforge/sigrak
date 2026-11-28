import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { hosts } from '#config/hosts'
import { holidayKey } from '#calendar/keys'
import { createCalendar } from '#tests/helpers'
import { assertRlsHides, createMember } from '#tests/tenancy'
import {
  JATENG_CODE,
  calendarFixtures,
  createClassIn,
  createJatengYear,
  deferredCalendar,
  changesFor,
  flashError,
  flashOf,
  get,
  member,
  post,
  sessionFor,
  staff,
} from '#tests/calendar'

async function ownItems(schoolId: number) {
  return db
    .from('calendar_items as i')
    .join('layer_packages as p', 'p.id', 'i.package_id')
    .where('p.school_id', schoolId)
    .select('i.*')
    .orderBy('i.id')
}

test.group('Calendar | Kalender for every role', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.timeout(60_000)

  test('the first render sends the shell and defers the calendar', async ({ client, assert }) => {
    const { sdJati } = await calendarFixtures()
    const teacher = await member(client, sdJati, 'teacher')

    const page = await get(client, teacher.session, '/kalender').withInertia()
    page.assertStatus(200)
    page.assertInertiaComponent('school/calendar')
    assert.equal(page.inertiaProps.school.name, 'SD Uji Jati')
    assert.equal(page.inertiaProps.year.name, '2026/2027')
    assert.notProperty(page.inertiaProps, 'entries')
    assert.sameMembers(page.body().deferredProps.default, [
      'entries',
      'hidden',
      'frame',
      'effective',
      'changes',
    ])
    assert.equal(page.inertiaProps.messages['calendar.title'], 'Kalender')
    assert.equal(page.inertiaProps.messages['layers.badge.sigrak'], 'Bawaan SIGRAK')
    assert.isFalse(page.inertiaProps.canEdit)
    assert.isTrue(page.inertiaProps.canPropose)
  })

  test('the full HTML page renders for a direct visit', async ({ client }) => {
    const { sdJati } = await calendarFixtures()
    const teacher = await member(client, sdJati, 'teacher')
    const page = await get(client, teacher.session, '/kalender')
    page.assertStatus(200)
    page.assertHeader('content-type', 'text/html; charset=utf-8')
    page.assertTextIncludes('school\\/calendar')
  })

  test('every row names its source; another school’s events never show (IDOR)', async ({
    client,
    assert,
  }) => {
    const { sdJati, sdDawe } = await calendarFixtures()
    await createCalendar(sdJati, ['Rapat guru Jati'])
    await createCalendar(sdDawe, ['Rahasia sekolah Dawe'])
    const teacher = await member(client, sdJati, 'teacher')

    const props = await deferredCalendar(client, teacher.session)
    const titles = props.entries.map((entry) => entry.title)
    assert.include(titles, 'Rapat guru Jati')
    assert.notInclude(titles, 'Rahasia sekolah Dawe')

    const holiday = props.entries.find((entry) => entry.key === 'HOL-2026-08-17-national_holiday')!
    assert.equal(holiday.source.layer, 'national')
    assert.equal(holiday.source.force, 'mandatory')
    const tka = props.entries.find((entry) => entry.title.includes('TKA'))!
    assert.equal(tka.source.layer, 'province')
    assert.equal(tka.source.regionName, 'Jawa Tengah')
    assert.isTrue(props.entries.find((entry) => entry.title === 'Rapat guru Jati')!.own)

    assert.lengthOf(props.hidden, 5)
    assert.isTrue(props.hidden.every((entry) => entry.kind === 'joint_leave'))
    assert.isTrue(props.frame.ready)
    assert.equal(props.frame.startsOn, '2026-07-13')
  })

  test('the operator adds, changes and deletes own events; a Sunday only warns', async ({
    client,
    assert,
  }) => {
    const { sdJati } = await calendarFixtures()
    const operator = await member(client, sdJati, 'operator')
    const year = await createJatengYear(sdJati)

    const added = await post(client, operator.session, '/kalender/acara', {
      year: year.publicId,
      kind: 'school_event',
      title: 'Jalan sehat keluarga',
      starts_on: '2026-08-16',
    })
    added.assertStatus(302)
    const flash = await flashOf(client, operator.session)
    assert.match(
      flash.success ?? '',
      /^Acara ditambahkan ke kalender sekolah\. Perhatian: 16\/08\/2026 hari Minggu/
    )

    const [row] = await ownItems(sdJati.id)
    assert.equal(row.title, 'Jalan sehat keluarga')
    assert.equal(row.origin, 'school')

    const changed = await post(client, operator.session, `/kalender/acara/${row.item_key}/ubah`, {
      year: year.publicId,
      kind: 'school_event',
      title: 'Jalan sehat keluarga besar',
      starts_on: '2026-08-15',
    })
    changed.assertStatus(302)
    let rows = await ownItems(sdJati.id)
    assert.deepEqual(
      rows.map((item) => [item.item_key, item.revision, item.status, item.title]),
      [
        [row.item_key, 1, 'retired', 'Jalan sehat keluarga'],
        [row.item_key, 2, 'active', 'Jalan sehat keluarga besar'],
      ]
    )

    const deleted = await post(client, operator.session, `/kalender/acara/${row.item_key}/hapus`, {
      year: year.publicId,
    })
    deleted.assertStatus(302)
    rows = await ownItems(sdJati.id)
    assert.isTrue(rows.every((item) => item.status === 'retired'))
  })

  test('STS on a national holiday, or outside the year, is refused (D-260)', async ({
    client,
    assert,
  }) => {
    const { sdJati } = await calendarFixtures()
    const operator = await member(client, sdJati, 'operator')

    await post(client, operator.session, '/kalender/acara', {
      kind: 'exam',
      exam_type: 'sts',
      title: 'Sumatif Tengah Semester',
      starts_on: '2026-08-15',
      ends_on: '2026-08-19',
    })
    assert.equal(
      await flashError(client, operator.session),
      'STS atau SAS tidak bisa pada hari libur nasional atau cuti bersama: 17/08/2026 (Proklamasi Kemerdekaan).'
    )
    await post(client, operator.session, '/kalender/acara', {
      kind: 'school_event',
      title: 'Sebelum tahun ajaran',
      starts_on: '2026-07-06',
    })
    assert.equal(
      await flashError(client, operator.session),
      'Tanggal harus di dalam tahun ajaran (13/07/2026 sampai 19/06/2027).'
    )
    assert.lengthOf(await ownItems(sdJati.id), 0)
  })

  test('the operator keeps a joint-leave day open and takes it back', async ({
    client,
    assert,
  }) => {
    const { sdJati } = await calendarFixtures()
    const operator = await member(client, sdJati, 'operator')
    const key = holidayKey('2027-03-12', 'joint_leave')

    await post(client, operator.session, `/kalender/${key}/tidak-dipakai`, { reason: 'Dinas' })
    let props = await deferredCalendar(client, operator.session)
    assert.equal(props.effective.total.effectiveDays, 255)
    assert.isTrue(props.hidden.some((entry) => entry.key === key && entry.hiddenBy.own))

    await post(client, operator.session, `/kalender/${key}/pakai-lagi`)
    props = await deferredCalendar(client, operator.session)
    assert.equal(props.effective.total.effectiveDays, 254)

    // A national holiday cannot be hidden.
    await post(client, operator.session, '/kalender/HOL-2026-08-17-national_holiday/tidak-dipakai')
    assert.equal(
      await flashError(client, operator.session),
      'Wajib secara nasional, tidak bisa disembunyikan.'
    )
  })

  test('teachers propose; the operator approves on Usulan and the event appears (D-380)', async ({
    client,
    assert,
  }) => {
    const { sdJati } = await calendarFixtures()
    const operator = await member(client, sdJati, 'operator')
    const teacher = await member(client, sdJati, 'teacher')
    const year = await createJatengYear(sdJati)
    const fourA = await createClassIn(sdJati, year.id)

    const direct = await post(client, teacher.session, '/kalender/acara', {
      kind: 'school_event',
      title: 'Langsung',
      starts_on: '2026-10-14',
    })
    direct.assertStatus(403)

    const sent = await post(client, teacher.session, '/kalender/usulan', {
      year: year.publicId,
      action: 'add',
      kind: 'no_lessons',
      title: 'Karyawisata kelas 4A',
      starts_on: '2026-10-14',
      class: fourA.publicId,
      reason: 'Kunjungan museum',
    })
    sent.assertStatus(302)
    // Checked when sent: STS on a holiday never reaches the operator.
    await post(client, teacher.session, '/kalender/usulan', {
      action: 'add',
      kind: 'exam',
      exam_type: 'sas',
      title: 'SAS',
      starts_on: '2026-08-17',
    })
    assert.match((await flashError(client, teacher.session)) ?? '', /^STS atau SAS/)

    const proposals = await db.from('layer_proposals').where('domain', 'calendar')
    assert.lengthOf(proposals, 1)
    assert.equal(proposals[0].status, 'submitted')
    assert.equal(proposals[0].payload.item.class_id, fourA.id)

    const approved = await post(
      client,
      operator.session,
      `/usulan/${proposals[0].public_id}/setujui`
    )
    approved.assertStatus(302)
    const props = await deferredCalendar(
      client,
      operator.session,
      `?tahun=${year.publicId}&kelas=${fourA.publicId}`
    )
    const trip = props.entries.find((entry) => entry.title === 'Karyawisata kelas 4A')!
    assert.deepEqual(trip.class, { id: fourA.publicId, name: '4A' })
    assert.equal(props.effective.total.effectiveDays, 253)

    // The teacher proposes deleting it; the principal proposes a change.
    const retire = await post(client, teacher.session, '/kalender/usulan', {
      year: year.publicId,
      action: 'retire',
      item_key: trip.key,
    })
    retire.assertStatus(302)
    const principal = await member(client, sdJati, 'principal')
    const revise = await post(client, principal.session, '/kalender/usulan', {
      year: year.publicId,
      action: 'revise',
      item_key: trip.key,
      kind: 'no_lessons',
      title: 'Karyawisata kelas 4A ke museum',
      starts_on: '2026-10-15',
      class: fourA.publicId,
    })
    revise.assertStatus(302)
    const open = await db
      .from('layer_proposals')
      .where('domain', 'calendar')
      .where('status', 'submitted')
      .orderBy('id')
    assert.deepEqual(
      open.map((row) => row.action),
      ['retire', 'revise']
    )

    // Approving the change makes a new revision of the same item.
    await post(client, operator.session, `/usulan/${open[1].public_id}/setujui`)
    const rows = await db
      .from('calendar_items')
      .where('item_key', trip.key)
      .orderBy('revision')
      .select('revision', 'status', 'starts_on')
    assert.deepEqual(
      rows.map((row) => [row.revision, row.status]),
      [
        [1, 'retired'],
        [2, 'active'],
      ]
    )
  })

  test('a class of another school is refused; another school’s year is a 404', async ({
    client,
    assert,
  }) => {
    const { sdJati, sdDawe } = await calendarFixtures()
    const operator = await member(client, sdJati, 'operator')
    const daweYear = await createJatengYear(sdDawe)
    const daweClass = await createClassIn(sdDawe, daweYear.id)
    await createJatengYear(sdJati)

    await post(client, operator.session, '/kalender/acara', {
      kind: 'no_lessons',
      title: 'Kelas sekolah lain',
      starts_on: '2026-10-14',
      class: daweClass.publicId,
    })
    assert.equal(
      await flashError(client, operator.session),
      'Kelas ini tidak ada di tahun ajaran yang dipilih.'
    )
    assert.lengthOf(await ownItems(sdJati.id), 0)

    const page = await get(client, operator.session, `/kalender?tahun=${daweYear.publicId}`)
    page.assertStatus(404)
  })

  test('school B cannot change or delete school A’s events, at app and RLS level', async ({
    client,
    assert,
  }) => {
    const { sdJati, sdDawe } = await calendarFixtures()
    const own = await createCalendar(sdJati, ['Acara Jati'])
    const [row] = await ownItems(sdJati.id)
    const daweOperator = await member(client, sdDawe, 'operator')

    await post(client, daweOperator.session, `/kalender/acara/${row.item_key}/hapus`)
    assert.equal(
      await flashError(client, daweOperator.session),
      'Hanya tambahan milik sendiri yang bisa dihapus atau diubah.'
    )
    await post(client, daweOperator.session, `/kalender/acara/${row.item_key}/ubah`, {
      kind: 'school_event',
      title: 'Diubah Dawe',
      starts_on: '2026-10-14',
    })
    const after = await db.from('calendar_items').where('id', row.id).first()
    assert.equal(after.status, 'active')
    assert.equal(after.title, 'Acara Jati')

    await assertRlsHides(assert, sdDawe, 'calendar_items', own.itemIds)
    await assertRlsHides(assert, sdDawe, 'layer_packages', [own.packageId])

    // Snapshots are school-owned too.
    const jatiTeacher = await member(client, sdJati, 'teacher')
    await deferredCalendar(client, jatiTeacher.session)
    const snapshots = await db.from('calendar_snapshots').where('school_id', sdJati.id).select('id')
    assert.lengthOf(snapshots, 1)
    await assertRlsHides(
      assert,
      sdDawe,
      'calendar_snapshots',
      snapshots.map((snapshot) => snapshot.id)
    )
  })

  test('an official change shows the operator its impact and teachers the moved days', async ({
    client,
    assert,
  }) => {
    const { sdJati } = await calendarFixtures()
    const operator = await member(client, sdJati, 'operator')
    const teacher = await member(client, sdJati, 'teacher')
    // First visits store the snapshots: nothing to show.
    assert.isNull(await changesFor(client, operator.session))
    assert.isNull(await changesFor(client, teacher.session))

    // The province adds a holiday (published by staff; it applies directly, D-466).
    const pkg = await db.from('layer_packages').where('code', JATENG_CODE).first()
    const now = new Date()
    await db.table('calendar_items').insert({
      package_id: pkg.id,
      item_key: 'EV-2026-10-20-uji',
      shape: 'list',
      force: 'mandatory',
      origin: 'official',
      match_key: 'uji-libur',
      kind: 'holiday',
      title: 'Libur tambahan provinsi',
      starts_on: '2026-10-20',
      ends_on: '2026-10-20',
      created_at: now,
      updated_at: now,
    })

    const forOperator = (await changesFor(client, operator.session))!
    assert.deepEqual(
      forOperator.area.added.map((item) => item.title),
      ['Libur tambahan provinsi']
    )
    assert.deepEqual(forOperator.effectiveDays, { before: 254, after: 253 })
    const forTeacher = (await changesFor(client, teacher.session))!
    assert.deepEqual(
      forTeacher.days.nowOff.map((day) => day.date),
      ['2026-10-20']
    )

    const read = await post(client, teacher.session, '/kalender/perubahan/dibaca')
    read.assertStatus(302)
    assert.isNull(await changesFor(client, teacher.session))
    assert.isNotNull(await changesFor(client, operator.session))
  })

  test('a user without an active school sees an empty calendar', async ({ client, assert }) => {
    const { sdJati } = await calendarFixtures()
    const fixture = await createMember(sdJati, 'teacher')
    await db.from('school_memberships').where('id', fixture.membership.id).update({
      status: 'ended',
      ended_on: '2026-08-01',
    })
    const session = await sessionFor(client, 'app', fixture.user.email)
    const page = await get(client, session, '/kalender').withInertia()
    page.assertStatus(200)
    assert.isNull(page.inertiaProps.school)
  })
})

test.group('Calendar | staff console', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.timeout(60_000)

  test('staff see the D-254 check and import as draft; only an admin activates', async ({
    client,
    assert,
  }) => {
    const { sdJati } = await calendarFixtures({ activate: false })
    await db.from('layer_packages').where('domain', 'calendar').delete()
    const support = await staff(client, 'support')

    const page = await get(client, support.session, '/kalender').withInertia()
    page.assertStatus(200)
    page.assertInertiaComponent('admin/calendar')
    const files = page.inertiaProps.files as { file: string; ok: boolean; kind: string }[]
    assert.deepEqual(
      files.map((file) => [file.file, file.kind, file.ok]),
      [
        ['national-holidays-2026-2027.json', 'holidays', true],
        ['region-jawa-tengah-2026-2027.json', 'region', true],
      ]
    )
    assert.isFalse(page.inertiaProps.canActivate)

    const imported = await post(client, support.session, '/kalender/impor', {
      file: 'national-holidays-2026-2027.json',
    })
    imported.assertStatus(302)
    // Only file names of the data folder; no paths.
    const sneaky = await post(client, support.session, '/kalender/impor', { file: '../../.env' })
    sneaky.assertStatus(302)
    const packages = await db.from('layer_packages').where('domain', 'calendar')
    assert.lengthOf(packages, 1)
    assert.equal(packages[0].status, 'draft')

    const refused = await post(
      client,
      support.session,
      `/kalender/paket/${packages[0].public_id}/aktifkan`
    )
    refused.assertStatus(403)

    const admin = await staff(client, 'admin')
    const activated = await post(
      client,
      admin.session,
      `/kalender/paket/${packages[0].public_id}/aktifkan`
    )
    activated.assertStatus(302)
    const active = await db.from('layer_packages').where('id', packages[0].id).first()
    assert.equal(active.status, 'active')
    assert.equal(Number(active.approved_by_staff_id), admin.account.id)

    // The school sees it at once.
    const teacher = await member(client, sdJati, 'teacher')
    const props = await deferredCalendar(client, teacher.session)
    assert.isTrue(props.entries.some((entry) => entry.key === 'HOL-2026-08-17-national_holiday'))
  })

  test('the console needs a staff sign-in', async ({ client }) => {
    await calendarFixtures()
    const response = await client.get('/kalender').header('host', hosts.admin).redirects(0)
    response.assertStatus(302)
  })
})
