/**
 * Vocabulary of the calendar domain (D-253…D-261, D-379, D-380, D-466).
 * The same lists feed the database CHECKs of `calendar_items`
 * (migration 1764360000001), so code and database never drift.
 */

export const CALENDAR_DOMAIN = 'calendar'

/** National kinds (SKB, D-253) come only from the national package. */
export const NATIONAL_KINDS = ['national_holiday', 'joint_leave'] as const
/** Event kinds a region or a school adds (D-259: each one is a non-effective day). */
export const EVENT_KINDS = ['holiday', 'exam', 'school_event', 'no_lessons'] as const
export type EventKind = (typeof EVENT_KINDS)[number]

/**
 * `note`: shown, never counted (SAS windows and milestones of an official
 * calendar, D-379). `setting`: one frame value per key (§3.3).
 */
export const CALENDAR_ITEM_KINDS = [...NATIONAL_KINDS, ...EVENT_KINDS, 'note', 'setting'] as const
export type CalendarItemKind = (typeof CALENDAR_ITEM_KINDS)[number]

export const EXAM_TYPES = ['sts', 'sas', 'other'] as const
export type ExamType = (typeof EXAM_TYPES)[number]

/** The school-year frame as `setting` items; the nearest layer wins unless mandatory. */
export const FRAME_KEYS = [
  'FRAME-starts_on',
  'FRAME-even_semester_starts_on',
  'FRAME-ends_on',
  'FRAME-school_days_per_week',
] as const
export type FrameKey = (typeof FRAME_KEYS)[number]

/** Kinds that make a day off for everyone (Libur column of D-259). */
export const DAY_OFF_KINDS: readonly CalendarItemKind[] = [
  'national_holiday',
  'joint_leave',
  'holiday',
]

/** The value of a resolved calendar item (calendar_items row, adapter-mapped). */
export interface CalendarValue {
  kind: CalendarItemKind
  examType: ExamType | null
  title: string
  startsOn: string | null
  endsOn: string | null
  classId: number | null
  settingValue: string | null
}

/** What a school proposes or adds: one event. */
export interface CalendarEventPayload {
  kind: EventKind
  exam_type?: ExamType
  title: string
  starts_on: string
  ends_on: string
  class_id?: number
}
