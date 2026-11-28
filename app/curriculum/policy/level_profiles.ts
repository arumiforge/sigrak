import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import { isSchoolYear } from '../school_year.js'

/**
 * One rule set listed in a Profil Jenjang version (D-354, D-355).
 * `supersedes` (optional) names the code this entry replaces, which
 * makes both one line for the resolver; `region_province` limits an
 * entry to one province. `borrowed_from` marks a rule set of another
 * level that this level also uses (MI lists the SD topic version for its
 * general subjects, D-469); the import cross-checks such a version only
 * against its own level's structure.
 */
export interface RuleSetEntry {
  code: string
  effective_on: string | null
  applies_from_school_year: string
  source?: string
  region_province?: string | null
  supersedes?: string | null
  borrowed_from?: string | null
}

export type RuleSetDomain = 'structure_jp' | 'cp' | 'tp_atp_defaults' | (string & {})

export interface ProfileVersion {
  code: string
  applies_from_school_year: string
  label: string
  ministry: { code: string; name: string }
  rule_sets: Record<string, RuleSetEntry[]>
  religion_subjects: string
  character_frameworks: string[]
  cocurricular_jp_source: string
  rpm_extra_fields: Record<string, unknown>
  report_export_target: string
  homeroom_teacher_term: string
  homeroom_jtm_default: number
  external_assessments: { code: string; status: string }[]
  calendar_source: string
  data_of_record: string
  [key: string]: unknown
}

export interface LevelProfile {
  level: string
  status: string
  file: string
  versions: ProfileVersion[]
}

export class LevelProfileError extends Error {}

export const defaultProfilesDirectory = () => app.makePath('docs/data/profiles')

/**
 * Reads the Profil Jenjang files (`docs/data/profiles/<level>.json`,
 * D-356, D-378). A new level is a new file; code never checks the
 * level itself.
 */
export async function loadLevelProfiles(
  directory = defaultProfilesDirectory()
): Promise<Map<string, LevelProfile>> {
  const names = await readdir(directory)
  const files = names.filter((name) => name.endsWith('.json')).sort()
  const profiles = new Map<string, LevelProfile>()
  for (const name of files) {
    const file = join(directory, name)
    const data = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
    if (data.dataset !== 'level_profile') continue
    const profile = validateProfile(data, name)
    if (profiles.has(profile.level)) {
      throw new LevelProfileError(`${name}: level "${profile.level}" is defined twice`)
    }
    profiles.set(profile.level, profile)
  }
  return profiles
}

function validateProfile(data: Record<string, unknown>, file: string): LevelProfile {
  if (typeof data.level !== 'string' || data.level === '') {
    throw new LevelProfileError(`${file}: "level" is missing`)
  }
  if (!Array.isArray(data.versions) || data.versions.length === 0) {
    throw new LevelProfileError(`${file}: "versions" must list at least one version`)
  }
  const versions = data.versions as ProfileVersion[]
  for (const [index, version] of versions.entries()) {
    const where = `${file} versions[${index}]`
    if (typeof version.code !== 'string') throw new LevelProfileError(`${where}: "code" is missing`)
    if (!isSchoolYear(version.applies_from_school_year)) {
      throw new LevelProfileError(`${where}: applies_from_school_year must look like 2026/2027`)
    }
    if (!version.rule_sets || typeof version.rule_sets !== 'object') {
      throw new LevelProfileError(`${where}: "rule_sets" is missing`)
    }
    for (const [domain, entries] of Object.entries(version.rule_sets)) {
      if (!Array.isArray(entries)) {
        throw new LevelProfileError(`${where}.rule_sets.${domain}: expected a list`)
      }
      for (const [entryIndex, entry] of entries.entries()) {
        const entryWhere = `${where}.rule_sets.${domain}[${entryIndex}]`
        if (typeof entry.code !== 'string') {
          throw new LevelProfileError(`${entryWhere}: "code" is missing`)
        }
        if (!isSchoolYear(entry.applies_from_school_year)) {
          throw new LevelProfileError(
            `${entryWhere}: applies_from_school_year must look like 2026/2027`
          )
        }
        if (
          entry.effective_on !== null &&
          !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.effective_on))
        ) {
          throw new LevelProfileError(`${entryWhere}: effective_on must be a date or null`)
        }
        if (entry.borrowed_from != null && typeof entry.borrowed_from !== 'string') {
          throw new LevelProfileError(`${entryWhere}: borrowed_from must be a level code`)
        }
      }
    }
  }
  return {
    level: data.level,
    status: String(data.status ?? 'draft'),
    file,
    versions,
  }
}
