import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { createSchool } from '#tests/helpers'
import { assertRlsHides, assertSchoolCannotRead, asSchool } from '#tests/tenancy'
import { inertiaPage, postForm, cookieOf } from '#tests/accounts'
import { visit } from '#tests/helpers'
import AcademicYear from '../../../app/school_year/models/academic_year.js'
import { currentYear, suggestedDates } from '../../../app/school_year/academic_years.js'
import { createClass, createYear, signInAs, useCurriculum } from './fixtures.js'

/**
 * Tahun Ajaran (D-241, D-318): the name follows the start date, at most
 * 12 months, no overlap, the form suggests the next year, a year with
 * classes cannot be deleted, a closed year is read-only; operator only;
 * another school's year is a 404 and hidden by RLS.
 */
const YEAR_2027 = {
  starts_on: '2027-07-01',
  even_semester_starts_on: '2028-01-01',
  ends_on: '2028-06-30',
}

test.group('School year | academic years', (group) => {
  useCurriculum(group)

  test('the operator adds a year; its name follows the start date', async ({ client, assert }) => {
    const school = await createSchool('SD Tahun')
    const operator = await signInAs(client, school)

    const { response, session } = await postForm(client, operator, '/tahun-ajaran', {
      starts_on: '2026-07-13',
      even_semester_starts_on: '2027-01-04',
      ends_on: '2027-06-26',
    })
    assert.equal(response.header('location'), '/tahun-ajaran')

    const year = await asSchool(school, () => AcademicYear.query().firstOrFail())
    assert.equal(year.name, '2026/2027')
    assert.equal(year.startsOn.toISODate(), '2026-07-13')
    assert.equal(year.schoolId, school.id)

    const page = await inertiaPage(client, session, '/tahun-ajaran')
    assert.equal(page.body().flash?.success, 'Tahun ajaran 2026/2027 sudah ditambahkan.')
    assert.lengthOf(page.inertiaProps.years, 1)
    assert.notProperty(page.inertiaProps.years[0], 'id')
    // The form suggests the year after the latest one (1 July – 30 June).
    assert.deepEqual(page.inertiaProps.suggestion, {
      name: '2027/2028',
      startsOn: '2027-07-01',
      evenSemesterStartsOn: '2028-01-01',
      endsOn: '2028-06-30',
    })
    assert.equal(page.inertiaProps.levelTerms.homeroomTeacherTerm, 'Guru kelas')
  })

  test('dates out of order, over 12 months, overlapping or a taken name are refused', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Tanggal')
    await createYear(school, 2026)
    const operator = await signInAs(client, school)

    const cases: [Record<string, string>, string, string][] = [
      [
        { ...YEAR_2027, even_semester_starts_on: '2027-06-01' },
        'even_semester_starts_on',
        'Semester 2 harus mulai setelah tanggal mulai.',
      ],
      [
        { ...YEAR_2027, ends_on: '2027-12-01' },
        'ends_on',
        'Tanggal selesai harus setelah semester 2 mulai.',
      ],
      [
        { ...YEAR_2027, ends_on: '2028-07-01' },
        'ends_on',
        'Satu tahun ajaran paling lama 12 bulan.',
      ],
      [
        { ...YEAR_2027, starts_on: '2027-06-15', ends_on: '2028-06-10' },
        'starts_on',
        'Tanggal ini bertabrakan dengan tahun ajaran 2026/2027.',
      ],
      [
        { starts_on: '2026-01-01', even_semester_starts_on: '2026-03-01', ends_on: '2026-06-30' },
        'starts_on',
        'Tahun ajaran 2026/2027 sudah ada.',
      ],
      [{ ...YEAR_2027, starts_on: 'besok' }, 'starts_on', 'Tulis tanggal yang benar'],
    ]
    for (const [data, field, message] of cases) {
      const { session } = await postForm(client, operator, '/tahun-ajaran', data)
      const page = await inertiaPage(client, session, '/tahun-ajaran')
      assert.include(page.inertiaProps.errors[field] ?? '', message, JSON.stringify(data))
    }
    assert.lengthOf(await asSchool(school, () => AcademicYear.all()), 1)
  })

  test('the database refuses overlapping years, wrong names and long years too', async ({
    assert,
  }) => {
    const school = await createSchool('SD Dinding')
    await createYear(school, 2026)
    const insert = (values: Record<string, string>) =>
      db.table('academic_years').insert({
        public_id: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
        school_id: school.id,
        created_at: new Date(),
        updated_at: new Date(),
        ...values,
      })

    await assert.rejects(
      () =>
        insert({
          name: '2027/2028',
          starts_on: '2027-06-01',
          even_semester_starts_on: '2028-01-01',
          ends_on: '2028-05-31',
        }),
      /academic_years_no_overlap/
    )
    await assert.rejects(
      () =>
        insert({
          name: '2030/2031',
          starts_on: '2027-07-01',
          even_semester_starts_on: '2028-01-01',
          ends_on: '2028-06-30',
        }),
      /academic_years_name_check/
    )
    await assert.rejects(
      () =>
        insert({
          name: '2027/2028',
          starts_on: '2027-07-01',
          even_semester_starts_on: '2028-01-01',
          ends_on: '2028-07-01',
        }),
      /academic_years_at_most_a_year_check/
    )
  })

  test('changing dates renames the year; a year with classes cannot be deleted', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Ubah')
    const year = await createYear(school, 2026)
    const empty = await createYear(school, 2027)
    await createClass(school, year)
    const operator = await signInAs(client, school)

    const edit = await inertiaPage(client, operator, `/tahun-ajaran/${empty.publicId}/ubah`)
    assert.equal(edit.inertiaProps.year.name, '2027/2028')

    await postForm(
      client,
      operator,
      `/tahun-ajaran/${empty.publicId}/ubah`,
      { starts_on: '2028-07-01', even_semester_starts_on: '2029-01-01', ends_on: '2029-06-30' },
      `/tahun-ajaran/${empty.publicId}/ubah`
    )
    const renamed = await asSchool(school, () => AcademicYear.findOrFail(empty.id))
    assert.equal(renamed.name, '2028/2029')

    const { session } = await postForm(
      client,
      operator,
      `/tahun-ajaran/${year.publicId}/hapus`,
      {},
      '/tahun-ajaran'
    )
    const page = await inertiaPage(client, session, '/tahun-ajaran')
    assert.equal(
      page.body().flash?.error,
      'Tahun ajaran 2026/2027 masih punya kelas. Hapus kelasnya dulu.'
    )
    assert.isNotNull(await asSchool(school, () => AcademicYear.find(year.id)))
    // The database keeps the rule too (RESTRICT).
    await assert.rejects(() => db.from('academic_years').where('id', year.id).delete())

    await postForm(client, operator, `/tahun-ajaran/${empty.publicId}/hapus`, {}, '/tahun-ajaran')
    assert.isNull(await asSchool(school, () => AcademicYear.find(empty.id)))
  })

  test('the current year holds today, else the next one, else the latest', ({ assert }) => {
    const year = (start: string, end: string) => ({
      name: start,
      startsOn: DateTime.fromISO(start),
      evenSemesterStartsOn: DateTime.fromISO(start).plus({ months: 6 }),
      endsOn: DateTime.fromISO(end),
    })
    const a = year('2025-07-01', '2026-06-30')
    const b = year('2026-07-13', '2027-06-26')
    const today = (date: string) => DateTime.fromISO(date)

    assert.equal(currentYear([b, a], today('2026-03-01'))?.name, a.name)
    assert.equal(currentYear([a, b], today('2026-07-05'))?.name, b.name)
    assert.equal(currentYear([a, b], today('2027-08-01'))?.name, b.name)
    assert.isNull(currentYear([], today('2027-08-01')))

    // With no year yet, the form suggests the school year that holds today.
    assert.equal(suggestedDates(null, today('2026-03-01')).startsOn.toISODate(), '2025-07-01')
    assert.equal(suggestedDates(null, today('2026-08-01')).startsOn.toISODate(), '2026-07-01')
    // A year that ends after 30 June pushes the suggestion past its end.
    assert.equal(
      suggestedDates(year('2026-07-13', '2027-07-10'), today('2026-08-01')).startsOn.toISODate(),
      '2027-07-11'
    )
  })

  test('a closed year is read-only', async ({ client, assert }) => {
    const school = await createSchool('SD Arsip')
    const year = await createYear(school, 2025)
    await db.from('academic_years').where('id', year.id).update({ closed_at: new Date() })
    const operator = await signInAs(client, school)

    const { session } = await postForm(
      client,
      operator,
      `/tahun-ajaran/${year.publicId}/ubah`,
      { starts_on: '2025-07-02', even_semester_starts_on: '2026-01-01', ends_on: '2026-06-30' },
      `/tahun-ajaran/${year.publicId}/ubah`
    )
    const page = await inertiaPage(client, session, '/tahun-ajaran')
    assert.equal(
      page.body().flash?.error,
      'Tahun ajaran 2025/2026 sudah ditutup, jadi tidak bisa diubah.'
    )
    assert.isTrue(page.inertiaProps.years[0].closed)

    await postForm(
      client,
      operator,
      '/kelas',
      { year: year.publicId, class_name: '1A', grade: 1 },
      `/kelas?tahun=${year.publicId}`
    )
    const fresh = await asSchool(school, () => AcademicYear.findOrFail(year.id))
    assert.equal(fresh.startsOn.toISODate(), '2025-07-01')
    assert.lengthOf(await db.from('classes').where('academic_year_id', year.id), 0)
  })

  test('teachers and principals cannot open or post Tahun Ajaran', async ({ client, assert }) => {
    const school = await createSchool('SD Peran')
    const year = await createYear(school, 2026)
    for (const role of ['teacher', 'principal'] as const) {
      const session = await signInAs(client, school, role)
      const page = await visit(client, 'app', '/tahun-ajaran', cookieOf(session))
      assert.equal(page.status(), 403, role)
      const edit = await visit(
        client,
        'app',
        `/tahun-ajaran/${year.publicId}/ubah`,
        cookieOf(session)
      )
      assert.equal(edit.status(), 403, role)
      for (const path of [
        '/tahun-ajaran',
        `/tahun-ajaran/${year.publicId}/ubah`,
        `/tahun-ajaran/${year.publicId}/hapus`,
        `/tahun-ajaran/${year.publicId}/salin-kelas`,
      ]) {
        const { response } = await postForm(client, session, path, YEAR_2027, '/akun')
        assert.equal(response.status(), 403, `${role} ${path}`)
      }
    }
    assert.lengthOf(await db.from('academic_years'), 1)
  })

  test('another school’s year is a 404 and hidden by RLS', async ({ client, assert }) => {
    const schoolA = await createSchool('SD A')
    const schoolB = await createSchool('SD B')
    const yearB = await createYear(schoolB, 2026)
    const operatorA = await signInAs(client, schoolA)

    const edit = await visit(
      client,
      'app',
      `/tahun-ajaran/${yearB.publicId}/ubah`,
      cookieOf(operatorA)
    )
    assert.equal(edit.status(), 404)
    for (const path of [
      `/tahun-ajaran/${yearB.publicId}/ubah`,
      `/tahun-ajaran/${yearB.publicId}/hapus`,
      `/tahun-ajaran/${yearB.publicId}/salin-kelas`,
    ]) {
      const { response } = await postForm(client, operatorA, path, YEAR_2027, '/tahun-ajaran')
      assert.equal(response.status(), 404, path)
    }
    const page = await inertiaPage(client, operatorA, '/tahun-ajaran')
    assert.lengthOf(page.inertiaProps.years, 0)
    const fresh = await asSchool(schoolB, () => AcademicYear.findOrFail(yearB.id))
    assert.equal(fresh.name, '2026/2027')

    await assertSchoolCannotRead(assert, schoolA, () => AcademicYear.find(yearB.id))
    await assertSchoolCannotRead(assert, schoolA, () =>
      AcademicYear.query().where('public_id', yearB.publicId)
    )
    await assertRlsHides(assert, schoolA, 'academic_years', [yearB.id])
    // The same dates in another school are fine: years overlap only within a school.
    await createYear(schoolA, 2026)
  })
})
