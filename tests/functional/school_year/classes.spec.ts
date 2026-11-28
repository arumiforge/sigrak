import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import School from '#models/school'
import SchoolMembership from '#models/school_membership'
import { createSchool, visit } from '#tests/helpers'
import { assertRlsHides, assertSchoolCannotRead, asSchool } from '#tests/tenancy'
import { cookieOf, inertiaPage, postForm, type Session } from '#tests/accounts'
import Subject from '../../../app/curriculum/models/subject.js'
import SchoolClass from '../../../app/school_year/models/school_class.js'
import TeachingAssignment from '../../../app/school_year/models/teaching_assignment.js'
import {
  assignmentsOf,
  classesOf,
  createClass,
  createTeacher,
  createYear,
  sdSubjects,
  signInAs,
  useCurriculum,
} from './fixtures.js'

/**
 * Kelas and teaching assignments (D-032, D-240, D-241, D-383, D-458,
 * D-464): default assignments from the class's subjects, homeroom and
 * grade changes, the teacher per subject, the Seni dan Budaya branch,
 * the level term, operator only, IDOR at the app and RLS walls.
 */
type Client = Parameters<typeof postForm>[0]

async function addClass(
  client: Client,
  operator: Session,
  yearPublicId: string,
  data: Record<string, string | number>
) {
  return postForm(
    client,
    operator,
    '/kelas',
    { year: yearPublicId, ...data },
    `/kelas?tahun=${yearPublicId}`
  )
}

function editClass(
  client: Client,
  operator: Session,
  schoolClass: SchoolClass,
  data: Record<string, string | number>
) {
  return postForm(
    client,
    operator,
    `/kelas/${schoolClass.publicId}/ubah`,
    data,
    `/kelas/${schoolClass.publicId}`
  )
}

function assign(
  client: Client,
  operator: Session,
  schoolClass: SchoolClass,
  values: Record<string, string>
) {
  const data = Object.fromEntries(
    Object.entries(values).map(([code, value]) => [`assignments[${code}]`, value])
  )
  return postForm(
    client,
    operator,
    `/kelas/${schoolClass.publicId}/guru-mapel`,
    data,
    `/kelas/${schoolClass.publicId}`
  )
}

async function onlyClass(school: School) {
  return asSchool(school, () => SchoolClass.query().firstOrFail())
}

test.group('School year | classes and teaching assignments', (group) => {
  useCurriculum(group)

  test('a new class with a homeroom teacher gets the class-teacher subjects; guru mapel wait', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Kelas')
    const year = await createYear(school)
    const homeroom = await createTeacher(school, 'Bu Ani')
    const operator = await signInAs(client, school)

    const { response } = await addClass(client, operator, year.publicId, {
      class_name: ' 4A ',
      grade: 4,
      art_branch: 'visual_art',
      homeroom: homeroom.membership.publicId,
    })
    assert.equal(response.header('location'), `/kelas?tahun=${year.publicId}`)

    const schoolClass = await onlyClass(school)
    assert.equal(schoolClass.name, '4A')
    assert.equal(schoolClass.artBranch, 'visual_art')
    assert.equal(schoolClass.homeroomTeacherId, homeroom.user.id)

    const { classTeacher, subjectTeacher, subjects } = await sdSubjects(4)
    const rows = await assignmentsOf(schoolClass)
    assert.sameMembers(
      [...rows.keys()],
      classTeacher.map((subject) => subject.subjectId)
    )
    assert.isTrue([...rows.values()].every((teacher) => teacher === homeroom.user.id))
    assert.isTrue(subjectTeacher.some((subject) => subject.code === 'PJOK'))

    const page = await inertiaPage(client, operator, `/kelas/${schoolClass.publicId}`)
    const props = page.inertiaProps
    assert.equal(props.levelTerms.homeroomTeacherTerm, 'Guru kelas')
    assert.equal(props.schoolClass.homeroom.value, homeroom.membership.publicId)
    assert.notProperty(props.schoolClass, 'id')
    assert.lengthOf(props.subjects, subjects.length)
    const pjok = props.subjects.find((subject: { code: string }) => subject.code === 'PJOK')
    assert.isNull(pjok.teacher)
    assert.deepEqual(props.teachers, [{ publicId: homeroom.membership.publicId, name: 'Bu Ani' }])

    const list = await inertiaPage(client, operator, `/kelas?tahun=${year.publicId}`)
    assert.deepInclude(list.inertiaProps.classes[0], {
      name: '4A',
      homeroomName: 'Bu Ani',
      subjectCount: subjects.length,
      assignedCount: classTeacher.length,
    })
  })

  test('class names are unique per year, ignoring case; another year may reuse them', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Nama')
    const year = await createYear(school, 2026)
    const next = await createYear(school, 2027)
    await createClass(school, year, { name: '4A' })
    const operator = await signInAs(client, school)

    const { session } = await addClass(client, operator, year.publicId, {
      class_name: '4a',
      grade: 4,
    })
    const page = await inertiaPage(client, session, `/kelas?tahun=${year.publicId}`)
    assert.equal(
      page.inertiaProps.errors.class_name,
      'Kelas 4a sudah ada di tahun ajaran 2026/2027.'
    )

    const long = await addClass(client, operator, year.publicId, {
      class_name: 'Kelas Bintang Kejora Pagi',
      grade: 4,
    })
    const longPage = await inertiaPage(client, long.session, `/kelas?tahun=${year.publicId}`)
    assert.equal(longPage.inertiaProps.errors.class_name, 'Nama kelas maksimal 20 karakter.')

    await addClass(client, operator, next.publicId, { class_name: '4A', grade: 4 })
    assert.lengthOf(await classesOf(school, next), 1)
    assert.lengthOf(await classesOf(school, year), 1)
    await assert.rejects(() => createClass(school, year, { name: '4A ' }), /classes_name_check/)
  })

  test('a new homeroom teacher takes over the previous one’s rows; others stay', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Wali')
    const year = await createYear(school)
    const first = await createTeacher(school, 'Pak Budi')
    const second = await createTeacher(school, 'Bu Citra')
    const pe = await createTeacher(school, 'Pak Olahraga')
    const operator = await signInAs(client, school)
    await addClass(client, operator, year.publicId, {
      class_name: '3A',
      grade: 3,
      homeroom: first.membership.publicId,
    })
    const schoolClass = await onlyClass(school)
    const { classTeacher } = await sdSubjects(3)

    // The operator gives Matematika to the PE teacher and PJOK too.
    await assign(client, operator, schoolClass, {
      MTK: pe.membership.publicId,
      PJOK: pe.membership.publicId,
    })
    await editClass(client, operator, schoolClass, {
      class_name: '3A',
      grade: 3,
      homeroom: second.membership.publicId,
    })
    const mtk = await Subject.findByOrFail('code', 'MTK')
    const pjok = await Subject.findByOrFail('code', 'PJOK')
    let rows = await assignmentsOf(schoolClass)
    assert.equal(rows.get(mtk.id), pe.user.id)
    assert.equal(rows.get(pjok.id), pe.user.id)
    for (const subject of classTeacher.filter((row) => row.code !== 'MTK')) {
      assert.equal(rows.get(subject.subjectId), second.user.id, subject.code)
    }
    assert.notInclude([...rows.values()], first.user.id)

    // Removing the homeroom teacher removes the rows they held.
    await editClass(client, operator, schoolClass, { class_name: '3A', grade: 3, homeroom: '' })
    rows = await assignmentsOf(schoolClass)
    assert.sameMembers([...rows.keys()], [mtk.id, pjok.id])
    const fresh = await onlyClass(school)
    assert.isNull(fresh.homeroomTeacherId)
  })

  test('changing the grade drops subjects the new grade does not take and fills new ones', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Tingkat')
    const year = await createYear(school)
    const homeroom = await createTeacher(school)
    const operator = await signInAs(client, school)
    await addClass(client, operator, year.publicId, {
      class_name: 'Kelas Merah',
      grade: 3,
      homeroom: homeroom.membership.publicId,
    })
    const schoolClass = await onlyClass(school)
    const ipas = await Subject.findByOrFail('code', 'IPAS')
    const before = await assignmentsOf(schoolClass)
    assert.equal(before.get(ipas.id), homeroom.user.id)

    await editClass(client, operator, schoolClass, {
      class_name: 'Kelas Merah',
      grade: 1,
      homeroom: homeroom.membership.publicId,
    })
    let rows = await assignmentsOf(schoolClass)
    assert.isFalse(rows.has(ipas.id))
    const grade1 = await sdSubjects(1)
    assert.sameMembers(
      [...rows.keys()],
      grade1.classTeacher.map((subject) => subject.subjectId)
    )

    await editClass(client, operator, schoolClass, {
      class_name: 'Kelas Merah',
      grade: 4,
      homeroom: homeroom.membership.publicId,
    })
    rows = await assignmentsOf(schoolClass)
    assert.equal(rows.get(ipas.id), homeroom.user.id)
  })

  test('the operator sets, changes and clears the teacher of each subject', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Mapel')
    const year = await createYear(school)
    const one = await createTeacher(school, 'Guru Satu')
    const two = await createTeacher(school, 'Guru Dua')
    const outsider = await createTeacher(await createSchool('SD Lain'), 'Guru Asing')
    const operator = await signInAs(client, school)
    const schoolClass = await createClass(school, year, { name: '5A', grade: 5 })
    const pjok = await Subject.findByOrFail('code', 'PJOK')
    const pai = await Subject.findByOrFail('code', 'PAI')

    await assign(client, operator, schoolClass, {
      PJOK: one.membership.publicId,
      PAI: two.membership.publicId,
    })
    let rows = await assignmentsOf(schoolClass)
    assert.equal(rows.get(pjok.id), one.user.id)
    assert.equal(rows.get(pai.id), two.user.id)

    await assign(client, operator, schoolClass, { PJOK: two.membership.publicId, PAI: '' })
    rows = await assignmentsOf(schoolClass)
    assert.equal(rows.get(pjok.id), two.user.id)
    assert.isFalse(rows.has(pai.id))

    // A teacher of another school, or a made-up id, is refused.
    for (const value of [outsider.membership.publicId, '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b']) {
      const { session } = await assign(client, operator, schoolClass, { PAI: value })
      const page = await inertiaPage(client, session, `/kelas/${schoolClass.publicId}`)
      assert.equal(
        page.inertiaProps.errors['assignments.PAI'],
        'Guru ini tidak ditemukan di sekolah. Muat ulang halaman, lalu pilih lagi.'
      )
    }
    // A subject the class does not take is refused.
    const { session } = await assign(client, operator, schoolClass, {
      KKA: one.membership.publicId,
    })
    const page = await inertiaPage(client, session, `/kelas/${schoolClass.publicId}`)
    assert.match(page.body().flash?.error ?? '', /Daftar mata pelajaran sudah berubah/)
    const left = await assignmentsOf(schoolClass)
    assert.equal(left.size, 1)
  })

  test('a teacher who left stays until changed; a subject no longer taught can be cleared', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Lama')
    const year = await createYear(school)
    const leaver = await createTeacher(school, 'Guru Pindah')
    const operator = await signInAs(client, school)
    const schoolClass = await createClass(school, year, {
      name: '1A',
      grade: 1,
      homeroomTeacherId: leaver.user.id,
    })
    const pjok = await Subject.findByOrFail('code', 'PJOK')
    const english = await Subject.findByOrFail('code', 'BIG')
    await asSchool(school, () =>
      TeachingAssignment.createMany([
        { classId: schoolClass.id, subjectId: pjok.id, teacherId: leaver.user.id },
        // Bahasa Inggris is not taken by grade 1 now (optional, off, D-204).
        { classId: schoolClass.id, subjectId: english.id, teacherId: leaver.user.id },
      ])
    )
    await SchoolMembership.query()
      .where('id', leaver.membership.id)
      .update({ status: 'ended', ended_on: '2026-10-01' })

    const page = await inertiaPage(client, operator, `/kelas/${schoolClass.publicId}`)
    const props = page.inertiaProps
    assert.deepEqual(props.schoolClass.homeroom, {
      value: 'current',
      name: 'Guru Pindah',
      active: false,
    })
    const big = props.subjects.find((subject: { code: string }) => subject.code === 'BIG')
    assert.isFalse(big.taught)
    assert.equal(big.teacher.name, 'Guru Pindah')

    // Saving other fields keeps the homeroom teacher who left.
    await editClass(client, operator, schoolClass, {
      class_name: '1 Melati',
      grade: 1,
      homeroom: 'current',
    })
    const fresh = await onlyClass(school)
    assert.equal(fresh.name, '1 Melati')
    assert.equal(fresh.homeroomTeacherId, leaver.user.id)

    await assign(client, operator, schoolClass, { PJOK: 'current', BIG: '' })
    const rows = await assignmentsOf(schoolClass)
    assert.equal(rows.get(pjok.id), leaver.user.id)
    assert.isFalse(rows.has(english.id))
  })

  test('art branch per class: four branches, Tari and Teater without topics; others refused', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Seni')
    const year = await createYear(school)
    const operator = await signInAs(client, school)

    const page = await inertiaPage(client, operator, `/kelas?tahun=${year.publicId}`)
    assert.deepEqual(page.inertiaProps.artBranchesByGrade['2'], [
      { artBranch: 'music', hasTopics: true },
      { artBranch: 'visual_art', hasTopics: true },
      { artBranch: 'dance', hasTopics: false },
      { artBranch: 'theatre', hasTopics: false },
    ])

    await addClass(client, operator, year.publicId, {
      class_name: '2A',
      grade: 2,
      art_branch: 'dance',
    })
    const { session } = await addClass(client, operator, year.publicId, {
      class_name: '2B',
      grade: 2,
      art_branch: 'drawing',
    })
    const after = await inertiaPage(client, session, `/kelas?tahun=${year.publicId}`)
    assert.equal(after.inertiaProps.errors.art_branch, 'Pilih Cabang Seni dan Budaya dari daftar.')
    const classes = await classesOf(school, year)
    assert.deepEqual(
      classes.map((row) => [row.name, row.artBranch]),
      [['2A', 'dance']]
    )
    await assert.rejects(
      () => db.from('classes').where('id', classes[0].id).update({ art_branch: 'drawing' }),
      /classes_art_branch_check/
    )
  })

  test('an MI school says Wali kelas (level term from the Profil Jenjang)', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('MI Uji')
    await School.query().where('id', school.id).update({ level: 'mi' })
    const year = await createYear(school)
    const schoolClass = await createClass(school, year, { name: '4A', grade: 4 })
    const operator = await signInAs(client, school)

    const list = await inertiaPage(client, operator, `/kelas?tahun=${year.publicId}`)
    assert.equal(list.inertiaProps.levelTerms.homeroomTeacherTerm, 'Wali kelas')
    const page = await inertiaPage(client, operator, `/kelas/${schoolClass.publicId}`)
    assert.equal(page.inertiaProps.levelTerms.homeroomTeacherTerm, 'Wali kelas')
    assert.isAbove(page.inertiaProps.subjects.length, 0)
  })

  test('deleting a class removes its teaching assignments', async ({ client, assert }) => {
    const school = await createSchool('SD Hapus')
    const year = await createYear(school)
    const homeroom = await createTeacher(school)
    const operator = await signInAs(client, school)
    await addClass(client, operator, year.publicId, {
      class_name: '6A',
      grade: 6,
      homeroom: homeroom.membership.publicId,
    })
    const schoolClass = await onlyClass(school)
    const held = await assignmentsOf(schoolClass)
    assert.isAbove(held.size, 0)

    const { response } = await postForm(
      client,
      operator,
      `/kelas/${schoolClass.publicId}/hapus`,
      {},
      `/kelas/${schoolClass.publicId}`
    )
    assert.equal(response.header('location'), `/kelas?tahun=${year.publicId}`)
    assert.lengthOf(await db.from('classes'), 0)
    assert.lengthOf(await db.from('teaching_assignments'), 0)
  })

  test('the Kelas page opens the current year, or asks for a year first', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Halaman')
    const operator = await signInAs(client, school)
    const empty = await inertiaPage(client, operator, '/kelas')
    assert.isNull(empty.inertiaProps.year)

    const today = new Date()
    const startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1
    await createYear(school, startYear - 1)
    const current = await createYear(school, startYear)
    await createYear(school, startYear + 1)
    const page = await inertiaPage(client, operator, '/kelas')
    assert.equal(page.inertiaProps.year.publicId, current.publicId)
    assert.lengthOf(page.inertiaProps.years, 3)

    const bad = await visit(client, 'app', '/kelas?tahun=bukan-id', cookieOf(operator))
    assert.equal(bad.status(), 404)
  })

  test('teachers and principals cannot open or post Kelas', async ({ client, assert }) => {
    const school = await createSchool('SD Peran Kelas')
    const year = await createYear(school)
    const schoolClass = await createClass(school, year)
    for (const role of ['teacher', 'principal'] as const) {
      const session = await signInAs(client, school, role)
      for (const path of [`/kelas`, `/kelas/${schoolClass.publicId}`]) {
        const page = await visit(client, 'app', path, cookieOf(session))
        assert.equal(page.status(), 403, `${role} ${path}`)
      }
      for (const path of [
        '/kelas',
        `/kelas/${schoolClass.publicId}/ubah`,
        `/kelas/${schoolClass.publicId}/hapus`,
        `/kelas/${schoolClass.publicId}/guru-mapel`,
      ]) {
        const { response } = await postForm(
          client,
          session,
          path,
          { year: year.publicId, class_name: 'X', grade: 1 },
          '/akun'
        )
        assert.equal(response.status(), 403, `${role} ${path}`)
      }
    }
    assert.lengthOf(await db.from('classes'), 1)
  })

  test('another school’s classes and assignments: 404 over HTTP, hidden by the app and RLS', async ({
    client,
    assert,
  }) => {
    const schoolA = await createSchool('SD A')
    const schoolB = await createSchool('SD B')
    const yearB = await createYear(schoolB)
    const teacherB = await createTeacher(schoolB)
    const classB = await createClass(schoolB, yearB, {
      name: '4B',
      grade: 4,
      homeroomTeacherId: teacherB.user.id,
    })
    const pjok = await Subject.findByOrFail('code', 'PJOK')
    const rowB = await asSchool(schoolB, () =>
      TeachingAssignment.create({
        classId: classB.id,
        subjectId: pjok.id,
        teacherId: teacherB.user.id,
      })
    )
    await createYear(schoolA)
    const operatorA = await signInAs(client, schoolA)

    const show = await visit(client, 'app', `/kelas/${classB.publicId}`, cookieOf(operatorA))
    assert.equal(show.status(), 404)
    const list = await visit(client, 'app', `/kelas?tahun=${yearB.publicId}`, cookieOf(operatorA))
    assert.equal(list.status(), 404)
    for (const path of [
      `/kelas/${classB.publicId}/ubah`,
      `/kelas/${classB.publicId}/hapus`,
      `/kelas/${classB.publicId}/guru-mapel`,
    ]) {
      const { response } = await postForm(
        client,
        operatorA,
        path,
        { 'class_name': 'Curian', 'grade': 1, 'assignments[PJOK]': '' },
        '/kelas'
      )
      assert.equal(response.status(), 404, path)
    }
    const { response } = await postForm(
      client,
      operatorA,
      '/kelas',
      { year: yearB.publicId, class_name: 'Susup', grade: 1 },
      '/kelas'
    )
    assert.equal(response.status(), 404)

    assert.lengthOf(await db.from('classes').where('school_id', schoolB.id), 1)
    assert.lengthOf(await db.from('classes').where('school_id', schoolA.id), 0)
    const rowsB = await assignmentsOf(classB)
    assert.equal(rowsB.get(pjok.id), teacherB.user.id)

    await assertSchoolCannotRead(assert, schoolA, () => SchoolClass.find(classB.id))
    await assertSchoolCannotRead(assert, schoolA, () => TeachingAssignment.find(rowB.id))
    await assertSchoolCannotRead(assert, schoolA, () =>
      TeachingAssignment.query().where('class_id', classB.id)
    )
    await assertRlsHides(assert, schoolA, 'classes', [classB.id])
    await assertRlsHides(assert, schoolA, 'teaching_assignments', [rowB.id])

    // A class can never point at another school's year (composite foreign key).
    await assert.rejects(
      () =>
        db.table('classes').insert({
          public_id: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c',
          school_id: schoolA.id,
          academic_year_id: yearB.id,
          grade: 1,
          name: '1A',
          created_at: new Date(),
          updated_at: new Date(),
        }),
      /classes_academic_year_school_foreign/
    )
  })
})
