import type { ApiClient } from '@japa/api-client'
import type { Group } from '@japa/runner/core'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import type School from '#models/school'
import { importCurriculum } from '../../../app/curriculum/import/curriculum_importer.js'
import { PolicyProfileResolver } from '../../../app/curriculum/policy/policy_profile_resolver.js'
import { saveAcademicYear } from '../../../app/school_year/academic_years.js'
import { ClassSubjects } from '../../../app/school_year/class_subjects.js'
import type AcademicYear from '../../../app/school_year/models/academic_year.js'
import SchoolClass from '../../../app/school_year/models/school_class.js'
import type TeachingAssignment from '../../../app/school_year/models/teaching_assignment.js'
import { asSchool, createMember } from '#tests/tenancy'
import { signIn, type Session } from '#tests/accounts'

/**
 * Fixtures for the school-year tests (R1-06). The curriculum is imported
 * once per group (committed, because the pages read it while requests
 * run on other connections); each test starts with no schools or users.
 */
export function useCurriculum(group: Group) {
  group.setup(async () => {
    const cleanup = await testUtils.db().truncate()
    PolicyProfileResolver.clearCache()
    await importCurriculum()
    return cleanup
  })
  group.each.setup(async () => {
    await db.rawQuery('TRUNCATE schools, users, staff_users RESTART IDENTITY CASCADE')
    await limiter.clear(['memory'])
  })
  group.each.timeout(60_000)
}

/** A signed-in member of `school` with `role` (operator by default). */
export async function signInAs(
  client: ApiClient,
  school: School,
  role: 'operator' | 'teacher' | 'principal' = 'operator'
): Promise<Session & { userId: number }> {
  const { user } = await createMember(school, role)
  return { ...(await signIn(client, 'app', user.email)), userId: user.id }
}

export async function createTeacher(school: School, name = 'Guru Uji') {
  const fixture = await createMember(school, 'teacher')
  fixture.user.name = name
  await fixture.user.save()
  return fixture
}

/** A year of `school` starting 1 July of `startYear` (2026/2027 by default). */
export function createYear(school: School, startYear = 2026) {
  return asSchool(school, () =>
    saveAcademicYear({
      startsOn: DateTime.fromISO(`${startYear}-07-01`),
      evenSemesterStartsOn: DateTime.fromISO(`${startYear + 1}-01-01`),
      endsOn: DateTime.fromISO(`${startYear + 1}-06-30`),
    })
  )
}

/** A class written directly (no default assignments). */
export function createClass(
  school: School,
  year: AcademicYear,
  values: Partial<Pick<SchoolClass, 'name' | 'grade' | 'artBranch' | 'homeroomTeacherId'>> = {}
) {
  return asSchool(school, () =>
    SchoolClass.create({
      academicYearId: year.id,
      name: values.name ?? '4A',
      grade: values.grade ?? 4,
      artBranch: values.artBranch ?? null,
      homeroomTeacherId: values.homeroomTeacherId ?? null,
    })
  )
}

/** The subjects an SD class of `grade` takes in 2026/2027. */
export async function sdSubjects(grade: number, schoolYear = '2026/2027') {
  const list = await new ClassSubjects().forGrade(
    { level: 'sd', regionProvince: null },
    schoolYear,
    grade
  )
  return {
    ...list,
    classTeacher: list.subjects.filter((subject) => subject.defaultTeacher === 'class_teacher'),
    subjectTeacher: list.subjects.filter((subject) => subject.defaultTeacher === 'subject_teacher'),
  }
}

/** subject id → teacher user id of a class (owner connection). */
export async function assignmentsOf(schoolClass: SchoolClass) {
  const rows = await db
    .from('teaching_assignments')
    .where('class_id', schoolClass.id)
    .select('subject_id', 'teacher_id')
  return new Map(
    rows.map((row: { subject_id: number; teacher_id: number }) => [row.subject_id, row.teacher_id])
  )
}

export async function classesOf(school: School, year: AcademicYear) {
  return asSchool(school, () =>
    SchoolClass.query().where('academic_year_id', year.id).orderBy('grade').orderBy('name')
  )
}

export async function reload<T extends AcademicYear | SchoolClass | TeachingAssignment>(
  school: School,
  row: T
): Promise<T | null> {
  const model = row.constructor as typeof AcademicYear
  return asSchool(school, () => model.find(row.id)) as Promise<T | null>
}
