import type { HttpContext } from '@adonisjs/core/http'
import { requireRole } from '#accounts/http'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import { currentYear, yearsOfSchool } from '../../school_year/academic_years.js'
import { ClassSubjects, levelTermsOf, schoolPolicyInput } from '../../school_year/class_subjects.js'
import { classRows } from '../presenters.js'
import { ruleRowOf, loadYearState } from '../year_state.js'
import { teacherOfRow } from '../rules.js'
import { toClock } from '../time.js'

/**
 * Kelas Saya > Jadwal (teacher, D-247, D-249): the teacher's own lessons
 * in the current year with the total JP, and the full timetable of each
 * class they are guru kelas / wali kelas of (D-383).
 */
export default class MyTimetableController {
  async show(ctx: HttpContext) {
    const membership = requireRole(ctx, 'teacher')
    const deps = {
      classSubjects: new ClassSubjects(),
      school: await schoolPolicyInput(membership.schoolId),
    }
    const props = await tenantTransaction(async () => {
      const year = currentYear(await yearsOfSchool())
      if (!year) return { year: null, lessons: [], totalJp: 0, homerooms: [], levelTerms: null }
      const state = await loadYearState(deps, year)
      const lessons = state.slots
        .filter(
          (slot) =>
            slot.kind === 'lesson' &&
            teacherOfRow(ruleRowOf(slot), state.context) === membership.userId
        )
        .sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt))
        .map((slot) => {
          const plain = slot.toPlain()
          return {
            weekday: plain.weekday,
            startsAt: toClock(plain.start),
            endsAt: toClock(plain.end),
            className: state.classes.get(slot.classId)?.model.name ?? '',
            subjectName: state.subjects.get(slot.subjectId!)?.name ?? '',
            jp: slot.jp,
          }
        })
      const homerooms = [...state.classes.values()]
        .filter((row) => row.model.homeroomTeacherId === membership.userId)
        .map((row) => ({
          name: row.model.name,
          rows: classRows(state, row.model.id).map(({ publicId: _id, ...rest }) => rest),
        }))
      const policy = await deps.classSubjects.policy(deps.school, year.name)
      return {
        year: { name: year.name },
        lessons,
        totalJp: lessons.reduce((sum, row) => sum + row.jp, 0),
        homerooms,
        levelTerms: levelTermsOf(policy),
      }
    })
    return ctx.inertia.render('timetable/mine', props)
  }
}
