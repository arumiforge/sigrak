import db from '@adonisjs/lucid/services/db'
import type { DateTime } from 'luxon'
import env from '#start/env'
import { publicHost } from '#config/hosts'

/**
 * Small shapes the publishing pages share: dates for the browser,
 * datetime-local values in WIB, the publication state of a Kabar and
 * region and school labels for target chips.
 */

const ZONE = 'Asia/Jakarta'

/** Absolute URL of a page on sigrak.com (D-435). */
export function publicUrl(path: string) {
  return `${env.get('APP_SCHEME')}://${publicHost}${path}`
}

export function isoOrNull(value: DateTime | null | undefined) {
  return value ? value.toISO() : null
}

/** "YYYY-MM-DDTHH:mm" in WIB for a datetime-local field. */
export function localInput(value: DateTime | null | undefined) {
  return value ? value.setZone(ZONE).toFormat("yyyy-LL-dd'T'HH:mm") : ''
}

/**
 * Where a Kabar stands: a draft, published but not shown yet
 * (`scheduled`), shown now (`live`) or past its end (`ended`).
 */
export type PublicationState = 'draft' | 'scheduled' | 'live' | 'ended'

export function publicationState(
  row: { status: string; startsAt: DateTime | null; endsAt: DateTime | null },
  now: Date
): PublicationState {
  if (row.status !== 'published') return 'draft'
  if (row.startsAt && row.startsAt.toJSDate() > now) return 'scheduled'
  if (row.endsAt && row.endsAt.toJSDate() <= now) return 'ended'
  return 'live'
}

export type RegionView = { id: number; name: string; kind: string; parentName: string | null }
export type SchoolView = { id: number; name: string; npsn: string | null }

export async function regionsById(ids: number[]) {
  const map = new Map<number, RegionView>()
  if (ids.length === 0) return map
  const rows = (await db
    .from('regions as r')
    .leftJoin('regions as p', 'p.id', 'r.parent_id')
    .whereIn('r.id', [...new Set(ids)])
    .select('r.id', 'r.name', 'r.level', 'r.regency_kind', 'p.name as parent_name')) as {
    id: number
    name: string
    level: string
    regency_kind: string | null
    parent_name: string | null
  }[]
  for (const row of rows) {
    const kind = row.level === 'regency' ? (row.regency_kind ?? 'kabupaten') : row.level
    map.set(Number(row.id), {
      id: Number(row.id),
      name: row.name,
      kind,
      parentName: row.parent_name,
    })
  }
  return map
}

export async function schoolsById(ids: number[]) {
  const map = new Map<number, SchoolView>()
  if (ids.length === 0) return map
  const rows = (await db
    .from('schools')
    .whereIn('id', [...new Set(ids)])
    .select('id', 'name', 'npsn')) as { id: number; name: string; npsn: string | null }[]
  for (const row of rows) {
    map.set(Number(row.id), { id: Number(row.id), name: row.name, npsn: row.npsn })
  }
  return map
}
