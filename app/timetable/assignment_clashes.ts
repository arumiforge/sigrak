import User from '#models/user'
import { lockYear } from '../school_year/classes.js'
import type SchoolClass from '../school_year/models/school_class.js'
import { refuseViolations } from './messages.js'
import { checkRows } from './rules.js'
import { loadYearState, ruleRowOf, type TimetableDeps } from './year_state.js'

/**
 * D-248 on the Kelas page: picking a guru mapel is refused when the new
 * teacher would then have two lessons at the same time. `changes` maps
 * subject id → user id (null = no teacher). The message goes to the
 * subject's select (`assignments.<code>`). Runs inside the tenant
 * transaction of the save, before the assignments change.
 */
export async function refuseAssignmentClashes(
  deps: TimetableDeps,
  schoolClass: SchoolClass,
  changes: Map<number, number | null>
) {
  await lockYear(schoolClass.academicYear)
  const state = await loadYearState(deps, schoolClass.academicYear)
  const rules = state.classes.get(schoolClass.id)?.rules
  if (!rules) return
  const changed = new Set<number>()
  for (const [subjectId, teacherId] of changes) {
    if (teacherId === null) {
      rules.teacherOf.delete(subjectId)
    } else if (rules.teacherOf.get(subjectId) !== teacherId) {
      rules.teacherOf.set(subjectId, teacherId)
      changed.add(subjectId)
    }
  }
  if (changed.size === 0) return

  const clashes = checkRows(
    state.slots.map(ruleRowOf),
    state.context,
    (row) => row.classId === schoolClass.id && row.kind === 'lesson' && changed.has(row.subjectId!)
  ).filter((violation) => violation.rule === 'teacher_clash')
  if (clashes.length === 0) return

  const [first] = clashes
  if (first.rule === 'teacher_clash' && !state.teacherNames.has(first.teacherId)) {
    const user = await User.find(first.teacherId)
    if (user) state.teacherNames.set(user.id, user.name)
  }
  const code = state.subjects.get(first.row.subjectId!)?.code ?? ''
  refuseViolations([first], state, `assignments.${code}`)
}
