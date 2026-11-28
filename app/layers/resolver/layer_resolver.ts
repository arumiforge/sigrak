import { createHash } from 'node:crypto'
import { Exception } from '@adonisjs/core/exceptions'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { PolicyProfileResolver } from '../../curriculum/policy/policy_profile_resolver.js'
import { SchoolContext } from '../../tenancy/school_context.js'
import { domainAdapter } from '../domains/registry.js'
import { coversSchoolYear, isSchoolYear, resolutionDay } from '../school_years.js'
import { LINES, type Layer, type Line, type PackageKind } from '../types.js'
import {
  resolveLayers,
  type GroupRuleInput,
  type HideInput,
  type LayerWarning,
  type PackageInput,
  type Resolution,
} from './resolve_core.js'
import { SharedCache } from '../../services/shared_cache.js'
import { ResolutionCache } from './resolution_cache.js'

export class LayerTransactionRequiredException extends Exception {
  static status = 500
  static code = 'E_LAYER_TRANSACTION_REQUIRED'
  static message =
    'The layer resolver runs inside tenantTransaction() or staffTransaction(), so row-level security applies.'
}

export interface RegionLink {
  id: number
  name: string
  kind: string | null
}

/**
 * The area chain of a school (or of an area view): province, kabupaten/
 * kota and, when recorded, kecamatan.
 */
export interface RegionChain {
  province: RegionLink | null
  regency: RegionLink | null
  district: RegionLink | null
}

export interface SchoolResolution<V = Record<string, unknown>> extends Resolution<V> {
  domain: string
  schoolId: number
  schoolYear: string
  /** The day the resolution was read for (YYYY-MM-DD). */
  on: string
  line: Line
  level: string
  chain: RegionChain
  /** Package ids of the school's own package for this year (null when it has none yet). */
  schoolPackageId: number | null
}

export interface ResolveOptions {
  /** Day to read for; default today, clamped into the school year. */
  on?: string
  /** The client to read with; default the open tenant or staff transaction. */
  client?: QueryClientContract
  /** Skip the cache (tests, the rules' own reads). */
  fresh?: boolean
}

interface PackageRow {
  id: number
  code: string
  name: string
  layer: Layer
  kind: PackageKind
  line: Line
  version: number
  level_scope: string
  region_id: number | null
  school_id: number | null
  applies_from_school_year: string
  applies_to_school_year: string | null
  effective_on: string | Date | null
  rule_set_code: string | null
  evidence: Record<string, unknown> | null
  region_name: string | null
  regency_kind: string | null
}

const policyProfiles = new PolicyProfileResolver()
/**
 * Two levels (D-480): a small in-process cache that saves the round
 * trip for repeated reads in one process, then the shared `redis-cache`
 * so every web replica reuses a resolution. Keys hold the layer stamps,
 * so neither level can serve a stale value (after a database restore,
 * run `node ace cache:clear`).
 */
const cache = new ResolutionCache(500, 60 * 1000)
const shared = new SharedCache('resolver', { ttlSeconds: 24 * 60 * 60 })
const stats = { hits: 0, sharedHits: 0, misses: 0 }

function clientOf(options: ResolveOptions) {
  const client = options.client ?? SchoolContext.current()?.trx
  if (!client) throw new LayerTransactionRequiredException()
  return client
}

function isoDate(value: string | Date | null) {
  if (value === null) return null
  if (typeof value === 'string') return value.slice(0, 10)
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/**
 * Loads a school's region chain, level and line.
 */
export async function schoolFrame(client: QueryClientContract, schoolId: number) {
  const row = (await client
    .from('schools as s')
    .join('regions as r', 'r.id', 's.region_id')
    .leftJoin('regions as p', 'p.id', 'r.parent_id')
    .leftJoin('regions as d', 'd.id', 's.district_id')
    .where('s.id', schoolId)
    .select(
      's.id',
      's.level',
      'r.id as regency_id',
      'r.name as regency_name',
      'r.regency_kind',
      'p.id as province_id',
      'p.name as province_name',
      'd.id as district_id',
      'd.name as district_name'
    )
    .first()) as
    | {
        id: number
        level: string
        regency_id: number
        regency_name: string
        regency_kind: string | null
        province_id: number | null
        province_name: string | null
        district_id: number | null
        district_name: string | null
      }
    | undefined
  if (!row) throw new Exception(`School ${schoolId} not found`, { status: 404 })
  const chain: RegionChain = {
    province: row.province_id
      ? { id: Number(row.province_id), name: row.province_name!, kind: 'province' }
      : null,
    regency: { id: Number(row.regency_id), name: row.regency_name, kind: row.regency_kind },
    district: row.district_id
      ? { id: Number(row.district_id), name: row.district_name!, kind: 'district' }
      : null,
  }
  return { level: row.level, chain }
}

export function chainIds(chain: RegionChain) {
  return [chain.province, chain.regency, chain.district]
    .filter((region): region is RegionLink => region !== null)
    .map((region) => region.id)
}

/**
 * The school's line (`kemendikdasmen`, `kemenag`) and the national rule-set
 * codes of the domain, from the policy-profile resolver (D-378), which
 * runs before this one.
 */
async function policyFor(domain: string, schoolYear: string, level: string, chain: RegionChain) {
  const policy = await policyProfiles.resolve({
    schoolYear,
    level,
    regionProvince: chain.province?.name ?? null,
  })
  const line = policy.profile.data.ministry.code as Line
  if (!LINES.includes(line) || line === 'all') {
    throw new Exception(`Profil Jenjang ${level} names an unknown ministry "${line}"`)
  }
  const codes = policy.ruleSets[domain]?.map((ruleSet) => ruleSet.code)
  return { line, nationalCodes: codes && codes.length > 0 ? codes : null }
}

/**
 * Feature code calls `LayerResolver.resolve(domain, schoolId, schoolYear)`
 * and never reads layered tables directly (§5.1). It runs inside the
 * request's tenant transaction (RLS, SET LOCAL per D-429).
 *
 * Caching (§5.4): the key holds the domain, school, school year, day,
 * line and the layer stamps of the school's chain (`national`,
 * `region:<id>` per area, `school:<id>`, `choices:<id>`), read from the
 * database in the same transaction. Triggers bump those stamps in the
 * transaction of every change, so a cached value is never stale and an
 * unrelated area's change never misses the cache.
 */
export const LayerResolver = {
  async resolve<V = Record<string, unknown>>(
    domain: string,
    schoolId: number,
    schoolYear: string,
    options: ResolveOptions = {}
  ): Promise<SchoolResolution<V>> {
    if (!isSchoolYear(schoolYear)) throw new Exception(`"${schoolYear}" is not a school year`)
    const client = clientOf(options)
    const adapter = domainAdapter<V>(domain)
    const on = options.on ?? resolutionDay(schoolYear)
    const { level, chain } = await schoolFrame(client, schoolId)
    const { line, nationalCodes } = await policyFor(domain, schoolYear, level, chain)
    const regionIds = chainIds(chain)

    const scopes = [
      'national',
      ...regionIds.map((id) => `region:${id}`),
      `school:${schoolId}`,
      `choices:${schoolId}`,
    ]
    const stampRows = (await client
      .from('layer_stamps')
      .where('domain', domain)
      .whereIn('scope_key', scopes)
      .select('scope_key', 'stamp')) as { scope_key: string; stamp: string | number }[]
    const stamps = Object.fromEntries(stampRows.map((row) => [row.scope_key, String(row.stamp)]))
    const key = createHash('sha256')
      .update(
        JSON.stringify([
          domain,
          schoolId,
          schoolYear,
          on,
          level,
          line,
          nationalCodes,
          scopes.map((scope) => [scope, stamps[scope] ?? '0']),
        ])
      )
      .digest('hex')
    if (!options.fresh) {
      const cached = cache.get<SchoolResolution<V>>(key)
      if (cached) {
        stats.hits++
        return cached
      }
      const fromShared = await shared.get<SchoolResolution<V>>(key)
      if (fromShared) {
        stats.hits++
        stats.sharedHits++
        cache.set(key, fromShared)
        return fromShared
      }
    }
    stats.misses++

    const chosen = (await client
      .from('school_package_choices')
      .where('school_id', schoolId)
      .where('school_year', schoolYear)
      .where('starts_on', '<=', on)
      .where((q) => q.whereNull('ends_on').orWhere('ends_on', '>', on))
      .select('package_id')) as { package_id: number }[]
    const optedIn = new Set(chosen.map((row) => Number(row.package_id)))

    const rows = await loadPackages(client, domain, {
      line,
      level,
      regionIds,
      schoolId,
    })
    const packages = rows.filter((row) => {
      if (!coversSchoolYear(row.applies_from_school_year, row.applies_to_school_year, schoolYear))
        return false
      const effectiveOn = isoDate(row.effective_on)
      if (effectiveOn !== null && effectiveOn > on) return false
      if (row.kind === 'local_agreement' && !optedIn.has(Number(row.id))) return false
      if (row.layer === 'national' && nationalCodes && !nationalCodes.includes(row.rule_set_code!))
        return false
      return true
    })

    const warnings: LayerWarning[] = chain.district ? [] : [{ kind: 'missing_district' }]
    const resolution = await resolveFromRows<V>(client, domain, packages, line, warnings)
    resolution.items.sort(adapter.compare)
    resolution.hidden.sort(adapter.compare)

    const schoolPackage = rows
      .filter(
        (row) =>
          row.layer === 'school' &&
          coversSchoolYear(row.applies_from_school_year, row.applies_to_school_year, schoolYear)
      )
      .sort((a, b) => (a.applies_from_school_year < b.applies_from_school_year ? 1 : -1))[0]

    const result: SchoolResolution<V> = {
      ...resolution,
      domain,
      schoolId,
      schoolYear,
      on,
      line,
      level,
      chain,
      schoolPackageId: schoolPackage ? Number(schoolPackage.id) : null,
    }
    cache.set(key, result)
    await shared.set(key, result)
    return result
  },

  /**
   * The view of one area without any school: national packages, the
   * official packages of the area and the areas above it, plus the
   * given package (the one a proposal changes). Both lines unless
   * `line` is given. For the rules on area proposals.
   */
  async resolveArea<V = Record<string, unknown>>(
    domain: string,
    regionId: number,
    schoolYear: string,
    options: ResolveOptions & { line?: Line | null; includePackageId?: number | null } = {}
  ): Promise<Resolution<V>> {
    const client = clientOf(options)
    const regionIds = await regionAncestry(client, regionId)
    const rows = await loadPackages(client, domain, {
      line: options.line ?? null,
      level: null,
      regionIds,
      schoolId: null,
    })
    const packages = rows.filter(
      (row) =>
        coversSchoolYear(row.applies_from_school_year, row.applies_to_school_year, schoolYear) &&
        (row.kind !== 'local_agreement' || Number(row.id) === options.includePackageId)
    )
    return resolveFromRows<V>(client, domain, packages, options.line ?? null, [])
  },

  /** Empties both levels and the counters. */
  async clearCache() {
    cache.clear()
    await shared.clear()
    stats.hits = 0
    stats.sharedHits = 0
    stats.misses = 0
  },

  /** Empties only this process's level (tests: the next read comes from Redis). */
  clearLocalCache() {
    cache.clear()
  },

  /** Cache hits (of them from Redis) and misses since the last clear (tests, monitoring). */
  cacheStats() {
    return { ...stats, size: cache.size }
  },
}

/**
 * Ids of a region and the regions above it, top-down.
 */
export async function regionAncestry(client: QueryClientContract, regionId: number) {
  const ids: number[] = []
  let current: number | null = regionId
  while (current !== null) {
    const row = (await client
      .from('regions')
      .where('id', current)
      .select('id', 'parent_id')
      .first()) as { id: number; parent_id: number | null } | undefined
    if (!row) break
    ids.unshift(Number(row.id))
    current = row.parent_id === null ? null : Number(row.parent_id)
  }
  return ids
}

async function loadPackages(
  client: QueryClientContract,
  domain: string,
  scope: { line: Line | null; level: string | null; regionIds: number[]; schoolId: number | null }
) {
  const query = client
    .from('layer_packages as p')
    .leftJoin('regions as r', 'r.id', 'p.region_id')
    .where('p.domain', domain)
    .where('p.status', 'active')
    .where((q) => {
      q.where('p.layer', 'national')
      if (scope.regionIds.length > 0) q.orWhereIn('p.region_id', scope.regionIds)
      if (scope.schoolId !== null) q.orWhere('p.school_id', scope.schoolId)
    })
    .select('p.*', 'r.name as region_name', 'r.regency_kind')
  if (scope.line) query.whereIn('p.line', ['all', scope.line])
  if (scope.level) query.whereIn('p.level_scope', [scope.level, 'both'])
  return (await query) as PackageRow[]
}

async function resolveFromRows<V>(
  client: QueryClientContract,
  domain: string,
  rows: PackageRow[],
  line: Line | null,
  warnings: LayerWarning[]
): Promise<Resolution<V>> {
  const adapter = domainAdapter<V>(domain)
  const ids = rows.map((row) => Number(row.id))
  const packages: PackageInput[] = rows.map((row) => ({
    id: Number(row.id),
    code: row.code,
    name: row.name,
    layer: row.layer,
    kind: row.kind,
    line: row.line,
    version: row.version,
    regionName: row.region_name,
    regionKind: row.layer === 'regency' ? (row.regency_kind ?? 'kabupaten') : null,
    evidence: row.evidence,
  }))
  const items = await adapter.loadItems(client, ids)
  const hides =
    ids.length === 0
      ? []
      : ((await client
          .from('layer_hides')
          .whereIn('package_id', ids)
          .where('status', 'active')
          .select('package_id', 'target_item_key', 'reason')) as {
          package_id: number
          target_item_key: string
          reason: string | null
        }[])
  const ruleRows = (await client
    .from('layer_group_rules')
    .where('domain', domain)
    .select('group_key', 'label', 'min', 'default_item_key', 'line')) as {
    group_key: string
    label: string
    min: number
    default_item_key: string
    line: Line
  }[]
  const hideInputs: HideInput[] = hides.map((hide) => ({
    packageId: Number(hide.package_id),
    targetItemKey: hide.target_item_key,
    reason: hide.reason,
  }))
  const groupRules: GroupRuleInput[] = ruleRows.map((rule) => ({
    groupKey: rule.group_key,
    label: rule.label,
    min: rule.min,
    defaultItemKey: rule.default_item_key,
    line: rule.line,
  }))
  return resolveLayers<V>({ packages, items, hides: hideInputs, groupRules, line, warnings })
}
