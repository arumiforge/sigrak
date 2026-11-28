import type { ArtBranch } from '../curriculum/types.js'
import AcademicYear from './models/academic_year.js'
import SchoolClass from './models/school_class.js'
import { refuseClosed } from './academic_years.js'
import { applyDefaultAssignments, changeHomeroom, dropUntakenRows } from './assignments.js'
import type { ClassSubjects, SchoolPolicyInput } from './class_subjects.js'
import { SchoolYearRuleError } from './errors.js'
import { pickTeacher, teacherOptions } from './teachers.js'

/**
 * Classes (D-241): free names up to 20 characters, unique per year;
 * grade 1–6; the Seni dan Budaya branch the class learns (D-458, D-464);
 * the homeroom teacher, whose changes move the default teaching
 * assignments (D-240). Runs inside a tenant transaction of the school.
 */

export interface ClassInput {
  name: string
  grade: number
  artBranch: ArtBranch | null
  /** Membership public id, '' / null for none, or KEEP_CURRENT. */
  homeroom: string | null
}

/**
 * Locks the year row for the rest of the transaction, so a class copy
 * (which needs an empty year, D-246) and a new class never race.
 */
export async function lockYear(year: AcademicYear) {
  await AcademicYear.query().where('id', year.id).forUpdate().firstOrFail()
}

export async function nameTaken(year: AcademicYear, name: string, except?: SchoolClass) {
  const query = SchoolClass.query()
    .where('academic_year_id', year.id)
    .whereRaw('lower(name) = lower(?)', [name])
  if (except) query.whereNot('id', except.id)
  return (await query.first()) !== null
}

export async function saveClass(
  deps: { classSubjects: ClassSubjects; school: SchoolPolicyInput },
  year: AcademicYear,
  input: ClassInput,
  existing?: SchoolClass
) {
  refuseClosed(year)
  await lockYear(year)

  const name = input.name.trim()
  if (await nameTaken(year, name, existing)) {
    throw new SchoolYearRuleError('class_name', 'classes.errors.class_name_taken', {
      name,
      year: year.name,
    })
  }

  const list = await deps.classSubjects.forGrade(deps.school, year.name, input.grade)
  if (
    input.artBranch !== null &&
    !list.artBranches.some((option) => option.artBranch === input.artBranch)
  ) {
    throw new SchoolYearRuleError('art_branch', 'classes.errors.art_branch_unknown')
  }

  const options = await teacherOptions()
  const previousTeacherId = existing?.homeroomTeacherId ?? null
  const homeroomTeacherId = pickTeacher(options, input.homeroom, previousTeacherId, 'homeroom')
  const gradeChanged = existing !== undefined && existing.grade !== input.grade

  const schoolClass = existing ?? new SchoolClass()
  schoolClass.merge({
    academicYearId: year.id,
    name,
    grade: input.grade,
    artBranch: input.artBranch,
    homeroomTeacherId,
  })
  await schoolClass.save()

  if (gradeChanged) await dropUntakenRows(schoolClass, list.subjects)
  if (existing) {
    await changeHomeroom(schoolClass, previousTeacherId, list.subjects)
    if (gradeChanged) await applyDefaultAssignments(schoolClass, list.subjects)
  } else {
    await applyDefaultAssignments(schoolClass, list.subjects)
  }
  return schoolClass
}

/**
 * Deletes a class with its teaching assignments (D-241).
 */
export async function deleteClass(schoolClass: SchoolClass, year: AcademicYear) {
  refuseClosed(year)
  await schoolClass.delete()
}
