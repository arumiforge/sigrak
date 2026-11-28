import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { normaliseLabel } from './domain_adapter.js'
import { SCOUTING_GROUP } from './extracurricular.js'

/**
 * Turns `docs/data/catalogs/extracurriculars.json` into the national
 * `base` package of the `extracurricular` domain
 * (docs/drafts/regional-layers.md §10): items → `catalog_items`
 * (`origin = sigrak`, `force = free`), `offer_groups.scouting` →
 * `layer_group_rules` (min 1, default Pramuka).
 *
 * The package is created as `draft` and stays draft: the catalog is
 * under Tim Validasi review (D-113, D-447), and staff activate it after
 * sign-off (`--activate`). Running it again changes nothing that is
 * already the same; an item whose fields changed gets a new revision.
 */

export const EXTRACURRICULAR_BASE_CODE = 'SIGRAK-KAT-EKS-BASE'

interface CatalogFile {
  meta: { version: string; source_sha256?: string; status: string }
  offer_groups: {
    key: string
    label: string
    min: number
    default: string
    source_ref?: Record<string, unknown>
  }[]
  items: {
    code: string
    key: string
    label: string
    category: string
    offer_group?: string
    offered_by_default: boolean
  }[]
}

export const defaultCatalogFile = () => app.makePath('docs/data/catalogs/extracurriculars.json')

export interface ImportReport {
  packageCreated: boolean
  created: number
  revised: number
  unchanged: number
  status: string
}

export async function importExtracurricularCatalog(
  client: QueryClientContract,
  options: { file?: string; activate?: boolean; schoolYear?: string } = {}
): Promise<ImportReport> {
  const data = JSON.parse(
    await readFile(options.file ?? defaultCatalogFile(), 'utf8')
  ) as CatalogFile
  const now = new Date()
  const report: ImportReport = {
    packageCreated: false,
    created: 0,
    revised: 0,
    unchanged: 0,
    status: 'draft',
  }

  let pkg = (await client
    .from('layer_packages')
    .where('code', EXTRACURRICULAR_BASE_CODE)
    .select('id', 'status')
    .first()) as { id: number; status: string } | undefined
  if (!pkg) {
    const [row] = (await client
      .table('layer_packages')
      .insert({
        code: EXTRACURRICULAR_BASE_CODE,
        domain: 'extracurricular',
        layer: 'national',
        line: 'all',
        kind: 'base',
        level_scope: 'both',
        name: 'Katalog ekstrakurikuler SIGRAK',
        status: 'draft',
        applies_from_school_year: options.schoolYear ?? '2026/2027',
        version: 1,
        rule_set_code: data.meta.version,
        created_at: now,
        updated_at: now,
      })
      .returning(['id', 'status'])) as { id: number; status: string }[]
    pkg = row
    report.packageCreated = true
  }
  const packageId = Number(pkg.id)

  const byKey = new Map(data.items.map((item) => [item.key, item.code]))
  for (const group of data.offer_groups) {
    const defaultItemKey = byKey.get(group.default)
    if (!defaultItemKey)
      throw new Error(`offer group ${group.key}: unknown default ${group.default}`)
    await client
      .table('layer_group_rules')
      .insert({
        domain: 'extracurricular',
        group_key: group.key,
        label: group.label,
        min: group.min,
        default_item_key: defaultItemKey,
        line: 'all',
        force: 'mandatory',
        source_ref: group.source_ref ? JSON.stringify(group.source_ref) : null,
        created_at: now,
        updated_at: now,
      })
      .onConflict(['domain', 'group_key', 'line'])
      .merge(['label', 'min', 'default_item_key', 'source_ref', 'updated_at'])
  }

  let changed = false
  for (const [index, item] of data.items.entries()) {
    const fields = {
      label: item.label,
      category: item.category,
      catalog_key: item.key,
      offered_by_default: item.offered_by_default,
      sort_order: index + 1,
      group_key: item.offer_group ?? null,
      match_key: normaliseLabel(item.label),
    }
    const live = (await client
      .from('catalog_items')
      .where('package_id', packageId)
      .where('item_key', item.code)
      .whereNot('status', 'retired')
      .first()) as Record<string, any> | undefined
    if (
      live &&
      live.label === fields.label &&
      live.category === fields.category &&
      live.catalog_key === fields.catalog_key &&
      live.offered_by_default === fields.offered_by_default &&
      live.sort_order === fields.sort_order &&
      live.group_key === fields.group_key
    ) {
      report.unchanged++
      continue
    }
    if (live) {
      await client
        .from('catalog_items')
        .where('id', live.id)
        .update({ status: 'retired', updated_at: now })
    }
    await client.table('catalog_items').insert({
      package_id: packageId,
      item_key: item.code,
      shape: 'list',
      force: 'free',
      origin: 'sigrak',
      revision: live ? live.revision + 1 : 1,
      supersedes_id: live ? live.id : null,
      status: 'active',
      source_ref: JSON.stringify({ catalog: data.meta.version, key: item.key }),
      created_at: now,
      updated_at: now,
      ...fields,
    })
    changed = true
    if (live) report.revised++
    else report.created++
  }

  const status = options.activate ? 'active' : pkg.status
  if (changed || status !== pkg.status) {
    await client
      .from('layer_packages')
      .where('id', packageId)
      .update({
        status,
        version: report.packageCreated ? 1 : client.raw('version + 1'),
        updated_at: now,
      })
  }
  report.status = status
  return report
}

export { SCOUTING_GROUP }
