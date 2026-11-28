import db from '@adonisjs/lucid/services/db'
import { applySchoolScope, type SchoolScope } from '#staff/access'
import { currentSchoolYear } from '#layers/school_years'
import type CurriculumVersion from '../models/curriculum_version.js'
import {
  PolicyProfileResolver,
  UnknownLevelError,
  type PolicyProfile,
} from '../policy/policy_profile_resolver.js'
import { compareSchoolYears } from '../school_year.js'

/**
 * Which schools a curriculum version reaches (R2-08, D-317): per level
 * and kabupaten/kota, how many schools have this version in their
 * Profil Jenjang for the school year it applies to, and which version
 * of the same line they use now. Counts only; no school is named. RPM
 * counts and the JP audit come with the RPM tables (R5).
 */

export interface ImpactRow {
  level: string
  provinceName: string | null
  regionId: number | null
  regionName: string | null
  regionKind: string | null
  schools: number
  /** The version is in the school's profile for `schoolYear`. */
  listed: boolean
  /** The version of the same line the resolver picks for these schools today. */
  currentCode: string | null
}

export interface Impact {
  schoolYear: string
  /** True when `schoolYear` is later than the current school year (the version starts later). */
  upcoming: boolean
  rows: ImpactRow[]
  totals: { level: string; listed: number; other: number }[]
}

/** The version's line: every version joined to it by `supersedes_id`, both ways. */
export async function lineCodes(version: CurriculumVersion) {
  const rows = (await db.rawQuery(
    `WITH RECURSIVE line(id, code, supersedes_id) AS (
       SELECT id, code, supersedes_id FROM curriculum_versions WHERE id = ?
       UNION
       SELECT v.id, v.code, v.supersedes_id FROM curriculum_versions v
         JOIN line ON v.id = line.supersedes_id OR v.supersedes_id = line.id
     )
     SELECT code FROM line`,
    [version.id]
  )) as { rows: { code: string }[] }
  return new Set(rows.rows.map((row) => row.code))
}

function listedIn(policy: PolicyProfile, code: string, province: string | null) {
  for (const [domain, entries] of Object.entries(policy.profile.data.rule_sets)) {
    const hit = entries.some(
      (entry) =>
        entry.code === code && (!entry.region_province || entry.region_province === province)
    )
    if (hit) return domain
  }
  return null
}

export async function impactOf(
  version: CurriculumVersion,
  scope: SchoolScope,
  resolver = new PolicyProfileResolver()
): Promise<Impact> {
  const today = currentSchoolYear()
  const startsLater =
    version.appliesFromSchoolYear !== null &&
    compareSchoolYears(version.appliesFromSchoolYear, today) > 0
  const schoolYear = startsLater ? version.appliesFromSchoolYear! : today

  const query = db
    .from('schools')
    .leftJoin('regions as r', 'r.id', 'schools.region_id')
    .leftJoin('regions as p', 'p.id', 'r.parent_id')
    .groupBy('schools.level', 'r.id', 'r.name', 'r.regency_kind', 'p.name')
    .select(
      'schools.level',
      'r.id as region_id',
      'r.name as region_name',
      'r.regency_kind',
      'p.name as province_name'
    )
    .count('* as schools')
  applySchoolScope(query, scope)
  const groups = (await query) as {
    level: string
    region_id: number | null
    region_name: string | null
    regency_kind: string | null
    province_name: string | null
    schools: string
  }[]

  const line = await lineCodes(version)
  const policies = new Map<string, { listed: boolean; currentCode: string | null }>()
  const policyFor = async (level: string, province: string | null) => {
    const key = `${level}|${province ?? ''}`
    const known = policies.get(key)
    if (known) return known
    let value = { listed: false, currentCode: null as string | null }
    try {
      const target = await resolver.resolve({ schoolYear, level, regionProvince: province })
      const now = await resolver.resolve({ schoolYear: today, level, regionProvince: province })
      const domain = listedIn(target, version.code, province)
      const current = Object.values(now.ruleSets)
        .flat()
        .find((ruleSet) => line.has(ruleSet.code))
      value = { listed: domain !== null, currentCode: current?.code ?? null }
    } catch (error) {
      if (!(error instanceof UnknownLevelError)) throw error
    }
    policies.set(key, value)
    return value
  }

  const rows: ImpactRow[] = []
  for (const group of groups) {
    const policy = await policyFor(group.level, group.province_name)
    rows.push({
      level: group.level,
      provinceName: group.province_name,
      regionId: group.region_id === null ? null : Number(group.region_id),
      regionName: group.region_name,
      regionKind: group.regency_kind,
      schools: Number(group.schools),
      listed: policy.listed,
      currentCode: policy.currentCode,
    })
  }
  rows.sort(
    (a, b) =>
      Number(b.listed) - Number(a.listed) ||
      a.level.localeCompare(b.level) ||
      (a.provinceName ?? '').localeCompare(b.provinceName ?? '', 'id') ||
      (a.regionName ?? '').localeCompare(b.regionName ?? '', 'id')
  )

  const totals = new Map<string, { level: string; listed: number; other: number }>()
  for (const row of rows) {
    const total = totals.get(row.level) ?? { level: row.level, listed: 0, other: 0 }
    if (row.listed) total.listed += row.schools
    else total.other += row.schools
    totals.set(row.level, total)
  }

  return {
    schoolYear,
    upcoming: startsLater,
    rows,
    totals: [...totals.values()].sort((a, b) => a.level.localeCompare(b.level)),
  }
}
