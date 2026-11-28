import { refuseClosed } from '../school_year/academic_years.js'
import { lockYear } from '../school_year/classes.js'
import { SchoolYearRuleError } from '../school_year/errors.js'
import type AcademicYear from '../school_year/models/academic_year.js'
import type SchoolClass from '../school_year/models/school_class.js'
import { refuseViolations } from './messages.js'
import TimetableSlot from './models/timetable_slot.js'
import { checkRows, type RuleRow } from './rules.js'
import { parseClock, toClock } from './time.js'
import type { SlotKind } from './types.js'
import { loadYearState, ruleRowOf, type TimetableDeps, type YearState } from './year_state.js'

/**
 * The manual Jadwal form (D-247…D-251): add, change, delete and lock
 * rows of one class. Every save runs the shared rules against every row
 * of the year, under a lock on the year so two saves never race past a
 * teacher clash. Runs inside a tenant transaction of the school.
 */

export interface SlotInput {
  weekday: number
  startsAt: string
  endsAt: string
  kind: SlotKind
  /** Subject code, for lessons. */
  subject: string | null
  label: string | null
  jp: number | null
}

/**
 * Recomputes `period_no` of the given days from the start times
 * (D-247). The unique key is checked at commit.
 */
export async function renumberDays(classId: number, days: number[]) {
  for (const weekday of new Set(days)) {
    const rows = await TimetableSlot.query()
      .where('class_id', classId)
      .where('weekday', weekday)
      .orderBy('starts_at', 'asc')
      .orderBy('ends_at', 'asc')
      .orderBy('subject_id', 'asc')
      .orderBy('id', 'asc')
    for (const [index, row] of rows.entries()) {
      if (row.periodNo === index + 1) continue
      row.periodNo = index + 1
      await row.save()
    }
  }
}

/** Starts the work on a class's timetable: open year, year locked, state loaded. */
async function prepare(deps: TimetableDeps, year: AcademicYear) {
  refuseClosed(year)
  await lockYear(year)
  return loadYearState(deps, year)
}

function candidateRow(state: YearState, schoolClass: SchoolClass, input: SlotInput, key: string) {
  const start = parseClock(input.startsAt)
  if (start === null) throw new SchoolYearRuleError('starts_at', 'timetable.errors.time_format')
  const end = parseClock(input.endsAt)
  if (end === null) throw new SchoolYearRuleError('ends_at', 'timetable.errors.time_format')
  if (start >= end) throw new SchoolYearRuleError('ends_at', 'timetable.errors.end_before_start')

  if (input.kind !== 'lesson') {
    return {
      key,
      classId: schoolClass.id,
      weekday: input.weekday,
      start,
      end,
      kind: input.kind,
      label: input.label?.trim() || null,
      subjectId: null,
      jp: 0,
    } satisfies RuleRow
  }

  if (!input.subject) throw new SchoolYearRuleError('subject', 'timetable.errors.subject_required')
  const classState = state.classes.get(schoolClass.id)!
  const subject = classState.subjects.find((row) => row.code === input.subject)
  if (!subject) throw new SchoolYearRuleError('subject', 'timetable.errors.subject_unknown')
  if (input.jp === null) throw new SchoolYearRuleError('jp', 'timetable.errors.jp_required')
  return {
    key,
    classId: schoolClass.id,
    weekday: input.weekday,
    start,
    end,
    kind: 'lesson',
    label: null,
    subjectId: subject.subjectId,
    jp: input.jp,
  } satisfies RuleRow
}

export async function saveSlot(
  deps: TimetableDeps,
  schoolClass: SchoolClass,
  input: SlotInput,
  existing?: TimetableSlot
) {
  const state = await prepare(deps, schoolClass.academicYear)
  const key = existing ? String(existing.id) : 'new'
  const candidate = candidateRow(state, schoolClass, input, key)
  const rows = [...state.slots.filter((slot) => slot.id !== existing?.id).map(ruleRowOf), candidate]
  refuseViolations(
    checkRows(rows, state.context, (row) => row.key === key),
    state
  )

  const slot = existing ?? new TimetableSlot()
  const previousDay = existing?.weekday
  slot.merge({
    classId: schoolClass.id,
    weekday: candidate.weekday,
    startsAt: toClock(candidate.start),
    endsAt: toClock(candidate.end),
    kind: candidate.kind,
    label: candidate.label,
    subjectId: candidate.subjectId,
    jp: candidate.jp,
    // A new row goes to the end of its day until the renumbering below.
    periodNo: existing?.periodNo ?? 1000,
  })
  await slot.save()
  await renumberDays(schoolClass.id, [
    candidate.weekday,
    ...(previousDay === undefined ? [] : [previousDay]),
  ])
  return slot
}

export async function deleteSlot(
  deps: TimetableDeps,
  schoolClass: SchoolClass,
  slot: TimetableSlot
) {
  await prepare(deps, schoolClass.academicYear)
  await slot.delete()
  await renumberDays(schoolClass.id, [slot.weekday])
}

/** Locks or unlocks a row for the draft timetable (D-262). */
export async function setLocked(schoolClass: SchoolClass, slot: TimetableSlot, locked: boolean) {
  refuseClosed(schoolClass.academicYear)
  slot.isLocked = locked
  await slot.save()
}

export type SubjectStatus = 'complete' | 'under' | 'over' | 'no_allocation' | 'not_counted'

/**
 * JP per subject of a class against its allocation (D-250). A religion
 * without a teacher in the class is not counted (D-251); the timetable
 * is complete when every counted subject with an allocation matches.
 */
export function classSummary(state: YearState, classId: number) {
  const classState = state.classes.get(classId)!
  const lessons = state.slots.filter((slot) => slot.classId === classId && slot.kind === 'lesson')
  const scheduledOf = (subjectId: number) =>
    lessons.filter((slot) => slot.subjectId === subjectId).reduce((sum, slot) => sum + slot.jp, 0)

  const subjects = classState.subjects.map((subject) => {
    const teacherId = classState.rules.teacherOf.get(subject.subjectId) ?? null
    const scheduled = scheduledOf(subject.subjectId)
    const allocated = subject.jpPerWeek
    let status: SubjectStatus
    if (subject.religion !== null && teacherId === null) status = 'not_counted'
    else if (allocated === null) status = 'no_allocation'
    else if (scheduled === allocated) status = 'complete'
    else status = scheduled > allocated ? 'over' : 'under'
    return {
      code: subject.code,
      name: subject.name,
      religion: subject.religion,
      teacherName: teacherId === null ? null : (state.teacherNames.get(teacherId) ?? null),
      allocated,
      scheduled,
      status,
    }
  })
  const takenIds = new Set(classState.subjects.map((subject) => subject.subjectId))
  const stale = [...new Set(lessons.map((slot) => slot.subjectId!))]
    .filter((id) => !takenIds.has(id))
    .map((id) => ({
      code: state.subjects.get(id)?.code ?? '',
      name: state.subjects.get(id)?.name ?? '',
      scheduled: scheduledOf(id),
    }))

  const counted = subjects.filter(
    (row) => row.status !== 'not_counted' && row.status !== 'no_allocation'
  )
  return {
    subjects,
    stale,
    complete: counted.length > 0 && counted.every((row) => row.status === 'complete'),
    countedTotal: counted.length,
    countedComplete: counted.filter((row) => row.status === 'complete').length,
  }
}

/**
 * Broken limits that already sit in a class's rows, for example a clash
 * left by a homeroom change (D-248): shown as warnings on the Jadwal
 * page until the operator fixes them. A page that asks for several
 * classes passes the year's rows once (`yearRuleRows`) instead of
 * converting every row of the year again for each class (R1-11).
 */
export function classWarnings(
  state: YearState,
  classId: number,
  rows: RuleRow[] = yearRuleRows(state)
) {
  return checkRows(rows, state.context, (row) => row.classId === classId).filter(
    (violation) => violation.rule === 'teacher_clash' || violation.rule === 'over_allocation'
  )
}

/** Every row of the year in the shape the rules read. */
export function yearRuleRows(state: YearState): RuleRow[] {
  return state.slots.map(ruleRowOf)
}
