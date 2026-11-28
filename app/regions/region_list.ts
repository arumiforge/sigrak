import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import type { RegencyKind, RegionLevel } from '#models/region'

/**
 * One node of a region list file under app/regions/data. The level
 * follows the depth: province → regency (kabupaten/kota) → district
 * (kecamatan).
 */
export interface RegionSeed {
  kemendagriCode: string
  dapodikCode?: string | null
  name: string
  regencyKind?: RegencyKind
  children?: RegionSeed[]
}

const LEVELS: RegionLevel[] = ['province', 'regency', 'district']

/**
 * Name key for matching the reference site's spelling against the
 * region list: case, spaces and punctuation do not count
 * ("Gunung Wungkal" = "Gunungwungkal").
 */
export function regionNameKey(name: string) {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Splits "Kabupaten Kudus" / "Kota Semarang" / "Kab. Pati" into kind
 * and name, as the directory files write the regency.
 */
export function parseRegencyName(label: string): { kind: RegencyKind; name: string } {
  const trimmed = label.trim()
  const match = trimmed.match(/^(Kabupaten|Kab\.|Kota)\s+(.+)$/i)
  if (!match) return { kind: 'kabupaten', name: trimmed }
  return { kind: match[1].toLowerCase() === 'kota' ? 'kota' : 'kabupaten', name: match[2].trim() }
}

/**
 * Writes a region list into `regions`, idempotent by Kemendagri code:
 * new codes are added, known codes get the current name, Dapodik code
 * and parent. Rows missing from the list are left alone (a retired
 * region keeps its row). Runs on the owner connection: the app role
 * cannot write reference data. Returns the number of rows written.
 */
export async function seedRegionList(client: QueryClientContract, root: RegionSeed) {
  let written = 0
  const now = new Date()

  async function write(node: RegionSeed, depth: number, parentId: number | null) {
    const level = LEVELS[depth]
    if (!level) throw new Error(`${node.kemendagriCode}: the region list is deeper than kecamatan`)
    const [row] = (await client
      .knexQuery()
      .table('regions')
      .insert({
        level,
        parent_id: parentId,
        name: node.name,
        regency_kind: level === 'regency' ? (node.regencyKind ?? 'kabupaten') : null,
        kemendagri_code: node.kemendagriCode,
        dapodik_code: node.dapodikCode ?? null,
        status: 'active',
        created_at: now,
        updated_at: now,
      })
      .onConflict('kemendagri_code')
      .merge(['level', 'parent_id', 'name', 'regency_kind', 'dapodik_code', 'updated_at'])
      .returning('id')) as { id: number }[]
    written++
    for (const child of node.children ?? []) {
      await write(child, depth + 1, row.id)
    }
  }

  await write(root, 0, null)
  return written
}
