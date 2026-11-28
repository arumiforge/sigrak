import { DateTime } from 'luxon'
import { isSchoolYear, schoolYearStart } from '../curriculum/school_year.js'

const ZONE = 'Asia/Jakarta'

/**
 * School-year helpers for the layer model. A school year runs from
 * 1 July to 30 June until R1-06 stores real school years with their own
 * dates (the same stand-in as app/regions/effective_dates.ts).
 */
export function todayIso(now: DateTime = DateTime.now()) {
  return now.setZone(ZONE).toISODate()!
}

export function schoolYearOf(date: string) {
  const day = DateTime.fromISO(date, { zone: ZONE })
  const start = day.month >= 7 ? day.year : day.year - 1
  return `${start}/${start + 1}`
}

export function currentSchoolYear(now: DateTime = DateTime.now()) {
  return schoolYearOf(todayIso(now))
}

export function schoolYearBounds(schoolYear: string) {
  const start = schoolYearStart(schoolYear)
  return { startsOn: `${start}-07-01`, endsOn: `${start + 1}-06-30` }
}

/**
 * The day a resolution is read for: today when it falls inside the
 * school year, else the year's first day (a coming year) or last day (a
 * past one).
 */
export function resolutionDay(schoolYear: string, today = todayIso()) {
  const { startsOn, endsOn } = schoolYearBounds(schoolYear)
  if (today < startsOn) return startsOn
  if (today > endsOn) return endsOn
  return today
}

/**
 * True when a package's school-year range covers `schoolYear`.
 */
export function coversSchoolYear(from: string, to: string | null, schoolYear: string) {
  const year = schoolYearStart(schoolYear)
  return schoolYearStart(from) <= year && (to === null || year <= schoolYearStart(to))
}

export { isSchoolYear }
