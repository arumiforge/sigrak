import { DateTime } from 'luxon'
import type { RegionChangeApplyFrom } from '#models/region_change_review'

const ZONE = 'Asia/Jakarta'

/**
 * Today in WIB as "YYYY-MM-DD" (D-165).
 */
export function todayInJakarta(now: DateTime = DateTime.now()) {
  return now.setZone(ZONE).toISODate()!
}

/**
 * First day of the next school year. A school year runs from July to
 * June, so it is 1 July of this year before July, else of next year.
 * Until R1-06 stores school years, 1 July stands for the start; the
 * region calendars start a little later (Jawa Tengah 2026/2027: 13 July),
 * and nothing happens at school in between.
 */
export function nextSchoolYearStart(today: string) {
  const date = DateTime.fromISO(today, { zone: ZONE })
  const year = date.month >= 7 ? date.year + 1 : date.year
  return `${year}-07-01`
}

/**
 * The day an accepted region change takes effect (D-466): the next day,
 * or the first day of the next school year.
 */
export function effectiveOn(applyFrom: RegionChangeApplyFrom, today: string) {
  if (applyFrom === 'next_school_year') return nextSchoolYearStart(today)
  return DateTime.fromISO(today, { zone: ZONE }).plus({ days: 1 }).toISODate()!
}
