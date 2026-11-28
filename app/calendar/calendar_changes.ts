import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { effectiveDaysOf, offDaysOf, type CalendarView } from './school_calendar.js'

/**
 * Impact notice and shift preview (D-466, D-274, D-261).
 *
 * Official area changes apply to the school directly. Each user keeps a
 * snapshot of what they last saw (`calendar_snapshots`); the page shows
 * the difference until they mark it as read:
 *
 * - the operator and the principal: items from above the school that
 *   were added, changed or removed, and the change in whole-school
 *   effective days (impact notice);
 * - teachers: school days that stopped or started being effective days
 *   (shift preview). RPM meetings and their Batalkan come with P5-04,
 *   which reads the same difference.
 *
 * The first visit only stores the snapshot.
 */

interface AreaEntry {
  /** Fingerprint: revision, kind, dates and title. */
  f: string
  t: string
  s: string | null
  e: string | null
}

export interface CalendarState {
  areaItems: Record<string, AreaEntry>
  offDays: Record<string, string>
  effectiveDays: number
}

export type ChangedItem = {
  title: string
  startsOn: string | null
  endsOn: string | null
}

export type CalendarChangeSet = {
  area: { added: ChangedItem[]; changed: ChangedItem[]; removed: ChangedItem[] }
  days: {
    nowOff: { date: string; title: string }[]
    nowSchoolDays: { date: string; title: string }[]
  }
  effectiveDays: { before: number; after: number }
  since: string
}

export function stateOf(view: CalendarView): CalendarState {
  const areaItems: Record<string, AreaEntry> = {}
  for (const item of view.items) {
    if (item.source.layer === 'school') continue
    areaItems[item.itemKey] = {
      f: [
        item.revision,
        item.value.kind,
        item.value.startsOn,
        item.value.endsOn,
        item.value.title,
      ].join('|'),
      t: item.value.title,
      s: item.value.startsOn,
      e: item.value.endsOn,
    }
  }
  return {
    areaItems,
    offDays: offDaysOf(view),
    effectiveDays: effectiveDaysOf(view, null).total.effectiveDays,
  }
}

function diff(
  before: CalendarState,
  after: CalendarState,
  since: string
): CalendarChangeSet | null {
  const item = (entry: AreaEntry): ChangedItem => ({
    title: entry.t,
    startsOn: entry.s,
    endsOn: entry.e,
  })
  const added: ChangedItem[] = []
  const changed: ChangedItem[] = []
  const removed: ChangedItem[] = []
  for (const [key, entry] of Object.entries(after.areaItems)) {
    const old = before.areaItems[key]
    if (!old) added.push(item(entry))
    else if (old.f !== entry.f) changed.push(item(entry))
  }
  for (const [key, entry] of Object.entries(before.areaItems)) {
    if (!after.areaItems[key]) removed.push(item(entry))
  }
  const nowOff = Object.entries(after.offDays)
    .filter(([date]) => !(date in before.offDays))
    .map(([date, title]) => ({ date, title }))
  const nowSchoolDays = Object.entries(before.offDays)
    .filter(([date]) => !(date in after.offDays))
    .map(([date, title]) => ({ date, title }))
  const byDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date)
  const byStart = (a: ChangedItem, b: ChangedItem) =>
    (a.startsOn ?? '').localeCompare(b.startsOn ?? '')

  const none =
    added.length + changed.length + removed.length + nowOff.length + nowSchoolDays.length === 0
  if (none) return null
  return {
    area: {
      added: added.sort(byStart),
      changed: changed.sort(byStart),
      removed: removed.sort(byStart),
    },
    days: { nowOff: nowOff.sort(byDate), nowSchoolDays: nowSchoolDays.sort(byDate) },
    effectiveDays: { before: before.effectiveDays, after: after.effectiveDays },
    since,
  }
}

interface SnapshotRow {
  area_items: Record<string, AreaEntry>
  off_days: Record<string, string>
  effective_days: number
  seen_at: Date | string
}

async function save(
  client: QueryClientContract,
  schoolId: number,
  userId: number,
  schoolYear: string,
  state: CalendarState
) {
  const now = new Date()
  await client
    .table('calendar_snapshots')
    .insert({
      school_id: schoolId,
      user_id: userId,
      school_year: schoolYear,
      area_items: JSON.stringify(state.areaItems),
      off_days: JSON.stringify(state.offDays),
      effective_days: state.effectiveDays,
      seen_at: now,
      created_at: now,
      updated_at: now,
    })
    .onConflict(['school_id', 'user_id', 'school_year'])
    .merge(['area_items', 'off_days', 'effective_days', 'seen_at', 'updated_at'])
}

export const CalendarChanges = {
  /**
   * What changed since the user last marked the calendar as read; null
   * when nothing did. The first call stores the snapshot.
   */
  async since(
    client: QueryClientContract,
    schoolId: number,
    userId: number,
    view: CalendarView
  ): Promise<CalendarChangeSet | null> {
    const state = stateOf(view)
    const row = (await client
      .from('calendar_snapshots')
      .where('school_id', schoolId)
      .where('user_id', userId)
      .where('school_year', view.schoolYear)
      .first()) as SnapshotRow | undefined
    if (!row) {
      await save(client, schoolId, userId, view.schoolYear, state)
      return null
    }
    const seenAt = row.seen_at instanceof Date ? row.seen_at : new Date(row.seen_at)
    return diff(
      { areaItems: row.area_items, offDays: row.off_days, effectiveDays: row.effective_days },
      state,
      seenAt.toISOString()
    )
  },

  /** "Tandai sudah dibaca": the current calendar becomes the user's snapshot. */
  async acknowledge(
    client: QueryClientContract,
    schoolId: number,
    userId: number,
    view: CalendarView
  ) {
    await save(client, schoolId, userId, view.schoolYear, stateOf(view))
  },
}
