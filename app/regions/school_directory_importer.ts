import { readFile } from 'node:fs/promises'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { detectRegionChanges } from './region_change_queue.js'
import { parseRegencyName, regionNameKey } from './region_list.js'

/**
 * Shape of docs/data/schools/<regency>.json, written by
 * scripts/school-directory/fetch.cjs.
 */
const directoryFile = vine.compile(
  vine.object({
    source: vine.string().url({ require_tld: true }),
    fetched_on: vine.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    province: vine.string().trim().minLength(1).maxLength(100),
    regency: vine.string().trim().minLength(1).maxLength(100),
    schools: vine
      .array(
        vine.object({
          npsn: vine.string().regex(/^\d{8}$/),
          name: vine.string().trim().minLength(1).maxLength(150),
          address: vine.string().trim(),
          village: vine.string().trim().maxLength(100).nullable().optional(),
          level: vine.enum(['sd', 'mi'] as const),
          district: vine.string().trim().minLength(1).maxLength(100),
          latitude: vine.number().min(-90).max(90).nullable().optional(),
          longitude: vine.number().min(-180).max(180).nullable().optional(),
        })
      )
      .minLength(1),
  })
)

export interface ImportSummary {
  source: string
  regency: string
  inserted: number
  updated: number
  unchanged: number
  /** Rows of this source the file no longer lists (marked `removed_at`). */
  removed: number
  /** Kecamatan names with no match in the region list (rows keep district_id NULL). */
  unmatchedDistricts: string[]
  /** "Perubahan wilayah" reviews queued for existing schools. */
  reviewsQueued: number
}

export class DirectoryImportError extends Error {}

/** The reference site's regency code in a source URL: …/dikdas/031900/2 */
const SOURCE_CODE = /\/dikdas\/(\d{6})\/2\b/

const COMPARED = [
  'name',
  'level',
  'address',
  'village',
  'district_name',
  'regency_name',
  'province_name',
  'region_id',
  'district_id',
  'latitude',
  'longitude',
  'source_url',
  'fetched_on',
] as const

type EntryRow = Record<(typeof COMPARED)[number], string | number | null> & { npsn: string }

/**
 * Loads one directory file into `school_directory_entries` (D-169):
 * idempotent by NPSN, so running it again with the same file changes
 * nothing. The kabupaten/kota is found by its Dapodik code in the
 * source URL (else by name under the province) and must already be in
 * the region list; kecamatan are matched by name within it. Schools the
 * file no longer lists are marked removed, not deleted. Afterwards the
 * schools with one of these NPSNs are compared with the directory and
 * differences go to the "Perubahan wilayah" queue (D-466).
 *
 * Owner connection, one transaction: the app role cannot write
 * reference data.
 */
export async function importSchoolDirectory(path: string): Promise<ImportSummary> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    throw new DirectoryImportError(`${path}: cannot read the file (${(error as Error).message})`)
  }
  let file: Awaited<ReturnType<typeof directoryFile.validate>>
  try {
    file = await directoryFile.validate(parsed)
  } catch (error) {
    const messages = (error as { messages?: { field: string; message: string }[] }).messages
    const detail = messages
      ? messages
          .slice(0, 5)
          .map((m) => `${m.field}: ${m.message}`)
          .join('; ')
      : (error as Error).message
    throw new DirectoryImportError(`${path}: not a school directory file (${detail})`)
  }

  const seen = new Set<string>()
  for (const school of file.schools) {
    if (seen.has(school.npsn)) throw new DirectoryImportError(`${path}: NPSN ${school.npsn} twice`)
    seen.add(school.npsn)
  }

  return db.transaction(async (trx) => {
    const regency = await findRegency(trx, file.source, file.province, file.regency)
    const districts = (await trx
      .from('regions')
      .where('parent_id', regency.id)
      .where('level', 'district')
      .where('status', 'active')
      .select('id', 'name')) as { id: number; name: string }[]
    const districtIds = new Map(districts.map((d) => [regionNameKey(d.name), d.id]))
    const unmatched = new Set<string>()

    const rows: EntryRow[] = file.schools.map((school) => {
      const districtId = districtIds.get(regionNameKey(school.district)) ?? null
      if (districtId === null) unmatched.add(school.district)
      const hasPlace = typeof school.latitude === 'number' && typeof school.longitude === 'number'
      return {
        npsn: school.npsn,
        name: school.name,
        level: school.level,
        address: school.address,
        village: school.village || null,
        district_name: school.district,
        regency_name: file.regency,
        province_name: file.province,
        region_id: regency.id,
        district_id: districtId,
        latitude: hasPlace ? school.latitude! : null,
        longitude: hasPlace ? school.longitude! : null,
        source_url: file.source,
        fetched_on: file.fetched_on,
      }
    })

    const existing = new Map<string, EntryRow & { removed_at: Date | null }>()
    for (const row of (await trx
      .from('school_directory_entries')
      .whereIn('npsn', [...seen])
      .select('npsn', 'removed_at', ...COMPARED)) as (EntryRow & { removed_at: Date | null })[]) {
      existing.set(row.npsn, row)
    }

    const now = new Date()
    const inserts: Record<string, unknown>[] = []
    let updated = 0
    let unchanged = 0
    for (const row of rows) {
      const current = existing.get(row.npsn)
      if (!current) {
        inserts.push({ ...row, created_at: now, updated_at: now })
      } else if (current.removed_at !== null || COMPARED.some((c) => current[c] !== row[c])) {
        await trx
          .from('school_directory_entries')
          .where('npsn', row.npsn)
          .update({ ...row, removed_at: null, updated_at: now })
        updated++
      } else {
        unchanged++
      }
    }
    for (let start = 0; start < inserts.length; start += 500) {
      await trx.table('school_directory_entries').insert(inserts.slice(start, start + 500))
    }

    const removed = await trx
      .from('school_directory_entries')
      .where('source_url', file.source)
      .whereNull('removed_at')
      .whereNotIn('npsn', [...seen])
      .update({ removed_at: now, updated_at: now })

    const reviewsQueued = await detectRegionChanges(trx, [...seen])

    return {
      source: file.source,
      regency: file.regency,
      inserted: inserts.length,
      updated,
      unchanged,
      removed: Number(removed),
      unmatchedDistricts: [...unmatched].sort(),
      reviewsQueued,
    }
  })
}

async function findRegency(
  client: QueryClientContract,
  source: string,
  provinceName: string,
  regencyLabel: string
) {
  const code = source.match(SOURCE_CODE)?.[1]
  if (code) {
    const byCode = await client
      .from('regions')
      .where('dapodik_code', code)
      .where('level', 'regency')
      .select('id')
      .first()
    if (byCode) return byCode as { id: number }
  }

  const { kind, name } = parseRegencyName(regencyLabel)
  const byName = await client
    .from('regions as r')
    .join('regions as p', 'p.id', 'r.parent_id')
    .where('r.level', 'regency')
    .where('r.status', 'active')
    .where('r.regency_kind', kind)
    .whereRaw('lower(r.name) = lower(?)', [name])
    .whereRaw('lower(p.name) = lower(?)', [provinceName])
    .select('r.id')
    .first()
  if (byName) return byName as { id: number }

  throw new DirectoryImportError(
    `${regencyLabel} (${provinceName}${code ? `, code ${code}` : ''}) is not in the region list. ` +
      'Add it to docs/data/regions and run "node ace db:seed --files database/seeders/region_seeder.ts" first.'
  )
}
