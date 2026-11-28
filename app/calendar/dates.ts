/**
 * Plain ISO-date helpers (`YYYY-MM-DD`, no time zone): calendar days are
 * dates in WIB (D-165), so arithmetic runs on UTC midnights.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

/** ISO weekday: 1 Monday … 7 Sunday. */
export function isoWeekday(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

/** Every date from `start` to `end`, both included. */
export function* eachDay(start: string, end: string) {
  for (let date = start; date <= end; date = addDays(date, 1)) yield date
}

/** `2026-11-10` → `10/11/2026` (D-165, D-472). */
export function shortDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

/** A Date or a string from the database → `YYYY-MM-DD`. */
export function toIsoDate(value: string | Date) {
  if (typeof value === 'string') return value.slice(0, 10)
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}
