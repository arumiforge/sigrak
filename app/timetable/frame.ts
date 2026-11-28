import { JP_MINUTES, type DayFrame, type PlainRow } from './types.js'

/**
 * The day frame of the draft timetable (D-262) turned into times: per
 * weekday the opening row, the lesson periods of 35 minutes and the
 * breaks between them. Pure.
 */

export interface FramePeriod {
  weekday: number
  /** 0-based place among the day's lessons. */
  index: number
  start: number
  end: number
}

export interface ExpandedDay {
  weekday: number
  periods: FramePeriod[]
  /** Opening and break rows of the day. */
  extras: PlainRow[]
}

export function expandFrame(frame: DayFrame): ExpandedDay[] {
  const breaks = new Map(frame.breaks.map((row) => [row.afterLesson, row.minutes]))
  return [...frame.days]
    .filter((day) => day.lessons > 0)
    .sort((a, b) => a.weekday - b.weekday)
    .map((day) => {
      const extras: PlainRow[] = []
      const periods: FramePeriod[] = []
      let time = day.startsAt
      if (day.opening) {
        extras.push({
          weekday: day.weekday,
          start: time,
          end: time + day.opening.minutes,
          kind: day.opening.kind,
          label: day.opening.label,
          subjectId: null,
          jp: 0,
        })
        time += day.opening.minutes
      }
      for (let index = 0; index < day.lessons; index++) {
        periods.push({ weekday: day.weekday, index, start: time, end: time + JP_MINUTES })
        time += JP_MINUTES
        const pause = breaks.get(index + 1)
        if (pause && index + 1 < day.lessons) {
          extras.push({
            weekday: day.weekday,
            start: time,
            end: time + pause,
            kind: 'break',
            label: null,
            subjectId: null,
            jp: 0,
          })
          time += pause
        }
      }
      return { weekday: day.weekday, periods, extras }
    })
}

/** Lessons per week in the frame. */
export function frameCapacity(frame: DayFrame) {
  return frame.days.reduce((sum, day) => sum + day.lessons, 0)
}

/** When the day ends, in minutes after midnight. */
export function dayEnd(frame: DayFrame, weekday: number) {
  const day = expandFrame(frame).find((row) => row.weekday === weekday)
  if (!day) return null
  const ends = [...day.periods.map((row) => row.end), ...day.extras.map((row) => row.end)]
  return Math.max(...ends)
}
