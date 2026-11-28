import type { ResolvedItem } from '../layers/resolver/resolve_core.js'
import { isoWeekday, shortDate } from './dates.js'
import { appliesTo } from './effective_days.js'
import { schoolWeekdays, type CalendarFrame } from './frame.js'
import type { CalendarValue, EventKind, ExamType } from './types.js'

/**
 * One conflict checker for every dated item (D-260). It runs when an
 * event is added or changed, when a proposal is sent and again when it
 * is approved (D-380). Rules of later slices (timetable meetings,
 * supervision, Agenda & Rapat) join here.
 *
 * Refused: an event outside the school year; an STS or SAS on a
 * national holiday or an active joint-leave day.
 * Warning only: an event that starts or ends on a day without lessons
 * (Sunday, or Saturday in a 5-day week).
 */

export interface ConflictIssue {
  /** Key in resources/lang/id/calendar.json. */
  key: string
  values: Record<string, string>
}

export interface ConflictResult {
  errors: ConflictIssue[]
  warnings: ConflictIssue[]
}

export interface CheckedEvent {
  kind: EventKind
  examType: ExamType | null
  startsOn: string
  endsOn: string
  classId: number | null
}

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export const ConflictChecker = {
  checkEvent(
    event: CheckedEvent,
    context: { frame: CalendarFrame; items: ResolvedItem<CalendarValue>[]; weekdays?: Set<number> }
  ): ConflictResult {
    const { frame } = context
    const errors: ConflictIssue[] = []
    const warnings: ConflictIssue[] = []

    if (event.startsOn < frame.startsOn || event.endsOn > frame.endsOn) {
      errors.push({
        key: 'calendar.errors.outside_year',
        values: { start: shortDate(frame.startsOn), end: shortDate(frame.endsOn) },
      })
    }

    if (event.kind === 'exam' && (event.examType === 'sts' || event.examType === 'sas')) {
      const offDays = context.items.filter(
        (item) =>
          (item.value.kind === 'national_holiday' || item.value.kind === 'joint_leave') &&
          item.value.startsOn !== null &&
          appliesTo(item, event.classId) &&
          item.value.startsOn <= event.endsOn &&
          item.value.endsOn! >= event.startsOn
      )
      const clash = offDays.sort((a, b) => (a.value.startsOn! < b.value.startsOn! ? -1 : 1))[0]
      if (clash) {
        const date = clash.value.startsOn! < event.startsOn ? event.startsOn : clash.value.startsOn!
        errors.push({
          key: 'calendar.errors.exam_on_holiday',
          values: { date: shortDate(date), name: clash.value.title },
        })
      }
    }

    if (event.kind !== 'holiday') {
      const weekdays = context.weekdays ?? schoolWeekdays(frame.schoolDaysPerWeek)
      for (const date of new Set([event.startsOn, event.endsOn])) {
        const weekday = isoWeekday(date)
        if (!weekdays.has(weekday)) {
          warnings.push({
            key: 'calendar.warnings.non_school_day',
            values: { date: shortDate(date), day: DAY_NAMES[weekday - 1] },
          })
        }
      }
    }

    return { errors, warnings }
  },
}
