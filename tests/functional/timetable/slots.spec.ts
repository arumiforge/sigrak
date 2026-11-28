import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { createSchool, visit } from '#tests/helpers'
import { assertRlsHides, assertSchoolCannotRead, asSchool } from '#tests/tenancy'
import { cookieOf, inertiaPage, postForm, signIn } from '#tests/accounts'
import { SchoolContext } from '#tenancy/school_context'
import TimetableSlot from '../../../app/timetable/models/timetable_slot.js'
import {
  createClass,
  createTeacher,
  createYear,
  signInAs,
  useCurriculum,
} from '../school_year/fixtures.js'
import { addRow, assign, createSlot, jadwalPath, rowsOf, subjectId } from './fixtures.js'

/**
 * Jadwal per class (D-247…D-251): rows and numbering, the shared rules
 * (overlap, parallel religions, teacher from the assignments,
 * allocation, teacher clashes across the year), the Kelas page refusal,
 * warnings, locks, the teacher view, roles, and IDOR at the app and RLS
 * walls.
 */
test.group('Timetable | Jadwal per class', (group) => {
  useCurriculum(group)

  test('rows are added with their teacher; breaks have no subject; period numbers follow the times', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Jadwal')
    const year = await createYear(school)
    const homeroom = await createTeacher(school, 'Bu Ani')
    const schoolClass = await createClass(school, year, { name: '4A', grade: 4 })
    await assign(school, schoolClass, 'MTK', homeroom.user.id)
    const operator = await signInAs(client, school)

    await addRow(client, operator, schoolClass, {
      starts_at: '08:10',
      ends_at: '09:20',
      subject: 'MTK',
      jp: 2,
    })
    await addRow(client, operator, schoolClass, {
      starts_at: '07:00',
      ends_at: '07:35',
      kind: 'ceremony',
    })
    const { response } = await addRow(client, operator, schoolClass, {
      starts_at: '09:20',
      ends_at: '09:35',
      kind: 'break',
      subject: 'MTK',
      jp: 3,
    })
    assert.equal(response.header('location'), jadwalPath(schoolClass))

    const rows = await rowsOf(schoolClass)
    assert.deepEqual(
      rows.map((row) => [row.period_no, row.kind, row.code, row.jp, row.starts_at]),
      [
        [1, 'ceremony', null, 0, '07:00:00'],
        [2, 'lesson', 'MTK', 2, '08:10:00'],
        [3, 'break', null, 0, '09:20:00'],
      ]
    )

    const page = await inertiaPage(client, operator, jadwalPath(schoolClass))
    const props = page.inertiaProps
    const lesson = props.rows.find((row: { kind: string }) => row.kind === 'lesson')
    assert.include(lesson, { teacherName: 'Bu Ani', subjectName: 'Matematika', jp: 2 })
    assert.notProperty(lesson, 'id')
    const mtk = props.summary.subjects.find((row: { code: string }) => row.code === 'MTK')
    assert.include(mtk, { scheduled: 2, allocated: 5, status: 'under' })
    assert.isFalse(props.summary.complete)
  })

  test('a lesson needs a subject of the class with a teacher; times and JP are checked', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Cek')
    const year = await createYear(school)
    const schoolClass = await createClass(school, year, { name: '1A', grade: 1 })
    const operator = await signInAs(client, school)

    const cases: [Record<string, string | number>, string, string][] = [
      [
        { starts_at: '07:00', ends_at: '07:35', subject: 'MTK', jp: 1 },
        'subject',
        'Matematika belum punya guru di kelas ini. Pilih gurunya dulu di halaman kelas.',
      ],
      [
        { starts_at: '07:00', ends_at: '07:35', subject: 'IPAS', jp: 1 },
        'subject',
        'Mata pelajaran ini tidak diajarkan di kelas ini.',
      ],
      [
        { starts_at: '08:00', ends_at: '07:35', subject: 'MTK', jp: 1 },
        'ends_at',
        'Jam selesai harus sesudah jam mulai.',
      ],
      [{ starts_at: '07:00', ends_at: '07:35', jp: 1 }, 'subject', 'Pilih mata pelajaran.'],
    ]
    for (const [data, field, message] of cases) {
      const { session } = await addRow(client, operator, schoolClass, data)
      const page = await inertiaPage(client, session, jadwalPath(schoolClass))
      assert.equal(page.inertiaProps.errors[field], message, JSON.stringify(data))
    }
    assert.lengthOf(await rowsOf(schoolClass), 0)
  })

  test('rows of a class never overlap, except lessons of different religions (D-251)', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Agama')
    const year = await createYear(school)
    const islam = await createTeacher(school, 'Pak Islam')
    const kristen = await createTeacher(school, 'Bu Kristen')
    const homeroom = await createTeacher(school, 'Bu Wali')
    const schoolClass = await createClass(school, year, { name: '4A', grade: 4 })
    await assign(school, schoolClass, 'PAI', islam.user.id)
    await assign(school, schoolClass, 'PAKR', kristen.user.id)
    await assign(school, schoolClass, 'BIN', homeroom.user.id)
    const operator = await signInAs(client, school)

    const base = { starts_at: '07:00', ends_at: '08:10', jp: 2 }
    await addRow(client, operator, schoolClass, { ...base, subject: 'PAI' })
    await addRow(client, operator, schoolClass, { ...base, subject: 'PAKR' })
    assert.lengthOf(await rowsOf(schoolClass), 2)

    const { session } = await addRow(client, operator, schoolClass, {
      starts_at: '07:35',
      ends_at: '08:10',
      subject: 'BIN',
      jp: 1,
    })
    const page = await inertiaPage(client, session, jadwalPath(schoolClass))
    assert.match(page.inertiaProps.errors.starts_at, /^Bertabrakan dengan Pendidikan Agama/)
    assert.include(page.inertiaProps.errors.starts_at, 'Senin pukul 07.00 sampai 08.10')

    // The same religion twice at one time is an overlap.
    const again = await addRow(client, operator, schoolClass, { ...base, subject: 'PAI', jp: 1 })
    const againPage = await inertiaPage(client, again.session, jadwalPath(schoolClass))
    assert.match(againPage.inertiaProps.errors.starts_at, /^Bertabrakan/)

    // A break over a lesson is an overlap too.
    const pause = await addRow(client, operator, schoolClass, {
      starts_at: '08:00',
      ends_at: '08:15',
      kind: 'break',
    })
    const pausePage = await inertiaPage(client, pause.session, jadwalPath(schoolClass))
    assert.match(pausePage.inertiaProps.errors.starts_at, /^Bertabrakan/)
    assert.lengthOf(await rowsOf(schoolClass), 2)
  })

  test('JP never exceed the allocation; the timetable is complete when all counted subjects match (D-250, D-251)', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Alokasi')
    const year = await createYear(school)
    const homeroom = await createTeacher(school, 'Bu Wali')
    const pjok = await createTeacher(school, 'Pak Olahraga')
    const english = await createTeacher(school, 'Miss Inggris')
    const islam = await createTeacher(school, 'Pak Islam')
    const schoolClass = await createClass(school, year, { name: '4A', grade: 4 })
    for (const code of ['PP', 'BIN', 'MTK', 'IPAS', 'SB']) {
      await assign(school, schoolClass, code, homeroom.user.id)
    }
    await assign(school, schoolClass, 'PJOK', pjok.user.id)
    await assign(school, schoolClass, 'BIG', english.user.id)
    await assign(school, schoolClass, 'PAI', islam.user.id)
    const operator = await signInAs(client, school)

    await addRow(client, operator, schoolClass, {
      starts_at: '07:00',
      ends_at: '09:20',
      subject: 'MTK',
      jp: 4,
    })
    const { session } = await addRow(client, operator, schoolClass, {
      weekday: 2,
      starts_at: '07:00',
      ends_at: '08:10',
      subject: 'MTK',
      jp: 2,
    })
    const refused = await inertiaPage(client, session, jadwalPath(schoolClass))
    assert.equal(
      refused.inertiaProps.errors.jp,
      'Matematika jadi 6 JP, lebih dari alokasinya 5 JP per minggu.'
    )

    // Fill every subject to its allocation, one row per day and subject.
    const allocation: Record<string, number> = {
      PP: 4,
      BIN: 4,
      IPAS: 4,
      PJOK: 3,
      SB: 3,
      BIG: 2,
      PAI: 3,
    }
    let weekday = 2
    for (const [code, jp] of Object.entries(allocation)) {
      await createSlot(school, schoolClass, {
        weekday,
        startsAt: '07:00',
        endsAt: ['07:35', '08:10', '08:45', '09:20'][jp - 1],
        subject: code,
        jp,
      })
      weekday = weekday === 6 ? 2 : weekday + 1
    }
    await createSlot(school, schoolClass, {
      weekday: 1,
      startsAt: '10:00',
      endsAt: '10:35',
      subject: 'MTK',
      jp: 1,
    })
    await createSlot(school, schoolClass, {
      weekday: 1,
      startsAt: '10:35',
      endsAt: '11:00',
      subject: 'IPAS',
      jp: 1,
    })
    let page = await inertiaPage(client, operator, jadwalPath(schoolClass))
    const status = (code: string) =>
      page.inertiaProps.summary.subjects.find((row: { code: string }) => row.code === code)?.status
    assert.equal(status('BIN'), 'under')
    assert.equal(status('PAKR'), 'not_counted')
    assert.isFalse(page.inertiaProps.summary.complete)

    await createSlot(school, schoolClass, {
      weekday: 1,
      startsAt: '11:00',
      endsAt: '12:10',
      subject: 'BIN',
      jp: 2,
    })
    page = await inertiaPage(client, operator, jadwalPath(schoolClass))
    assert.equal(status('BIN'), 'complete')
    assert.equal(status('PAI'), 'complete')
    assert.isTrue(page.inertiaProps.summary.complete)
  })

  test('a teacher is never in two classes at once; another year does not count (D-248)', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Bentrok')
    const year = await createYear(school, 2026)
    const nextYear = await createYear(school, 2027)
    const pe = await createTeacher(school, 'Pak Olahraga')
    const classA = await createClass(school, year, { name: '4A', grade: 4 })
    const classB = await createClass(school, year, { name: '4B', grade: 4 })
    const classNext = await createClass(school, nextYear, { name: '4A', grade: 4 })
    for (const schoolClass of [classA, classB, classNext]) {
      await assign(school, schoolClass, 'PJOK', pe.user.id)
    }
    const operator = await signInAs(client, school)
    const row = { weekday: 3, starts_at: '07:00', ends_at: '08:10', subject: 'PJOK', jp: 2 }

    await addRow(client, operator, classA, row)
    const { session } = await addRow(client, operator, classB, {
      ...row,
      starts_at: '07:35',
      ends_at: '08:45',
    })
    const page = await inertiaPage(client, session, jadwalPath(classB))
    assert.equal(
      page.inertiaProps.errors.subject,
      'Pak Olahraga sudah mengajar di kelas 4A pada Rabu pukul 07.00 sampai 08.10.'
    )
    assert.lengthOf(await rowsOf(classB), 0)

    await addRow(client, operator, classNext, row)
    assert.lengthOf(await rowsOf(classNext), 1)
    await addRow(client, operator, classB, { ...row, starts_at: '08:10', ends_at: '09:20' })
    assert.lengthOf(await rowsOf(classB), 1)
  })

  test('the Kelas page refuses a guru mapel who would clash; a homeroom change leaves a warning', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Guru Mapel')
    const year = await createYear(school)
    const pe = await createTeacher(school, 'Pak Olahraga')
    const other = await createTeacher(school, 'Bu Lain')
    const first = await createTeacher(school, 'Bu Pertama')
    const classA = await createClass(school, year, { name: '4A', grade: 4 })
    const classB = await createClass(school, year, { name: '4B', grade: 4 })
    await assign(school, classA, 'PJOK', pe.user.id)
    await assign(school, classB, 'PJOK', other.user.id)
    await createSlot(school, classA, { startsAt: '07:00', endsAt: '08:10', subject: 'PJOK', jp: 2 })
    await createSlot(school, classB, { startsAt: '07:35', endsAt: '08:45', subject: 'PJOK', jp: 2 })
    const operator = await signInAs(client, school)

    const { session } = await postForm(
      client,
      operator,
      `/kelas/${classB.publicId}/guru-mapel`,
      { 'assignments[PJOK]': pe.membership.publicId },
      `/kelas/${classB.publicId}`
    )
    const page = await inertiaPage(client, session, `/kelas/${classB.publicId}`)
    assert.equal(
      page.inertiaProps.errors['assignments.PJOK'],
      'Pak Olahraga sudah mengajar di kelas 4A pada Senin pukul 07.00 sampai 08.10.'
    )
    const pjok = await subjectId('PJOK')
    const row = await db
      .from('teaching_assignments')
      .where({ class_id: classB.id, subject_id: pjok })
      .first()
    assert.equal(row.teacher_id, other.user.id)

    // Homeroom change: class-teacher rows move to the new homeroom teacher,
    // who already teaches at that time in 4A, so 4B shows a warning.
    await assign(school, classA, 'MTK', first.user.id)
    await createSlot(school, classA, {
      weekday: 2,
      startsAt: '07:00',
      endsAt: '07:35',
      subject: 'MTK',
    })
    await postForm(
      client,
      operator,
      `/kelas/${classB.publicId}/ubah`,
      { class_name: '4B', grade: 4, homeroom: first.membership.publicId },
      `/kelas/${classB.publicId}`
    )
    await createSlot(school, classB, {
      weekday: 2,
      startsAt: '07:00',
      endsAt: '07:35',
      subject: 'MTK',
    })
    const warned = await inertiaPage(client, operator, jadwalPath(classB))
    assert.deepEqual(warned.inertiaProps.warnings, [
      'Bu Pertama sudah mengajar di kelas 4A pada Selasa pukul 07.00 sampai 07.35.',
    ])
    const overview = await inertiaPage(client, operator, '/jadwal')
    const b = overview.inertiaProps.classes.find((item: { name: string }) => item.name === '4B')
    assert.equal(b.warningCount, 1)
    // The overview reads the year's rows once (R1-11); a clash still counts in both classes.
    const a = overview.inertiaProps.classes.find((item: { name: string }) => item.name === '4A')
    assert.equal(a.warningCount, 1)
  })

  test('rows can be changed, deleted and locked; days are renumbered', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Ubah')
    const year = await createYear(school)
    const homeroom = await createTeacher(school, 'Bu Wali')
    const schoolClass = await createClass(school, year, { name: '2A', grade: 2 })
    await assign(school, schoolClass, 'BIN', homeroom.user.id)
    const first = await createSlot(school, schoolClass, {
      startsAt: '07:00',
      endsAt: '07:35',
      subject: 'BIN',
    })
    const second = await createSlot(school, schoolClass, {
      startsAt: '07:35',
      endsAt: '08:10',
      subject: 'BIN',
    })
    const operator = await signInAs(client, school)
    const base = `${jadwalPath(schoolClass)}/${first.publicId}`

    await postForm(
      client,
      operator,
      `${base}/ubah`,
      { weekday: 1, starts_at: '08:10', ends_at: '08:45', kind: 'lesson', subject: 'BIN', jp: 1 },
      jadwalPath(schoolClass)
    )
    let rows = await rowsOf(schoolClass)
    assert.deepEqual(
      rows.map((row) => [row.period_no, row.starts_at]),
      [
        [1, '07:35:00'],
        [2, '08:10:00'],
      ]
    )

    await postForm(client, operator, `${base}/kunci`, { locked: 1 }, jadwalPath(schoolClass))
    rows = await rowsOf(schoolClass)
    assert.isTrue(rows[1].is_locked)

    await postForm(
      client,
      operator,
      `${jadwalPath(schoolClass)}/${second.publicId}/hapus`,
      {},
      jadwalPath(schoolClass)
    )
    rows = await rowsOf(schoolClass)
    assert.deepEqual(
      rows.map((row) => [row.period_no, row.starts_at, row.is_locked]),
      [[1, '08:10:00', true]]
    )

    // A row of another class of the same school is not found through this class.
    const otherClass = await createClass(school, year, { name: '2B', grade: 2 })
    const { response } = await postForm(
      client,
      operator,
      `${jadwalPath(otherClass)}/${first.publicId}/hapus`,
      {},
      jadwalPath(otherClass)
    )
    assert.equal(response.status(), 404)
  })

  test('a closed year is read-only', async ({ client, assert }) => {
    const school = await createSchool('SD Tutup')
    const year = await createYear(school)
    const homeroom = await createTeacher(school)
    const schoolClass = await createClass(school, year, { name: '3A', grade: 3 })
    await assign(school, schoolClass, 'MTK', homeroom.user.id)
    await db.from('academic_years').where('id', year.id).update({ closed_at: new Date() })
    const operator = await signInAs(client, school)
    const { session } = await addRow(client, operator, schoolClass, {
      starts_at: '07:00',
      ends_at: '07:35',
      subject: 'MTK',
      jp: 1,
    })
    const page = await inertiaPage(client, session, jadwalPath(schoolClass))
    assert.isTrue(page.inertiaProps.year.closed)
    assert.isString(page.body().flash?.error)
    assert.lengthOf(await rowsOf(schoolClass), 0)
  })

  test('Kelas Saya > Jadwal shows the teacher’s lessons and their homeroom classes', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Guru')
    const today = new Date()
    const startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1
    const year = await createYear(school, startYear)
    const teacher = await createTeacher(school, 'Bu Guru')
    const other = await createTeacher(school, 'Pak Lain')
    const classA = await createClass(school, year, {
      name: '5A',
      grade: 5,
      homeroomTeacherId: teacher.user.id,
    })
    const classB = await createClass(school, year, { name: '5B', grade: 5 })
    await assign(school, classA, 'MTK', teacher.user.id)
    await assign(school, classA, 'PJOK', other.user.id)
    await assign(school, classB, 'MTK', teacher.user.id)
    await createSlot(school, classA, { startsAt: '07:00', endsAt: '08:10', subject: 'MTK', jp: 2 })
    await createSlot(school, classA, { startsAt: '08:10', endsAt: '09:20', subject: 'PJOK', jp: 2 })
    await createSlot(school, classB, {
      weekday: 2,
      startsAt: '07:00',
      endsAt: '07:35',
      subject: 'MTK',
    })

    const session = await signIn(client, 'app', teacher.user.email)
    const page = await inertiaPage(client, session, '/kelas-saya/jadwal')
    const props = page.inertiaProps
    assert.equal(props.totalJp, 3)
    assert.deepEqual(
      props.lessons.map((row: { className: string; weekday: number }) => [
        row.weekday,
        row.className,
      ]),
      [
        [1, '5A'],
        [2, '5B'],
      ]
    )
    assert.lengthOf(props.homerooms, 1)
    assert.equal(props.homerooms[0].name, '5A')
    assert.lengthOf(props.homerooms[0].rows, 2)

    const operator = await signInAs(client, school)
    const refused = await visit(client, 'app', '/kelas-saya/jadwal', cookieOf(operator))
    assert.equal(refused.status(), 403)
  })

  test('teachers and principals cannot open or post the operator pages', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Peran Jadwal')
    const year = await createYear(school)
    const schoolClass = await createClass(school, year)
    const slot = await createSlot(school, schoolClass, {
      startsAt: '07:00',
      endsAt: '07:15',
      kind: 'break',
    })
    for (const role of ['teacher', 'principal'] as const) {
      const session = await signInAs(client, school, role)
      for (const path of ['/jadwal', '/jadwal/susun-draf', jadwalPath(schoolClass)]) {
        const page = await visit(client, 'app', path, cookieOf(session))
        assert.equal(page.status(), 403, `${role} ${path}`)
      }
      for (const path of [
        jadwalPath(schoolClass),
        `${jadwalPath(schoolClass)}/${slot.publicId}/ubah`,
        `${jadwalPath(schoolClass)}/${slot.publicId}/hapus`,
        `${jadwalPath(schoolClass)}/${slot.publicId}/kunci`,
        '/jadwal/susun-draf',
        '/jadwal/susun-draf/pengaturan',
      ]) {
        const { response } = await postForm(client, session, path, { locked: 1 }, '/akun')
        assert.equal(response.status(), 403, `${role} ${path}`)
      }
    }
    assert.lengthOf(await db.from('timetable_slots'), 1)
  })

  test('another school’s rows: 404 over HTTP, hidden by the app and RLS; no cross-school class', async ({
    client,
    assert,
  }) => {
    const schoolA = await createSchool('SD A')
    const schoolB = await createSchool('SD B')
    const yearA = await createYear(schoolA)
    const yearB = await createYear(schoolB)
    const classA = await createClass(schoolA, yearA, { name: '4A' })
    const classB = await createClass(schoolB, yearB, { name: '4B' })
    const slotB = await createSlot(schoolB, classB, {
      startsAt: '07:00',
      endsAt: '07:15',
      kind: 'break',
    })
    const operatorA = await signInAs(client, schoolA)

    const show = await visit(client, 'app', jadwalPath(classB), cookieOf(operatorA))
    assert.equal(show.status(), 404)
    for (const path of [
      jadwalPath(classB),
      `${jadwalPath(classB)}/${slotB.publicId}/ubah`,
      `${jadwalPath(classB)}/${slotB.publicId}/hapus`,
      `${jadwalPath(classB)}/${slotB.publicId}/kunci`,
      // Own class, other school's row.
      `${jadwalPath(classA)}/${slotB.publicId}/ubah`,
      `${jadwalPath(classA)}/${slotB.publicId}/hapus`,
      `${jadwalPath(classA)}/${slotB.publicId}/kunci`,
    ]) {
      const { response } = await postForm(
        client,
        operatorA,
        path,
        { weekday: 1, starts_at: '07:00', ends_at: '07:15', kind: 'break', locked: 1 },
        '/jadwal'
      )
      assert.equal(response.status(), 404, path)
    }
    const yearPage = await visit(
      client,
      'app',
      `/jadwal?tahun=${yearB.publicId}`,
      cookieOf(operatorA)
    )
    assert.equal(yearPage.status(), 404)
    const after = await db.from('timetable_slots').where('id', slotB.id).firstOrFail()
    assert.isFalse(after.is_locked)
    assert.lengthOf(await db.from('timetable_slots').where('school_id', schoolA.id), 0)

    await assertSchoolCannotRead(assert, schoolA, () => TimetableSlot.find(slotB.id))
    await assertSchoolCannotRead(assert, schoolA, () =>
      TimetableSlot.query().where('class_id', classB.id)
    )
    await assertRlsHides(assert, schoolA, 'timetable_slots', [slotB.id])

    // A row can never point at another school's class (composite foreign key).
    await assert.rejects(
      () =>
        db.table('timetable_slots').insert({
          public_id: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c',
          school_id: schoolA.id,
          class_id: classB.id,
          weekday: 1,
          period_no: 1,
          starts_at: '07:00',
          ends_at: '07:15',
          kind: 'break',
          jp: 0,
          created_at: new Date(),
          updated_at: new Date(),
        }),
      /timetable_slots_class_school_foreign/
    )
    // Under RLS, school A cannot write a row for school B either.
    const updated = await asSchool(schoolA, async () => {
      const trx = SchoolContext.current()!.trx!
      const result = await trx.rawQuery(
        'UPDATE timetable_slots SET is_locked = true WHERE id = ?',
        [slotB.id]
      )
      return result.rowCount as number
    })
    assert.equal(updated, 0)
  })

  test('database checks keep rows consistent (D-247)', async ({ assert }) => {
    const school = await createSchool('SD Cek DB')
    const year = await createYear(school)
    const schoolClass = await createClass(school, year)
    await assert.rejects(
      () => createSlot(school, schoolClass, { startsAt: '07:35', endsAt: '07:00', kind: 'break' }),
      /timetable_slots_times_check/
    )
    const mtk = await subjectId('MTK')
    await assert.rejects(
      () =>
        asSchool(school, () =>
          TimetableSlot.create({
            classId: schoolClass.id,
            weekday: 1,
            periodNo: 1,
            startsAt: '07:00',
            endsAt: '07:15',
            kind: 'break',
            label: null,
            subjectId: mtk,
            jp: 0,
            isLocked: false,
          })
        ),
      /timetable_slots_lesson_check/
    )
    await assert.rejects(
      () =>
        asSchool(school, () =>
          TimetableSlot.create({
            classId: schoolClass.id,
            weekday: 7,
            periodNo: 1,
            startsAt: '07:00',
            endsAt: '07:15',
            kind: 'break',
            label: null,
            subjectId: null,
            jp: 0,
            isLocked: false,
          })
        ),
      /timetable_slots_weekday_check/
    )
  })
})
