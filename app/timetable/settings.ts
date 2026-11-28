import { SchoolYearRuleError } from '../school_year/errors.js'
import { dayEnd, frameCapacity } from './frame.js'
import TimetableSetting, {
  type StoredFrameBreak,
  type StoredFrameDay,
} from './models/timetable_setting.js'
import { parseClock, toClock } from './time.js'
import {
  MAX_BREAKS,
  MAX_LESSONS_PER_DAY,
  preferenceKeys,
  weekdays,
  type DayFrame,
  type OpeningKind,
  type Preferences,
} from './types.js'

/**
 * The school's frame and switches for the draft timetable (D-262).
 * Runs inside a tenant transaction of the school.
 */

/**
 * Defaults until the operator saves their own: Monday to Thursday 7
 * lessons, Friday 5, Saturday 6, from 07.00; Upacara on Monday; two
 * breaks of 15 minutes. Every switch on.
 */
export const DEFAULT_FRAME: DayFrame = {
  days: weekdays.map((weekday) => ({
    weekday,
    startsAt: 7 * 60,
    lessons: weekday === 5 ? 5 : weekday === 6 ? 6 : 7,
    opening: weekday === 1 ? { kind: 'ceremony', label: null, minutes: 35 } : null,
  })),
  breaks: [
    { afterLesson: 3, minutes: 15 },
    { afterLesson: 6, minutes: 15 },
  ],
}

export const DEFAULT_PREFERENCES: Preferences = Object.fromEntries(
  preferenceKeys.map((key) => [key, true])
) as Preferences

const PREFERENCE_COLUMNS = {
  maxConsecutive: 'prefMaxConsecutive',
  pjokMorning: 'prefPjokMorning',
  coreEarly: 'prefCoreEarly',
  spreadWeek: 'prefSpreadWeek',
  noSplitBreak: 'prefNoSplitBreak',
} as const

/** Earliest start and latest end of a school day. */
export const EARLIEST_START = 5 * 60
export const LATEST_START = 12 * 60
export const LATEST_END = 18 * 60

export function frameFromStored(days: StoredFrameDay[], breaks: StoredFrameBreak[]): DayFrame {
  return {
    days: weekdays.map((weekday) => {
      const day = days.find((row) => row.weekday === weekday)
      return day
        ? {
            weekday,
            startsAt: parseClock(day.starts_at) ?? 7 * 60,
            lessons: day.lessons,
            opening: day.opening,
          }
        : { weekday, startsAt: 7 * 60, lessons: 0, opening: null }
    }),
    breaks: breaks.map((row) => ({ afterLesson: row.after_lesson, minutes: row.minutes })),
  }
}

export async function loadSettings() {
  const row = await TimetableSetting.query().first()
  if (!row) {
    return { frame: DEFAULT_FRAME, preferences: DEFAULT_PREFERENCES, saved: false }
  }
  const preferences = Object.fromEntries(
    preferenceKeys.map((key) => [key, row[PREFERENCE_COLUMNS[key]]])
  ) as Preferences
  return { frame: frameFromStored(row.days, row.breaks), preferences, saved: true }
}

export interface FrameDayInput {
  weekday: number
  startsAt: string
  lessons: number
  openingKind: OpeningKind | null
  openingLabel: string | null
  openingMinutes: number | null
}

/**
 * Checks and normalises the frame form. Field names follow the form
 * (`days.0.starts_at`, `breaks.1.minutes`).
 */
export function frameFromInput(
  days: FrameDayInput[],
  breaks: { afterLesson: number | null; minutes: number | null }[]
): DayFrame {
  const frame: DayFrame = { days: [], breaks: [] }
  days.forEach((day, index) => {
    if (!(weekdays as readonly number[]).includes(day.weekday)) {
      throw new SchoolYearRuleError(`days.${index}.lessons`, 'timetable.errors.frame_day')
    }
    const startsAt = parseClock(day.startsAt)
    if (startsAt === null || startsAt < EARLIEST_START || startsAt > LATEST_START) {
      throw new SchoolYearRuleError(`days.${index}.starts_at`, 'timetable.errors.frame_start')
    }
    if (day.lessons < 0 || day.lessons > MAX_LESSONS_PER_DAY) {
      throw new SchoolYearRuleError(`days.${index}.lessons`, 'timetable.errors.frame_lessons', {
        max: MAX_LESSONS_PER_DAY,
      })
    }
    let opening: DayFrame['days'][number]['opening'] = null
    if (day.openingKind && day.lessons > 0) {
      if (!day.openingMinutes || day.openingMinutes < 5 || day.openingMinutes > 120) {
        throw new SchoolYearRuleError(
          `days.${index}.opening_minutes`,
          'timetable.errors.frame_opening_minutes'
        )
      }
      opening = {
        kind: day.openingKind,
        label: day.openingKind === 'activity' ? day.openingLabel?.trim() || null : null,
        minutes: day.openingMinutes,
      }
    }
    if (frame.days.some((row) => row.weekday === day.weekday)) {
      throw new SchoolYearRuleError(`days.${index}.lessons`, 'timetable.errors.frame_day')
    }
    frame.days.push({ weekday: day.weekday, startsAt, lessons: day.lessons, opening })
  })

  breaks.forEach((row, index) => {
    if (row.afterLesson === null && row.minutes === null) return
    if (row.afterLesson === null || row.afterLesson < 1 || row.afterLesson >= MAX_LESSONS_PER_DAY) {
      throw new SchoolYearRuleError(
        `breaks.${index}.after_lesson`,
        'timetable.errors.frame_break_after'
      )
    }
    if (row.minutes === null || row.minutes < 5 || row.minutes > 60) {
      throw new SchoolYearRuleError(
        `breaks.${index}.minutes`,
        'timetable.errors.frame_break_minutes'
      )
    }
    if (frame.breaks.some((other) => other.afterLesson === row.afterLesson)) {
      throw new SchoolYearRuleError(
        `breaks.${index}.after_lesson`,
        'timetable.errors.frame_break_twice'
      )
    }
    frame.breaks.push({ afterLesson: row.afterLesson, minutes: row.minutes })
  })
  if (frame.breaks.length > MAX_BREAKS) {
    throw new SchoolYearRuleError(null, 'timetable.errors.frame_breaks_max', { max: MAX_BREAKS })
  }
  frame.breaks.sort((a, b) => a.afterLesson - b.afterLesson)

  if (frameCapacity(frame) === 0) {
    throw new SchoolYearRuleError(null, 'timetable.errors.frame_empty')
  }
  frame.days.forEach((day, index) => {
    const end = dayEnd(frame, day.weekday)
    if (end !== null && end > LATEST_END) {
      throw new SchoolYearRuleError(`days.${index}.lessons`, 'timetable.errors.frame_too_long')
    }
  })
  return frame
}

export async function saveSettings(frame: DayFrame, preferences: Preferences) {
  const row = (await TimetableSetting.query().first()) ?? new TimetableSetting()
  row.days = frame.days.map((day) => ({
    weekday: day.weekday,
    starts_at: toClock(day.startsAt),
    lessons: day.lessons,
    opening: day.opening,
  }))
  row.breaks = frame.breaks.map((item) => ({
    after_lesson: item.afterLesson,
    minutes: item.minutes,
  }))
  for (const key of preferenceKeys) row[PREFERENCE_COLUMNS[key]] = preferences[key]
  await row.save()
  return row
}
