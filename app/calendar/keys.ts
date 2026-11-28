import { createHash } from 'node:crypto'
import { normaliseLabel } from '../layers/domains/domain_adapter.js'

/**
 * Item and match keys of calendar items (docs/drafts/regional-layers.md
 * §5.6). Keys stay stable across imports, so hides and revisions keep
 * pointing at the same day.
 */

/** `HOL-2027-02-05-joint_leave`: a national holiday or joint leave day (R1-07 case 5). */
export function holidayKey(date: string, kind: 'national_holiday' | 'joint_leave') {
  return `HOL-${date}-${kind}`
}

function shortHash(text: string) {
  return createHash('sha256').update(text).digest('hex').slice(0, 8)
}

/** `EV-2026-11-10-1a2b3c4d`: an event of an official package, from its start date and title. */
export function eventKey(startsOn: string, title: string) {
  return `EV-${startsOn}-${shortHash(normaliseLabel(title))}`
}

/** `NOTE-2026-11-23-1a2b3c4d`: a note of an official package. */
export function noteKey(startsOn: string, title: string) {
  return `NOTE-${startsOn}-${shortHash(normaliseLabel(title))}`
}

/**
 * Two items are the same when dates, kind, class and title match. Two
 * different events on one day stay two items; a lower copy of a higher
 * event is shadowed (§3.4). A setting's match key is its item key, so
 * the nearest layer's value wins (§3.3).
 */
export function calendarMatchKey(item: {
  itemKey: string
  kind: string
  startsOn: string | null
  endsOn: string | null
  classId?: number | null
  title: string
}) {
  if (item.kind === 'setting' || item.startsOn === null) return item.itemKey
  return [
    item.startsOn,
    item.endsOn,
    item.kind,
    item.classId ?? '-',
    normaliseLabel(item.title).slice(0, 100),
  ].join('|')
}
