import db from '@adonisjs/lucid/services/db'
import { compareSchoolYears, isSchoolYear } from '../school_year.js'
import {
  defaultProfilesDirectory,
  loadLevelProfiles,
  type LevelProfile,
  type ProfileVersion,
  type RuleSetDomain,
  type RuleSetEntry,
} from './level_profiles.js'
import type { VersionKind, VersionStatus } from '../types.js'

export interface ResolveInput {
  /** `2026/2027` */
  schoolYear: string
  /** A Profil Jenjang level (`sd`, `mi`), from the school record. */
  level: string
  /** The school's province (`regions.province`); NULL = national only. */
  regionProvince?: string | null
}

export interface ResolvedRuleSet {
  domain: RuleSetDomain
  code: string
  /** NULL when the version is listed in a profile but not imported. */
  versionId: number | null
  kind: VersionKind | null
  status: VersionStatus | null
  effectiveOn: string | null
  appliesFromSchoolYear: string
  regionProvince: string | null
  /**
   * False when no entry of this line has started by the school year and
   * the earliest one is used instead (D-378).
   */
  inForce: boolean
}

export interface PolicyProfile {
  schoolYear: string
  level: string
  regionProvince: string | null
  profile: {
    code: string
    appliesFromSchoolYear: string
    /** False when the school year is before every profile version. */
    inForce: boolean
    data: ProfileVersion
  }
  ruleSets: Record<string, ResolvedRuleSet[]>
  /** Every rule-set code in force, for documents to store (D-354). */
  ruleSetCodes: string[]
}

export class UnknownLevelError extends Error {}

interface VersionRow {
  id: number
  code: string
  kind: VersionKind
  status: VersionStatus
  supersedes_code: string | null
}

const cacheTtlMs = 10 * 60 * 1000

/**
 * Picks, per domain, the rule set in force for a school year, level and
 * province (D-355, D-378):
 *
 * - The profile version is the latest whose `applies_from_school_year`
 *   has started; before the first one, the first one (`inForce` false).
 * - A domain lists rule sets that run side by side (the general CP and
 *   the religion CP) or replace each other. Entries joined by
 *   `supersedes` (in the profile, or `curriculum_versions.supersedes_id`)
 *   form one line; for each line the resolver picks the entry that has
 *   started and is not retired (and, once the line has a published
 *   version, only among published ones: R2-08), a province entry before a national one,
 *   the latest start first. When none has started it uses the earliest
 *   one and marks it `inForce: false`.
 *
 * Results are cached per school year (with a 10-minute lifetime, so an
 * import in another process shows up) and cleared by every import in
 * this process. Code reads this resolver, never a level check or a
 * config pointer (D-356). The layer resolver (R1-07) runs after it.
 */
export class PolicyProfileResolver {
  static #cache = new Map<string, { expires: number; value: Promise<PolicyProfile> }>()
  static #profiles = new Map<
    string,
    { expires: number; value: Promise<Map<string, LevelProfile>> }
  >()

  constructor(private readonly options: { profilesDirectory?: string } = {}) {}

  static clearCache() {
    this.#cache.clear()
    this.#profiles.clear()
  }

  get #directory() {
    return this.options.profilesDirectory ?? defaultProfilesDirectory()
  }

  profiles(): Promise<Map<string, LevelProfile>> {
    const now = Date.now()
    const cached = PolicyProfileResolver.#profiles.get(this.#directory)
    if (cached && cached.expires > now) return cached.value
    const value = loadLevelProfiles(this.#directory)
    PolicyProfileResolver.#profiles.set(this.#directory, { expires: now + cacheTtlMs, value })
    value.catch(() => PolicyProfileResolver.#profiles.delete(this.#directory))
    return value
  }

  resolve(input: ResolveInput): Promise<PolicyProfile> {
    if (!isSchoolYear(input.schoolYear)) {
      return Promise.reject(
        new Error(`"${input.schoolYear}" is not a school year (for example 2026/2027)`)
      )
    }
    const province = input.regionProvince ?? null
    const key = [this.#directory, input.schoolYear, input.level, province ?? ''].join('|')
    const now = Date.now()
    const cached = PolicyProfileResolver.#cache.get(key)
    if (cached && cached.expires > now) return cached.value
    const value = this.#resolve(input.schoolYear, input.level, province)
    PolicyProfileResolver.#cache.set(key, { expires: now + cacheTtlMs, value })
    value.catch(() => PolicyProfileResolver.#cache.delete(key))
    return value
  }

  async #resolve(
    schoolYear: string,
    level: string,
    province: string | null
  ): Promise<PolicyProfile> {
    const profiles = await this.profiles()
    const profile = profiles.get(level)
    if (!profile) throw new UnknownLevelError(`No Profil Jenjang for level "${level}"`)

    const sorted = [...profile.versions].sort((a, b) =>
      compareSchoolYears(a.applies_from_school_year, b.applies_from_school_year)
    )
    const started = sorted.filter(
      (version) => compareSchoolYears(version.applies_from_school_year, schoolYear) <= 0
    )
    const version = started.at(-1) ?? sorted[0]

    const codes = Object.values(version.rule_sets).flatMap((entries) => entries.map((e) => e.code))
    const rows = (await db
      .from('curriculum_versions as v')
      .leftJoin('curriculum_versions as p', 'p.id', 'v.supersedes_id')
      .whereIn('v.code', codes.length > 0 ? codes : [''])
      .select('v.id', 'v.code', 'v.kind', 'v.status', 'p.code as supersedes_code')) as VersionRow[]
    const versions = new Map(rows.map((row) => [row.code, row]))

    const ruleSets: Record<string, ResolvedRuleSet[]> = {}
    for (const [domain, entries] of Object.entries(version.rule_sets)) {
      ruleSets[domain] = pickPerLine(domain, entries, versions, schoolYear, province)
    }

    return {
      schoolYear,
      level,
      regionProvince: province,
      profile: {
        code: version.code,
        appliesFromSchoolYear: version.applies_from_school_year,
        inForce: started.length > 0,
        data: version,
      },
      ruleSets,
      ruleSetCodes: Object.values(ruleSets)
        .flat()
        .filter((ruleSet) => ruleSet.inForce)
        .map((ruleSet) => ruleSet.code),
    }
  }

  /**
   * The rule sets of one domain, for callers that need one kind only.
   */
  async ruleSets(input: ResolveInput, domain: RuleSetDomain): Promise<ResolvedRuleSet[]> {
    const policy = await this.resolve(input)
    return policy.ruleSets[domain] ?? []
  }
}

function pickPerLine(
  domain: RuleSetDomain,
  entries: RuleSetEntry[],
  versions: Map<string, VersionRow>,
  schoolYear: string,
  province: string | null
): ResolvedRuleSet[] {
  // Union-find over codes joined by `supersedes`.
  const parent = new Map<string, string>(entries.map((entry) => [entry.code, entry.code]))
  const find = (code: string): string => {
    const up = parent.get(code)!
    if (up === code) return code
    const root = find(up)
    parent.set(code, root)
    return root
  }
  const join = (a: string, b: string) => {
    if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b))
  }
  for (const entry of entries) {
    if (entry.supersedes) join(entry.code, entry.supersedes)
    const predecessor = versions.get(entry.code)?.supersedes_code
    if (predecessor) join(entry.code, predecessor)
  }

  const lines = new Map<string, { entry: RuleSetEntry; index: number }[]>()
  entries.forEach((entry, index) => {
    const root = find(entry.code)
    if (!lines.has(root)) lines.set(root, [])
    lines.get(root)!.push({ entry, index })
  })

  const picked: { ruleSet: ResolvedRuleSet; index: number }[] = []
  for (const line of lines.values()) {
    const present = line.filter(
      ({ entry }) =>
        versions.get(entry.code)?.status !== 'retired' &&
        (!entry.region_province || entry.region_province === province)
    )
    // Once a line has a published version, unpublished ones (draft,
    // signed off) wait for their own publication (R2-08, D-317).
    const published = present.some(({ entry }) => versions.get(entry.code)?.status === 'active')
    const candidates = published
      ? present.filter(({ entry }) => versions.get(entry.code)?.status === 'active')
      : present
    if (candidates.length === 0) continue
    const started = candidates
      .filter(({ entry }) => compareSchoolYears(entry.applies_from_school_year, schoolYear) <= 0)
      .sort(
        (a, b) =>
          Number(Boolean(b.entry.region_province)) - Number(Boolean(a.entry.region_province)) ||
          compareSchoolYears(b.entry.applies_from_school_year, a.entry.applies_from_school_year) ||
          b.index - a.index
      )
    const earliest = [...candidates].sort(
      (a, b) =>
        compareSchoolYears(a.entry.applies_from_school_year, b.entry.applies_from_school_year) ||
        Number(Boolean(a.entry.region_province)) - Number(Boolean(b.entry.region_province)) ||
        a.index - b.index
    )
    const choice = started[0] ?? earliest[0]
    const version = versions.get(choice.entry.code)
    picked.push({
      index: choice.index,
      ruleSet: {
        domain,
        code: choice.entry.code,
        versionId: version?.id ?? null,
        kind: version?.kind ?? null,
        status: version?.status ?? null,
        effectiveOn: choice.entry.effective_on ?? null,
        appliesFromSchoolYear: choice.entry.applies_from_school_year,
        regionProvince: choice.entry.region_province ?? null,
        inForce: started.length > 0,
      },
    })
  }
  return picked.sort((a, b) => a.index - b.index).map(({ ruleSet }) => ruleSet)
}
