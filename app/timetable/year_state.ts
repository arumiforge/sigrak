import User from '#models/user'
import Subject from '../curriculum/models/subject.js'
import type { GradeSubject } from '../curriculum/subjects_for_grade.js'
import type { ClassSubjects, SchoolPolicyInput } from '../school_year/class_subjects.js'
import type AcademicYear from '../school_year/models/academic_year.js'
import SchoolClass from '../school_year/models/school_class.js'
import TeachingAssignment from '../school_year/models/teaching_assignment.js'
import TimetableSlot from './models/timetable_slot.js'
import type { ClassRules, RuleContext, RuleRow } from './rules.js'

/**
 * Everything the timetable rules need for one academic year: its
 * classes, the subjects each class takes with their allocation
 * (`SubjectsForGrade`, D-230), the teacher of each subject
 * (`teaching_assignments`, D-249) and every row of the year. Teacher
 * clashes are checked across the whole year (D-248). Runs inside a
 * tenant transaction of the school.
 */

export interface TimetableDeps {
  classSubjects: ClassSubjects
  school: SchoolPolicyInput
}

export interface SubjectInfo {
  id: number
  code: string
  name: string
  religion: string | null
}

export interface ClassState {
  model: SchoolClass
  rules: ClassRules
  /** Subjects the class takes, in curriculum order. */
  subjects: GradeSubject[]
}

export interface YearState {
  year: AcademicYear
  classes: Map<number, ClassState>
  slots: TimetableSlot[]
  context: RuleContext
  subjects: Map<number, SubjectInfo>
  teacherNames: Map<number, string>
}

export function ruleRowOf(slot: TimetableSlot): RuleRow {
  return { ...slot.toPlain(), key: String(slot.id), classId: slot.classId }
}

export async function loadYearState(
  deps: TimetableDeps,
  year: AcademicYear,
  options: { lockSlots?: boolean } = {}
): Promise<YearState> {
  const classes = await SchoolClass.query()
    .where('academic_year_id', year.id)
    .orderBy('grade', 'asc')
    .orderBy('name', 'asc')
  const classIds = classes.map((row) => row.id)
  const slotQuery = TimetableSlot.query()
    .whereIn('class_id', classIds.length > 0 ? classIds : [0])
    .orderBy('weekday', 'asc')
    .orderBy('starts_at', 'asc')
    .orderBy('id', 'asc')
  if (options.lockSlots) slotQuery.forUpdate()
  const slots = await slotQuery
  const assignments =
    classIds.length === 0 ? [] : await TeachingAssignment.query().whereIn('class_id', classIds)

  const byGrade = new Map<number, GradeSubject[]>()
  for (const grade of new Set(classes.map((row) => row.grade))) {
    const list = await deps.classSubjects.forGrade(deps.school, year.name, grade)
    byGrade.set(grade, list.subjects)
  }

  const subjects = new Map<number, SubjectInfo>()
  for (const list of byGrade.values()) {
    for (const subject of list) {
      subjects.set(subject.subjectId, {
        id: subject.subjectId,
        code: subject.code,
        name: subject.name,
        religion: subject.religion,
      })
    }
  }
  const missing = [
    ...new Set(
      [...slots.map((row) => row.subjectId), ...assignments.map((row) => row.subjectId)].filter(
        (id): id is number => id !== null && !subjects.has(id)
      )
    ),
  ]
  if (missing.length > 0) {
    for (const subject of await Subject.query().whereIn('id', missing)) {
      subjects.set(subject.id, {
        id: subject.id,
        code: subject.code,
        name: subject.name,
        religion: subject.religion ?? null,
      })
    }
  }

  const classStates = new Map<number, ClassState>()
  for (const schoolClass of classes) {
    const list = byGrade.get(schoolClass.grade) ?? []
    classStates.set(schoolClass.id, {
      model: schoolClass,
      subjects: list,
      rules: {
        id: schoolClass.id,
        name: schoolClass.name,
        taken: new Map(list.map((subject) => [subject.subjectId, subject.jpPerWeek])),
        teacherOf: new Map(
          assignments
            .filter((row) => row.classId === schoolClass.id)
            .map((row) => [row.subjectId, row.teacherId])
        ),
      },
    })
  }

  const teacherIds = [...new Set(assignments.map((row) => row.teacherId))]
  const users =
    teacherIds.length === 0 ? [] : await User.query().whereIn('id', teacherIds).select('id', 'name')

  return {
    year,
    classes: classStates,
    slots,
    subjects,
    teacherNames: new Map(users.map((user) => [user.id, user.name])),
    context: {
      classes: new Map([...classStates].map(([id, state]) => [id, state.rules])),
      religionOf: new Map([...subjects].map(([id, info]) => [id, info.religion])),
    },
  }
}
