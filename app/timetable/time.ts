import { JP_MINUTES, MAX_JP, MIN_JP } from './types.js'

/**
 * Times of day as minutes after midnight. The database stores `time`
 * columns (`07:00:00`); forms send `07:00`; the UI shows `07.00` (EYD,
 * D-471).
 */

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/

/** `07:35` or `07:35:00` → 455; null for anything else. */
export function parseClock(value: string): number | null {
  const match = CLOCK.exec(value.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/** 455 → `07:35` (form values and the database). */
export function toClock(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

/** 455 → `07.35` (shown text, EYD). */
export function toDisplayTime(minutes: number) {
  return toClock(minutes).replace(':', '.')
}

/**
 * The JP suggested for a row of this length (D-250): 35 minutes per JP,
 * rounded, within 1–4. The operator may change it.
 */
export function suggestedJp(minutes: number) {
  return Math.min(MAX_JP, Math.max(MIN_JP, Math.round(minutes / JP_MINUTES)))
}
