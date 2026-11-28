import { MAX_JP, MIN_JP, slotKinds, weekdays, type PlainRow } from './types.js'

/**
 * The hard limits of a timetable (D-247…D-251), as pure checks shared
 * by the manual Jadwal form, the draft save and the generator's
 * property tests. Nothing here reads the database.
 *
 * - A row has a weekday 1–6, starts before it ends; a lesson has a
 *   subject and 1–4 JP, other rows have neither (D-247).
 * - Rows of one class never overlap, except lessons of different
 *   religion subjects, which run in parallel (D-251).
 * - A lesson's subject is one the class takes and has a teacher in the
 *   class (D-249).
 * - A subject's JP per week never exceeds its allocation (D-250).
 * - A teacher never has two lessons at overlapping times, in any class
 *   of the year (D-248).
 */

export interface RuleRow extends PlainRow {
  /** Identity of the row (its id, or a key for a new row). */
  key: string
  classId: number
}

export interface ClassRules {
  id: number
  name: string
  /** Subjects the class takes → JP per week (null = no cap). */
  taken: Map<number, number | null>
  /** Subject → teacher user id, from the teaching assignments (D-249). */
  teacherOf: Map<number, number>
}

export interface RuleContext {
  classes: Map<number, ClassRules>
  /** Subject → religion (the six Pendidikan Agama subjects), else null. */
  religionOf: Map<number, string | null>
}

export type Violation =
  | { rule: 'invalid_row'; row: RuleRow }
  | { rule: 'class_overlap'; row: RuleRow; other: RuleRow }
  | { rule: 'teacher_clash'; row: RuleRow; other: RuleRow; teacherId: number }
  | { rule: 'no_teacher'; row: RuleRow }
  | { rule: 'subject_not_taken'; row: RuleRow }
  | {
      rule: 'over_allocation'
      row: RuleRow
      subjectId: number
      scheduled: number
      allocated: number
    }

export function overlaps(a: PlainRow, b: PlainRow) {
  return a.weekday === b.weekday && a.start < b.end && b.start < a.end
}

/** Lessons of two different religions may share the time (D-251). */
export function mayShareTime(a: PlainRow, b: PlainRow, religionOf: Map<number, string | null>) {
  if (a.kind !== 'lesson' || b.kind !== 'lesson') return false
  const first = religionOf.get(a.subjectId!) ?? null
  const second = religionOf.get(b.subjectId!) ?? null
  return first !== null && second !== null && first !== second
}

export function isValidRow(row: PlainRow) {
  if (!(weekdays as readonly number[]).includes(row.weekday)) return false
  if (!(slotKinds as readonly string[]).includes(row.kind)) return false
  if (!Number.isInteger(row.start) || !Number.isInteger(row.end)) return false
  if (row.start < 0 || row.end > 24 * 60 || row.start >= row.end) return false
  if (row.kind === 'lesson') {
    return row.subjectId !== null && row.jp >= MIN_JP && row.jp <= MAX_JP && row.label === null
  }
  return row.subjectId === null && row.jp === 0
}

/** The teacher of a lesson row, through the class's assignments (D-249). */
export function teacherOfRow(row: RuleRow, context: RuleContext) {
  if (row.kind !== 'lesson' || row.subjectId === null) return null
  return context.classes.get(row.classId)?.teacherOf.get(row.subjectId) ?? null
}

function groupBy<T>(items: T[], keyOf: (item: T) => string | null) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    if (key === null) continue
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  return groups
}

/**
 * Every broken hard limit that involves a row for which `focus` is
 * true. Rows outside the focus are context only: an older row whose
 * teacher was cleared later is not reported (D-249), but a new row that
 * clashes with it is.
 */
export function checkRows(
  rows: RuleRow[],
  context: RuleContext,
  focus: (row: RuleRow) => boolean = () => true
): Violation[] {
  const violations: Violation[] = []
  const inFocus = new Set(rows.filter(focus).map((row) => row.key))
  const valid = rows.filter((row) => isValidRow(row))

  for (const row of rows) {
    if (!inFocus.has(row.key)) continue
    if (!isValidRow(row)) {
      violations.push({ rule: 'invalid_row', row })
      continue
    }
    if (row.kind !== 'lesson') continue
    const schoolClass = context.classes.get(row.classId)
    if (!schoolClass || !schoolClass.taken.has(row.subjectId!)) {
      violations.push({ rule: 'subject_not_taken', row })
    } else if (!schoolClass.teacherOf.has(row.subjectId!)) {
      violations.push({ rule: 'no_teacher', row })
    }
  }

  // Overlap inside one class (D-247, D-251).
  for (const group of groupBy(valid, (row) => `${row.classId}|${row.weekday}`).values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const [a, b] = [group[i], group[j]]
        if (!inFocus.has(a.key) && !inFocus.has(b.key)) continue
        if (!overlaps(a, b) || mayShareTime(a, b, context.religionOf)) continue
        const [row, other] = inFocus.has(a.key) ? [a, b] : [b, a]
        violations.push({ rule: 'class_overlap', row, other })
      }
    }
  }

  // Teacher clashes across the year (D-248).
  const lessons = valid.filter((row) => row.kind === 'lesson')
  const byTeacher = groupBy(lessons, (row) => {
    const teacher = teacherOfRow(row, context)
    return teacher === null ? null : `${teacher}|${row.weekday}`
  })
  for (const [key, group] of byTeacher) {
    const teacherId = Number(key.split('|')[0])
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const [a, b] = [group[i], group[j]]
        if (!inFocus.has(a.key) && !inFocus.has(b.key)) continue
        if (!overlaps(a, b)) continue
        const [row, other] = inFocus.has(a.key) ? [a, b] : [b, a]
        violations.push({ rule: 'teacher_clash', row, other, teacherId })
      }
    }
  }

  // Allocation per class and subject (D-250).
  for (const group of groupBy(lessons, (row) => `${row.classId}|${row.subjectId}`).values()) {
    const focused = group.find((row) => inFocus.has(row.key))
    if (!focused) continue
    const allocated = context.classes.get(focused.classId)?.taken.get(focused.subjectId!)
    if (allocated === undefined || allocated === null) continue
    const scheduled = group.reduce((sum, row) => sum + row.jp, 0)
    if (scheduled > allocated) {
      violations.push({
        rule: 'over_allocation',
        row: focused,
        subjectId: focused.subjectId!,
        scheduled,
        allocated,
      })
    }
  }

  return violations
}
