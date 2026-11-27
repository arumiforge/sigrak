/**
 * Indonesian date formatting (Fondasi ui.md: "25 November 2026"). Dates
 * are plain "YYYY-MM-DD" strings from the server; they are parsed as UTC
 * midnight and formatted in UTC, so no device timezone shifts a day.
 */
const locale = 'id-ID'

export function parseDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

const longDate = new Intl.DateTimeFormat(locale, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' })
const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' })
const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
const monthYear = new Intl.DateTimeFormat(locale, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatDate(iso: string) {
  return longDate.format(parseDate(iso))
}

export function formatWeekday(iso: string) {
  return weekdayLong.format(parseDate(iso))
}

export function formatMonth(monthKey: string) {
  return monthYear.format(parseDate(`${monthKey}-01`))
}

/**
 * "7–12 Desember 2026", "21 Desember 2026 – 1 Januari 2027", or one date.
 */
export function formatRange(startIso: string, endIso: string) {
  if (startIso === endIso) {
    return formatDate(startIso)
  }
  const sameYear = startIso.slice(0, 4) === endIso.slice(0, 4)
  const sameMonth = sameYear && startIso.slice(0, 7) === endIso.slice(0, 7)
  if (sameMonth) {
    return `${parseDate(startIso).getUTCDate()}–${formatDate(endIso)}`
  }
  if (sameYear) {
    return `${dayMonth.format(parseDate(startIso))} – ${formatDate(endIso)}`
  }
  return `${formatDate(startIso)} – ${formatDate(endIso)}`
}

/**
 * Short weekday names starting Monday: Sen, Sel, Rab, Kam, Jum, Sab, Min.
 */
export function weekdayNames() {
  // 2026-01-05 is a Monday.
  return Array.from({ length: 7 }, (_, index) =>
    weekdayShort.format(new Date(Date.UTC(2026, 0, 5 + index)))
  )
}

export function monthKeyOf(iso: string) {
  return iso.slice(0, 7)
}

export function addMonths(monthKey: string, delta: number) {
  const date = parseDate(`${monthKey}-01`)
  date.setUTCMonth(date.getUTCMonth() + delta)
  return toIsoDate(date).slice(0, 7)
}

/**
 * Days of a month view: whole weeks from Monday to Sunday, with null for
 * the days outside the month.
 */
export function monthGrid(monthKey: string): (string | null)[] {
  const first = parseDate(`${monthKey}-01`)
  const daysInMonth = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)
  ).getUTCDate()
  const leading = (first.getUTCDay() + 6) % 7
  const cells: (string | null)[] = Array.from({ length: leading }, () => null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${monthKey}-${String(day).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }
  return cells
}
