import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { createSchool } from '#tests/helpers'
import { inertiaPage, postForm } from '#tests/accounts'
import { movedUpName, planCopy } from '../../../app/school_year/copy_classes.js'
import {
  classesOf,
  createClass,
  createTeacher,
  createYear,
  signInAs,
  useCurriculum,
} from './fixtures.js'

/**
 * Copy classes into a new academic year (D-242…D-246).
 */
test.group('School year | copy classes: rules', () => {
  test('names that start with the grade follow it; other names stay', ({ assert }) => {
    assert.equal(movedUpName('4A', 4), '5A')
    assert.equal(movedUpName('4 B', 4), '5 B')
    assert.equal(movedUpName('4-Umar', 4), '5-Umar')
    assert.equal(movedUpName('Kelas Merah', 4), 'Kelas Merah')
    // Only the class's own grade number counts, and not as part of a longer number.
    assert.equal(movedUpName('41 Bintang', 4), '41 Bintang')
    assert.equal(movedUpName('3A', 4), '3A')
  })

  test('grade 6 graduates, grade 1 is made again on request, clashes get the grade', ({
    assert,
  }) => {
    const source = [
      { name: '6A', grade: 6, artBranch: null },
      { name: 'Kelas Merah', grade: 1, artBranch: 'music' as const },
      { name: '1A', grade: 1, artBranch: null },
      { name: 'Kelas Merah', grade: 2, artBranch: null },
      { name: 'Kelas Pelangi Bintang Pagi'.slice(0, 20), grade: 3, artBranch: null },
      { name: 'Kelas Pelangi Bintang Pagi'.slice(0, 20), grade: 4, artBranch: null },
    ]
    const names = (rows: ReturnType<typeof planCopy>) =>
      rows.map((row) => `${row.grade}:${row.name}`)

    assert.deepEqual(names(planCopy(source, false)), [
      '2:2A',
      '2:Kelas Merah',
      '3:Kelas Merah 3',
      '4:Kelas Pelangi Bintan',
      '5:Kelas Pelangi Bint 5',
    ])
    const withGradeOne = planCopy(source, true)
    assert.deepEqual(names(withGradeOne).slice(5), ['1:1A', '1:Kelas Merah 1'])
    assert.isTrue(withGradeOne.every((row) => row.name.length <= 20))
    assert.equal(withGradeOne[1].artBranch, 'music')
  })
})

test.group('School year | copy classes', (group) => {
  useCurriculum(group)

  async function schoolWithLastYear() {
    const school = await createSchool('SD Salin')
    const last = await createYear(school, 2025)
    const teacher = await createTeacher(school)
    await createClass(school, last, { name: '1A', grade: 1, artBranch: 'dance' })
    await createClass(school, last, { name: '1B', grade: 1 })
    await createClass(school, last, {
      name: '4A',
      grade: 4,
      artBranch: 'music',
      homeroomTeacherId: teacher.user.id,
    })
    await createClass(school, last, { name: '6A', grade: 6 })
    return { school, last }
  }

  test('copying moves classes up a grade, without teachers or assignments', async ({
    client,
    assert,
  }) => {
    const { school } = await schoolWithLastYear()
    const target = await createYear(school, 2026)
    const operator = await signInAs(client, school)

    const page = await inertiaPage(client, operator, '/tahun-ajaran')
    const row = page.inertiaProps.years.find(
      (year: { publicId: string }) => year.publicId === target.publicId
    )
    assert.equal(row.copy.sourceName, '2025/2026')
    assert.deepEqual(
      row.copy.withGradeOne.map((item: { name: string }) => item.name),
      ['2A', '2B', '5A', '1A', '1B']
    )

    const { response, session } = await postForm(
      client,
      operator,
      `/tahun-ajaran/${target.publicId}/salin-kelas`,
      { include_grade_one: 'on' },
      '/tahun-ajaran'
    )
    assert.equal(response.header('location'), `/kelas?tahun=${target.publicId}`)
    const after = await inertiaPage(client, session, `/kelas?tahun=${target.publicId}`)
    assert.equal(after.body().flash?.success, '5 kelas dari 2025/2026 sudah disalin ke 2026/2027.')

    const copied = await classesOf(school, target)
    assert.deepEqual(
      copied.map((item) => [item.grade, item.name, item.artBranch, item.homeroomTeacherId]),
      [
        [1, '1A', 'dance', null],
        [1, '1B', null, null],
        [2, '2A', 'dance', null],
        [2, '2B', null, null],
        [5, '5A', 'music', null],
      ]
    )
    assert.lengthOf(
      await db.from('teaching_assignments').whereIn(
        'class_id',
        copied.map((item) => item.id)
      ),
      0
    )
  })

  test('a copy is refused when the year has classes; the button goes away', async ({
    client,
    assert,
  }) => {
    const { school } = await schoolWithLastYear()
    const target = await createYear(school, 2026)
    const operator = await signInAs(client, school)
    const path = `/tahun-ajaran/${target.publicId}/salin-kelas`

    await postForm(client, operator, path, {}, '/tahun-ajaran')
    assert.lengthOf(await classesOf(school, target), 3)

    const { session } = await postForm(client, operator, path, {}, '/tahun-ajaran')
    const page = await inertiaPage(client, session, '/tahun-ajaran')
    assert.equal(
      page.body().flash?.error,
      'Tahun ajaran 2026/2027 sudah punya kelas, jadi kelas tidak disalin.'
    )
    assert.lengthOf(await classesOf(school, target), 3)
    const row = page.inertiaProps.years.find(
      (year: { publicId: string }) => year.publicId === target.publicId
    )
    assert.isNull(row.copy)
  })

  test('the source is the latest year before the target; no source, no copy', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Sumber')
    const oldest = await createYear(school, 2024)
    const middle = await createYear(school, 2025)
    const target = await createYear(school, 2026)
    await createClass(school, oldest, { name: '2A', grade: 2 })
    await createClass(school, middle, { name: '3A', grade: 3 })
    const operator = await signInAs(client, school)

    const first = await postForm(
      client,
      operator,
      `/tahun-ajaran/${oldest.publicId}/salin-kelas`,
      {},
      '/tahun-ajaran'
    )
    const refusal = await inertiaPage(client, first.session, '/tahun-ajaran')
    // 2024/2025 already has classes.
    assert.match(refusal.body().flash?.error ?? '', /sudah punya kelas/)

    await postForm(
      client,
      operator,
      `/tahun-ajaran/${target.publicId}/salin-kelas`,
      {},
      '/tahun-ajaran'
    )
    const copied = await classesOf(school, target)
    assert.deepEqual(
      copied.map((item) => item.name),
      ['4A']
    )

    const lonely = await createSchool('SD Baru')
    const only = await createYear(lonely, 2026)
    const lonelyOperator = await signInAs(client, lonely)
    const { session } = await postForm(
      client,
      lonelyOperator,
      `/tahun-ajaran/${only.publicId}/salin-kelas`,
      {},
      '/tahun-ajaran'
    )
    const page = await inertiaPage(client, session, '/tahun-ajaran')
    assert.equal(page.body().flash?.error, 'Belum ada tahun ajaran sebelumnya untuk disalin.')
  })

  test('adding a year can copy last year’s classes at once, or not', async ({ client, assert }) => {
    const { school } = await schoolWithLastYear()
    const operator = await signInAs(client, school)

    const form = await inertiaPage(client, operator, '/tahun-ajaran')
    assert.equal(form.inertiaProps.createCopy.sourceName, '2025/2026')
    assert.deepEqual(
      form.inertiaProps.createCopy.withoutGradeOne.map((item: { name: string }) => item.name),
      ['2A', '2B', '5A']
    )

    const { session } = await postForm(client, operator, '/tahun-ajaran', {
      starts_on: '2026-07-13',
      even_semester_starts_on: '2027-01-04',
      ends_on: '2027-06-26',
      copy_classes: 'on',
    })
    const page = await inertiaPage(client, session, '/tahun-ajaran')
    assert.equal(
      page.body().flash?.success,
      'Tahun ajaran 2026/2027 sudah ditambahkan dengan 3 kelas yang disalin.'
    )
    const created = page.inertiaProps.years[0]
    assert.equal(created.classCount, 3)

    await postForm(client, operator, '/tahun-ajaran', {
      starts_on: '2027-07-12',
      even_semester_starts_on: '2028-01-03',
      ends_on: '2028-06-24',
    })
    const latest = await inertiaPage(client, operator, '/tahun-ajaran')
    assert.equal(latest.inertiaProps.years[0].name, '2027/2028')
    assert.equal(latest.inertiaProps.years[0].classCount, 0)
  })
})
