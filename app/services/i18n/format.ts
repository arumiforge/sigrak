/**
 * Indonesian formats for UI, exports and imports (CLAUDE.md, D-150,
 * D-165): dates d/m/Y, numbers 1.234.567,89, money Rp1.234.567, times
 * in WIB (Asia/Jakarta).
 *
 * This file has no imports, so the browser bundle reuses it through
 * inertia/lib/format.ts and both sides format the same way.
 */
export const APP_LOCALE = 'id-ID'
export const APP_TIMEZONE = 'Asia/Jakarta'

type DateInput = Date | string

const PLAIN_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const jakartaParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * Calendar date and clock time in WIB. A plain "YYYY-MM-DD" string is a
 * date without a time and is taken as written, so no timezone shifts it.
 */
function wallClock(value: DateInput) {
  if (typeof value === 'string') {
    const plain = PLAIN_DATE.exec(value)
    if (plain) {
      return { year: plain[1], month: plain[2], day: plain[3], hour: '00', minute: '00' }
    }
  }
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: ${String(value)}`)
  }
  const parts = Object.fromEntries(
    jakartaParts.formatToParts(date).map((part) => [part.type, part.value])
  )
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  }
}

/** "25/11/2026" (d/m/Y, WIB). */
export function formatShortDate(value: DateInput) {
  const { year, month, day } = wallClock(value)
  return `${day}/${month}/${year}`
}

/** "14.30" (WIB, Indonesian time separator). */
export function formatTime(value: DateInput) {
  const { hour, minute } = wallClock(value)
  return `${hour}.${minute}`
}

/** "25/11/2026 14.30" (WIB). */
export function formatDateTime(value: DateInput) {
  return `${formatShortDate(value)} ${formatTime(value)}`
}

/** The WIB calendar date of an instant as "YYYY-MM-DD", e.g. today in WIB. */
export function toJakartaDate(value: DateInput = new Date()) {
  const { year, month, day } = wallClock(value)
  return `${year}-${month}-${day}`
}

const numberFormats = new Map<string, Intl.NumberFormat>()

function numberFormat(minimumFractionDigits: number, maximumFractionDigits: number) {
  const cacheKey = `${minimumFractionDigits}:${maximumFractionDigits}`
  let format = numberFormats.get(cacheKey)
  if (!format) {
    format = new Intl.NumberFormat(APP_LOCALE, { minimumFractionDigits, maximumFractionDigits })
    numberFormats.set(cacheKey, format)
  }
  return format
}

/**
 * "1.234.567,89". Up to two decimals by default; pass `decimals` for a
 * fixed number of digits after the comma.
 */
export function formatNumber(value: number, options: { decimals?: number } = {}) {
  const { decimals } = options
  return decimals === undefined
    ? numberFormat(0, 2).format(value)
    : numberFormat(decimals, decimals).format(value)
}

/** "Rp1.234.567" (no space, PUEBI); "-Rp5.000" for a negative amount. */
export function formatCurrency(value: number, options: { decimals?: number } = {}) {
  const decimals = options.decimals ?? 0
  const amount = numberFormat(decimals, decimals).format(Math.abs(value))
  return `${value < 0 ? '-' : ''}Rp${amount}`
}

/**
 * Reads an Indonesian number back ("1.234.567,89", "Rp 5.000", "12,5").
 * Dots group thousands and the comma is the decimal sign. Returns null
 * for text that is not a number.
 */
export function parseNumber(text: string): number | null {
  const cleaned = text
    .trim()
    .replace(/^(-?)\s*rp\.?\s*/i, '$1')
    .replace(/\s/g, '')
  if (!/^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(cleaned)) {
    return null
  }
  return Number(cleaned.replace(/\./g, '').replace(',', '.'))
}

/**
 * Reads a d/m/Y date back ("25/11/2026", "5/1/2027") as "YYYY-MM-DD".
 * Returns null when the text is not a real calendar date.
 */
export function parseShortDate(text: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim())
  if (!match) {
    return null
  }
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return `${match[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
