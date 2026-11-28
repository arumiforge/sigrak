import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { SchoolContext } from '../tenancy/school_context.js'
import { asLayerRuleError, LayerRuleException } from './layer_rules.js'
import {
  LayerTransactionRequiredException,
  chainIds,
  schoolFrame,
} from './resolver/layer_resolver.js'
import { coversSchoolYear, todayIso } from './school_years.js'
import type { Layer, Line, PackageKind } from './types.js'
import type { SchoolActor } from './school_layer.js'

/**
 * "Paket daerah" (§7, D-466): the official packages of the school's
 * areas (always on) and the local agreements it may follow. The
 * operator chooses; the principal gets a notice. A school never sees
 * packages of other areas.
 */

export interface AreaPackage {
  id: number
  publicId: string
  code: string
  domain: string
  name: string
  layer: Layer
  kind: PackageKind
  line: Line
  regionName: string | null
  regionKind: string | null
  evidence: Record<string, unknown> | null
  version: number
  appliesFromSchoolYear: string
  appliesToSchoolYear: string | null
  chosen: { since: string; by: string | null } | null
}

function trxOrFail(): QueryClientContract {
  const trx = SchoolContext.current()?.trx
  if (!trx) throw new LayerTransactionRequiredException()
  return trx
}

const isoDate = (value: string | Date) =>
  typeof value === 'string'
    ? value.slice(0, 10)
    : new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)

export const PackageChoices = {
  /**
   * The area packages of the school's chain for a school year (every
   * domain, or one), with the school's current choice.
   */
  async list(schoolId: number, schoolYear: string, domain?: string): Promise<AreaPackage[]> {
    const client = trxOrFail()
    const { level, chain } = await schoolFrame(client, schoolId)
    const regionIds = chainIds(chain)
    if (regionIds.length === 0) return []
    const query = client
      .from('layer_packages as p')
      .join('regions as r', 'r.id', 'p.region_id')
      .leftJoin('school_package_choices as c', (join) => {
        join
          .on('c.package_id', 'p.id')
          .andOnVal('c.school_id', schoolId)
          .andOnVal('c.school_year', schoolYear)
          .andOnVal('c.status', 'active')
      })
      .leftJoin('users as u', 'u.id', 'c.chosen_by_user_id')
      .whereIn('p.region_id', regionIds)
      .where('p.status', 'active')
      .whereIn('p.kind', ['official', 'local_agreement'])
      .whereIn('p.level_scope', [level, 'both'])
      .select(
        'p.*',
        'r.name as region_name',
        'r.regency_kind',
        'c.starts_on as chosen_since',
        'u.name as chosen_by'
      )
      .orderByRaw(`layer_rank(p.layer), p.kind, p.name`)
    if (domain) query.where('p.domain', domain)
    const rows = (await query) as any[]
    return rows
      .filter((row) =>
        coversSchoolYear(row.applies_from_school_year, row.applies_to_school_year, schoolYear)
      )
      .map((row) => ({
        id: Number(row.id),
        publicId: row.public_id,
        code: row.code,
        domain: row.domain,
        name: row.name,
        layer: row.layer,
        kind: row.kind,
        line: row.line,
        regionName: row.region_name,
        regionKind: row.layer === 'regency' ? (row.regency_kind ?? 'kabupaten') : null,
        evidence: row.evidence,
        version: row.version,
        appliesFromSchoolYear: row.applies_from_school_year,
        appliesToSchoolYear: row.applies_to_school_year,
        chosen: row.chosen_since
          ? { since: isoDate(row.chosen_since), by: row.chosen_by ?? null }
          : null,
      }))
  },

  /**
   * "Ikuti paket": the operator follows a local agreement from today
   * (or `startsOn`); the principal is told.
   */
  async choose(actor: SchoolActor, packagePublicId: string, schoolYear: string, startsOn?: string) {
    const client = trxOrFail()
    const pkg = await findAgreement(client, actor.schoolId, packagePublicId, schoolYear)
    const existing = await client
      .from('school_package_choices')
      .where('school_id', actor.schoolId)
      .where('package_id', pkg.id)
      .where('school_year', schoolYear)
      .where('status', 'active')
      .first()
    if (existing) throw new LayerRuleException('layers.errors.already_chosen')

    const now = new Date()
    try {
      await client.table('school_package_choices').insert({
        school_id: actor.schoolId,
        package_id: pkg.id,
        school_year: schoolYear,
        status: 'active',
        starts_on: startsOn ?? todayIso(),
        chosen_by_user_id: actor.userId,
        chosen_at: now,
        created_at: now,
        updated_at: now,
      })
    } catch (error) {
      throw asLayerRuleError(error)
    }
    await notifyPrincipal(client, actor, 'package_chosen', pkg)
  },

  /**
   * "Berhenti mengikuti": ends the choice today; the principal is told.
   */
  async leave(actor: SchoolActor, packagePublicId: string, schoolYear: string) {
    const client = trxOrFail()
    const pkg = await findAgreement(client, actor.schoolId, packagePublicId, schoolYear)
    const now = new Date()
    const today = todayIso()
    const ended = await client
      .from('school_package_choices')
      .where('school_id', actor.schoolId)
      .where('package_id', pkg.id)
      .where('school_year', schoolYear)
      .where('status', 'active')
      .update({
        status: 'ended',
        ended_at: now,
        ends_on: client.raw('greatest(starts_on, ?::date)', [today]),
        ended_by_user_id: actor.userId,
        end_reason: 'operator_left',
        updated_at: now,
      })
    if (affectedRows(ended) === 0) throw new LayerRuleException('layers.errors.not_chosen')
    await notifyPrincipal(client, actor, 'package_left', pkg)
  },
}

export function affectedRows(result: unknown) {
  if (Array.isArray(result)) return result.length
  return Number(result) || 0
}

async function findAgreement(
  client: QueryClientContract,
  schoolId: number,
  publicId: string,
  schoolYear: string
) {
  const { chain } = await schoolFrame(client, schoolId)
  const pkg = (await client
    .from('layer_packages')
    .where('public_id', publicId)
    .where('kind', 'local_agreement')
    .where('status', 'active')
    .whereIn('region_id', chainIds(chain))
    .select('id', 'code', 'name', 'domain', 'applies_from_school_year', 'applies_to_school_year')
    .first()) as
    | {
        id: number
        code: string
        name: string
        domain: string
        applies_from_school_year: string
        applies_to_school_year: string | null
      }
    | undefined
  if (!pkg) throw new LayerRuleException('layers.errors.not_found')
  if (!coversSchoolYear(pkg.applies_from_school_year, pkg.applies_to_school_year, schoolYear)) {
    throw new LayerRuleException('layers.errors.choice_school_year')
  }
  return { ...pkg, id: Number(pkg.id) }
}

async function notifyPrincipal(
  client: QueryClientContract,
  actor: SchoolActor,
  kind: 'package_chosen' | 'package_left',
  pkg: { code: string; name: string; domain: string }
) {
  const user = (await client.from('users').where('id', actor.userId).select('name').first()) as
    { name: string } | undefined
  await client.table('layer_notices').insert({
    school_id: actor.schoolId,
    kind,
    audience: 'principal',
    payload: JSON.stringify({
      domain: pkg.domain,
      package_code: pkg.code,
      package_name: pkg.name,
      actor_name: user?.name ?? null,
    }),
    created_at: new Date(),
  })
}
