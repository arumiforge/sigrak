import i18nManager from '@adonisjs/i18n/services/main'
import { SchoolYearRuleError } from '../school_year/errors.js'
import type { RuleRow, Violation } from './rules.js'
import { toDisplayTime } from './time.js'
import { weekdayKey } from './types.js'
import type { YearState } from './year_state.js'

/**
 * Turns a broken timetable rule into the message the operator reads:
 * it names the class, the day and the time (D-248), and the form field
 * it belongs to. Keys live in `resources/lang/id/timetable.json`.
 */

export interface RuleMessage {
  field: string | null
  key: string
  params: Record<string, string | number>
}

function dayName(weekday: number) {
  return i18nManager.locale('id').t(`timetable.weekdays.${weekdayKey(weekday)}`)
}

function rowName(row: RuleRow, state: YearState) {
  const t = i18nManager.locale('id')
  if (row.kind === 'lesson') return state.subjects.get(row.subjectId!)?.name ?? ''
  return row.label ?? t.t(`timetable.kinds.${row.kind}`)
}

function timeParams(row: RuleRow) {
  return {
    day: dayName(row.weekday),
    start: toDisplayTime(row.start),
    end: toDisplayTime(row.end),
  }
}

export function describeViolation(violation: Violation, state: YearState): RuleMessage {
  const subject = (row: RuleRow) => state.subjects.get(row.subjectId ?? 0)?.name ?? ''
  switch (violation.rule) {
    case 'invalid_row':
      return { field: 'starts_at', key: 'timetable.errors.invalid_row', params: {} }
    case 'subject_not_taken':
      return {
        field: 'subject',
        key: 'timetable.errors.subject_not_taken',
        params: { subject: subject(violation.row) },
      }
    case 'no_teacher':
      return {
        field: 'subject',
        key: 'timetable.errors.no_teacher',
        params: { subject: subject(violation.row) },
      }
    case 'class_overlap':
      return {
        field: 'starts_at',
        key: 'timetable.errors.class_overlap',
        params: { other: rowName(violation.other, state), ...timeParams(violation.other) },
      }
    case 'teacher_clash':
      return {
        field: 'subject',
        key:
          violation.row.classId === violation.other.classId
            ? 'timetable.errors.teacher_clash_same_class'
            : 'timetable.errors.teacher_clash',
        params: {
          teacher: state.teacherNames.get(violation.teacherId) ?? '',
          class: state.classes.get(violation.other.classId)?.model.name ?? '',
          ...timeParams(violation.other),
        },
      }
    case 'over_allocation':
      return {
        field: 'jp',
        key: 'timetable.errors.over_allocation',
        params: {
          subject: state.subjects.get(violation.subjectId)?.name ?? '',
          scheduled: violation.scheduled,
          allocated: violation.allocated,
        },
      }
  }
}

/** Throws the first violation as a rule error for the form. */
export function refuseViolations(violations: Violation[], state: YearState, field?: string) {
  const [first] = violations
  if (!first) return
  const message = describeViolation(first, state)
  throw new SchoolYearRuleError(field ?? message.field, message.key, message.params)
}
