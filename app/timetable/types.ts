/**
 * Shared types and constants of the timetable (D-247…D-251, D-262).
 * Plain data only, so the pure generator can run in a CPU pool thread.
 */

export const slotKinds = ['lesson', 'break', 'ceremony', 'activity'] as const
export type SlotKind = (typeof slotKinds)[number]

/** Non-lesson rows a day frame may open with (D-247). */
export const openingKinds = ['ceremony', 'activity'] as const
export type OpeningKind = (typeof openingKinds)[number]

/** Monday (1) to Saturday (6). */
export const weekdays = [1, 2, 3, 4, 5, 6] as const

/** 1 JP = 35 minutes (data model, D-250). */
export const JP_MINUTES = 35
export const MIN_JP = 1
export const MAX_JP = 4

/** Lessons per day the frame allows, and breaks per day. */
export const MAX_LESSONS_PER_DAY = 12
export const MAX_BREAKS = 3

/**
 * The soft preferences of D-262: on/off switches per school, without
 * weights. They only change which valid timetable the generator picks.
 */
export const preferenceKeys = [
  'maxConsecutive',
  'pjokMorning',
  'coreEarly',
  'spreadWeek',
  'noSplitBreak',
] as const
export type PreferenceKey = (typeof preferenceKeys)[number]
export type Preferences = Record<PreferenceKey, boolean>

/** One weekday of the frame: start, lesson count, optional opening row. */
export interface FrameDay {
  weekday: number
  /** Minutes after midnight. */
  startsAt: number
  /** 0 = no school that day. */
  lessons: number
  opening: { kind: OpeningKind; label: string | null; minutes: number } | null
}

/** Istirahat after lesson `afterLesson` on every day that has a lesson after it. */
export interface FrameBreak {
  afterLesson: number
  minutes: number
}

export interface DayFrame {
  days: FrameDay[]
  breaks: FrameBreak[]
}

/** A timetable row as plain data (times in minutes after midnight). */
export interface PlainRow {
  weekday: number
  start: number
  end: number
  kind: SlotKind
  label: string | null
  subjectId: number | null
  jp: number
}

/** Why JP of a subject could not be placed in a draft. */
export const unplacedReasons = ['no_teacher', 'no_room', 'teacher_busy'] as const
export type UnplacedReason = (typeof unplacedReasons)[number]

/** Subject codes the soft preferences name (subjects.json). */
export const PJOK_CODE = 'PJOK'
export const CORE_CODES = ['MTK', 'BIN'] as const
