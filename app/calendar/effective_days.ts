import type { ResolvedItem } from '../layers/resolver/resolve_core.js'
import { eachDay, isoWeekday } from './dates.js'
import { schoolWeekdays, type CalendarFrame } from './frame.js'
import type { CalendarValue } from './types.js'

/**
 * Effective days and weeks per class (D-259, D-379): school days of the
 * class's week inside the frame, minus national holidays, active joint
 * leave and every `holiday`, `exam`, `school_event` and `no_lessons`
 * event of the school or of that class. Notes and settings never count.
 *
 * Each non-effective school day is counted once, in the first matching
 * column: Libur (national holiday, joint leave, school holiday), then
 * Asesmen (exam), then Kegiatan (school event, no lessons). Effective
 * weeks = effective days ÷ school days per week, kept in full and shown
 * to one decimal.
 */

export type DayReason = 'holiday' | 'assessment' | 'activity'

export type Totals = {
  schoolDays: number
  holidays: number
  assessments: number
  activities: number
  effectiveDays: number
  effectiveWeeks: number
}

export type MonthRow = Totals & {
  /** `YYYY-MM` */
  month: string
  semester: 1 | 2
}

export type EffectiveDays = {
  daysPerWeek: number
  rows: MonthRow[]
  semesters: [Totals, Totals]
  total: Totals
}

export interface EffectiveDaysInput {
  frame: CalendarFrame
  items: ResolvedItem<CalendarValue>[]
  /** A class id, or null for the whole school (events of one class do not count). */
  classId: number | null
  /** The class's lesson weekdays (ISO 1–7), from the timetable when there is one. */
  weekdays?: Set<number>
}

const reasonOf: Record<string, DayReason | null> = {
  national_holiday: 'holiday',
  joint_leave: 'holiday',
  holiday: 'holiday',
  exam: 'assessment',
  school_event: 'activity',
  no_lessons: 'activity',
  note: null,
  setting: null,
}
const rank: Record<DayReason, number> = { holiday: 0, assessment: 1, activity: 2 }

function emptyTotals(): Totals {
  return {
    schoolDays: 0,
    holidays: 0,
    assessments: 0,
    activities: 0,
    effectiveDays: 0,
    effectiveWeeks: 0,
  }
}

/** True when the item counts for the class (whole-school items count for every class). */
export function appliesTo(item: ResolvedItem<CalendarValue>, classId: number | null) {
  return item.value.classId === null || item.value.classId === classId
}

/**
 * Date → the reason and title of every non-effective school day of the
 * frame for a class (the shift preview compares two of these).
 */
export function nonEffectiveDays(input: EffectiveDaysInput) {
  const weekdays = input.weekdays ?? schoolWeekdays(input.frame.schoolDaysPerWeek)
  const days = new Map<string, { reason: DayReason; title: string }>()
  for (const item of input.items) {
    const reason = reasonOf[item.value.kind]
    if (!reason || item.value.startsOn === null || !appliesTo(item, input.classId)) continue
    const start =
      item.value.startsOn > input.frame.startsOn ? item.value.startsOn : input.frame.startsOn
    const end = item.value.endsOn! < input.frame.endsOn ? item.value.endsOn! : input.frame.endsOn
    if (start > end) continue
    for (const date of eachDay(start, end)) {
      if (!weekdays.has(isoWeekday(date))) continue
      const held = days.get(date)
      if (!held || rank[reason] < rank[held.reason]) {
        days.set(date, { reason, title: item.value.title })
      }
    }
  }
  return days
}

export function effectiveDays(input: EffectiveDaysInput): EffectiveDays {
  const { frame } = input
  const weekdays = input.weekdays ?? schoolWeekdays(frame.schoolDaysPerWeek)
  const daysPerWeek = weekdays.size
  const off = nonEffectiveDays({ ...input, weekdays })
  const rows = new Map<string, MonthRow>()
  const semesters: [Totals, Totals] = [emptyTotals(), emptyTotals()]
  const total = emptyTotals()

  for (const date of eachDay(frame.startsOn, frame.endsOn)) {
    if (!weekdays.has(isoWeekday(date))) continue
    const semester: 1 | 2 = date < frame.evenSemesterStartsOn ? 1 : 2
    const month = date.slice(0, 7)
    const key = `${semester}|${month}`
    let row = rows.get(key)
    if (!row) {
      row = { month, semester, ...emptyTotals() }
      rows.set(key, row)
    }
    const reason = off.get(date)?.reason
    for (const totals of [row, semesters[semester - 1], total]) {
      totals.schoolDays++
      if (reason === 'holiday') totals.holidays++
      else if (reason === 'assessment') totals.assessments++
      else if (reason === 'activity') totals.activities++
      else totals.effectiveDays++
    }
  }

  const withWeeks = <T extends Totals>(totals: T): T => ({
    ...totals,
    effectiveWeeks: daysPerWeek === 0 ? 0 : totals.effectiveDays / daysPerWeek,
  })
  return {
    daysPerWeek,
    rows: [...rows.values()].map(withWeeks),
    semesters: [withWeeks(semesters[0]), withWeeks(semesters[1])],
    total: withWeeks(total),
  }
}
