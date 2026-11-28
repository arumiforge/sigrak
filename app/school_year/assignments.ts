import type { GradeSubject } from '../curriculum/subjects_for_grade.js'
import type SchoolClass from './models/school_class.js'
import TeachingAssignment from './models/teaching_assignment.js'

/**
 * Teaching assignments (D-032, D-240). No row means no teacher yet.
 *
 * - When a class has a homeroom teacher, each class-teacher subject
 *   without a row goes to them; guru mapel subjects wait for the
 *   operator.
 * - A new homeroom teacher takes over the rows the previous one held in
 *   the class; rows the operator gave to others stay. Removing the
 *   homeroom teacher removes the rows they held.
 * - Changing the grade drops the rows for subjects the new grade does
 *   not take.
 *
 * Every function runs inside a tenant transaction of the school.
 */

export function rowsOf(schoolClass: SchoolClass) {
  return TeachingAssignment.query().where('class_id', schoolClass.id)
}

/**
 * Gives each class-teacher subject without a row to the homeroom
 * teacher; does nothing when the class has none.
 */
export async function applyDefaultAssignments(schoolClass: SchoolClass, subjects: GradeSubject[]) {
  const teacherId = schoolClass.homeroomTeacherId
  if (teacherId === null) return
  const rows = await rowsOf(schoolClass)
  const existing = new Set(rows.map((row) => row.subjectId))
  const missing = subjects.filter(
    (subject) => subject.defaultTeacher === 'class_teacher' && !existing.has(subject.subjectId)
  )
  if (missing.length === 0) return
  await TeachingAssignment.createMany(
    missing.map((subject) => ({
      classId: schoolClass.id,
      subjectId: subject.subjectId,
      teacherId,
    }))
  )
}

/**
 * Moves or removes the previous homeroom teacher's rows, then fills the
 * class-teacher subjects for the new one.
 */
export async function changeHomeroom(
  schoolClass: SchoolClass,
  previousTeacherId: number | null,
  subjects: GradeSubject[]
) {
  const next = schoolClass.homeroomTeacherId
  if (previousTeacherId === next) return
  if (previousTeacherId !== null) {
    const held = rowsOf(schoolClass).where('teacher_id', previousTeacherId)
    if (next === null) {
      await held.delete()
    } else {
      await held.update({ teacher_id: next, updated_at: new Date() })
    }
  }
  await applyDefaultAssignments(schoolClass, subjects)
}

/**
 * Drops the rows for subjects the class's grade does not take (after a
 * grade change).
 */
export async function dropUntakenRows(schoolClass: SchoolClass, subjects: GradeSubject[]) {
  const taken = subjects.map((subject) => subject.subjectId)
  const query = rowsOf(schoolClass)
  if (taken.length > 0) query.whereNotIn('subject_id', taken)
  await query.delete()
}

/**
 * Sets the teacher of each subject in `changes` (subject id → user id,
 * null = no teacher yet). Subjects left out keep their row.
 */
export async function setTeachers(schoolClass: SchoolClass, changes: Map<number, number | null>) {
  const current = await rowsOf(schoolClass)
  const rows = new Map(current.map((row) => [row.subjectId, row]))
  for (const [subjectId, teacherId] of changes) {
    const row = rows.get(subjectId)
    if (teacherId === null) {
      if (row) await row.delete()
    } else if (!row) {
      await TeachingAssignment.create({ classId: schoolClass.id, subjectId, teacherId })
    } else if (row.teacherId !== teacherId) {
      row.teacherId = teacherId
      await row.save()
    }
  }
}
