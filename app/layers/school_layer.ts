import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { SchoolContext } from '../tenancy/school_context.js'
import { newItemKey, type DomainAdapter } from './domains/domain_adapter.js'
import { domainAdapter } from './domains/registry.js'
import { asLayerRuleError, LayerRuleException, LayerRules } from './layer_rules.js'
import { LayerTransactionRequiredException, LayerResolver } from './resolver/layer_resolver.js'
import { coversSchoolYear } from './school_years.js'
import { affectedRows } from './package_choices.js'

/**
 * The school layer (§3, D-380): only the operator changes it directly;
 * the others propose (school_proposals.ts) and the operator's approval
 * runs the same functions. Every function runs inside the school's
 * tenant transaction, so row-level security keeps it to that school.
 */

export interface SchoolActor {
  schoolId: number
  userId: number
}

function trxOrFail(): QueryClientContract {
  const trx = SchoolContext.current()?.trx
  if (!trx) throw new LayerTransactionRequiredException()
  return trx
}

/**
 * The school's own package for the domain and school year: the latest
 * one whose years cover it, else a new one starting that year (open
 * ended, so the differences carry on into later years).
 */
export async function ensureSchoolPackage(
  client: QueryClientContract,
  schoolId: number,
  domain: string,
  schoolYear: string
): Promise<number> {
  const rows = (await client
    .from('layer_packages')
    .where('school_id', schoolId)
    .where('domain', domain)
    .where('layer', 'school')
    .select('id', 'applies_from_school_year', 'applies_to_school_year')
    .orderBy('applies_from_school_year', 'desc')) as {
    id: number
    applies_from_school_year: string
    applies_to_school_year: string | null
  }[]
  const covering = rows.find((row) =>
    coversSchoolYear(row.applies_from_school_year, row.applies_to_school_year, schoolYear)
  )
  if (covering) return Number(covering.id)

  const now = new Date()
  const [created] = (await client
    .table('layer_packages')
    .insert({
      code: `SCHOOL-${schoolId}-${domain.toUpperCase()}-${schoolYear.replace('/', '-')}`,
      domain,
      layer: 'school',
      school_id: schoolId,
      line: 'all',
      kind: 'school',
      level_scope: 'both',
      name: 'Perubahan sekolah',
      status: 'active',
      applies_from_school_year: schoolYear,
      version: 1,
      created_at: now,
      updated_at: now,
    })
    .returning('id')) as { id: number }[]
  return Number(created.id)
}

async function bumpVersion(client: QueryClientContract, packageId: number) {
  await client
    .from('layer_packages')
    .where('id', packageId)
    .update({ version: client.raw('version + 1'), updated_at: new Date() })
}

/**
 * Inserts a new item into a package with the shared layered columns and
 * the adapter's own columns. Returns the item key.
 */
export async function insertItem<P>(
  client: QueryClientContract,
  adapter: DomainAdapter<any, P>,
  packageId: number,
  payload: P,
  options: { origin: string; tag: string; itemKey?: string; revision?: number; supersedesId?: number }
) {
  const itemKey = options.itemKey ?? newItemKey(adapter.keyPrefix, options.tag)
  const now = new Date()
  await client.table(adapter.itemTable).insert({
    package_id: packageId,
    item_key: itemKey,
    shape: 'list',
    force: 'free',
    origin: options.origin,
    group_key: adapter.groupKeyOf(payload),
    match_key: adapter.matchKeyOf(payload),
    revision: options.revision ?? 1,
    supersedes_id: options.supersedesId ?? null,
    status: 'active',
    created_at: now,
    updated_at: now,
    ...adapter.columnsOf(payload),
  })
  return itemKey
}

/**
 * Upserts an active hide of `itemKey` in a package (reactivates a voided one).
 */
export async function writeHide(
  client: QueryClientContract,
  packageId: number,
  itemKey: string,
  reason: string | null,
  createdBy: { userId?: number | null; staffId?: number | null }
) {
  const now = new Date()
  try {
    await client
      .table('layer_hides')
      .insert({
        package_id: packageId,
        domain: '',
        target_item_key: itemKey,
        reason,
        status: 'active',
        created_by_user_id: createdBy.userId ?? null,
        created_by_staff_id: createdBy.staffId ?? null,
        created_at: now,
        updated_at: now,
      })
      .onConflict(['package_id', 'target_item_key'])
      .merge({ status: 'active', void_reason: null, reason, updated_at: now })
  } catch (error) {
    throw asLayerRuleError(error)
  }
}

export const SchoolLayer = {
  /**
   * "Tidak dipakai": hides a higher, non-mandatory item for this school.
   */
  async hide(
    actor: SchoolActor,
    domain: string,
    schoolYear: string,
    itemKey: string,
    reason: string | null
  ) {
    const client = trxOrFail()
    const resolution = await LayerResolver.resolve(domain, actor.schoolId, schoolYear, {
      fresh: true,
    })
    LayerRules.checkHide(resolution, itemKey, 'school', await LayerRules.groups(client, domain))
    const packageId = await ensureSchoolPackage(client, actor.schoolId, domain, schoolYear)
    await writeHide(client, packageId, itemKey, reason, { userId: actor.userId })
    await bumpVersion(client, packageId)
  },

  /**
   * "Pakai lagi": voids the school's own hide. Area hides are not the
   * school's to undo ("Diatur oleh …").
   */
  async unhide(actor: SchoolActor, domain: string, schoolYear: string, itemKey: string) {
    const client = trxOrFail()
    const packageId = await ensureSchoolPackage(client, actor.schoolId, domain, schoolYear)
    const updated = await client
      .from('layer_hides')
      .where('package_id', packageId)
      .where('target_item_key', itemKey)
      .where('status', 'active')
      .update({ status: 'void', void_reason: 'unhidden', updated_at: new Date() })
    if (affectedRows(updated) === 0) {
      throw new LayerRuleException('layers.errors.not_own_hide')
    }
    await bumpVersion(client, packageId)
  },

  /**
   * Adds the school's own item. A visible item with the same name
   * refuses it; a hidden one does not (that is "Ganti untuk sekolah ini").
   */
  async add(actor: SchoolActor, domain: string, schoolYear: string, input: unknown) {
    const client = trxOrFail()
    const adapter = domainAdapter<any, any>(domain)
    const payload = await adapter.validatePayload(input)
    const resolution = await LayerResolver.resolve(domain, actor.schoolId, schoolYear, {
      fresh: true,
    })
    LayerRules.checkAddition(resolution, { matchKey: adapter.matchKeyOf(payload) })
    const packageId = await ensureSchoolPackage(client, actor.schoolId, domain, schoolYear)
    const itemKey = await insertItem(client, adapter, packageId, payload, {
      origin: 'school',
      tag: 'SCH',
    })
    await bumpVersion(client, packageId)
    return itemKey
  },

  /**
   * Retires one of the school's own items (never a higher one).
   */
  async retire(actor: SchoolActor, domain: string, schoolYear: string, itemKey: string) {
    const client = trxOrFail()
    const adapter = domainAdapter(domain)
    const packageId = await ensureSchoolPackage(client, actor.schoolId, domain, schoolYear)
    const resolution = await LayerResolver.resolve(domain, actor.schoolId, schoolYear, {
      fresh: true,
    })
    LayerRules.checkRetire(resolution, itemKey, await LayerRules.groups(client, domain))
    const updated = await client
      .from(adapter.itemTable)
      .where('package_id', packageId)
      .where('item_key', itemKey)
      .whereNot('status', 'retired')
      .update({ status: 'retired', updated_at: new Date() })
    if (affectedRows(updated) === 0) {
      throw new LayerRuleException('layers.errors.not_own_item')
    }
    await bumpVersion(client, packageId)
  },
}

export { bumpVersion }
