import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { LevelProfile, RuleSetEntry } from '../policy/level_profiles.js'
import type { FileReport } from './report.js'

interface Dates {
  effective_on: string | null
  applies_from_school_year: string | null
  supersedes: string | null
}

const datesOf = (entry: RuleSetEntry): Dates => ({
  effective_on: entry.effective_on ?? null,
  applies_from_school_year: entry.applies_from_school_year,
  supersedes: entry.supersedes ?? null,
})

/**
 * Copies each rule set's `effective_on`, `applies_from_school_year` and
 * predecessor from the Profil Jenjang files onto `curriculum_versions`
 * (D-355, D-378). A version no profile lists gets NULLs. A code listed
 * with different dates in two places is a mismatch; the first listing
 * wins.
 */
export async function syncProfileDates(
  trx: TransactionClientContract,
  profiles: Map<string, LevelProfile>,
  report: FileReport
) {
  const byCode = new Map<string, { dates: Dates; where: string }>()
  for (const profile of profiles.values()) {
    for (const version of profile.versions) {
      for (const [domain, entries] of Object.entries(version.rule_sets)) {
        for (const entry of entries) {
          // A province entry may restate a national code; the national dates stay.
          if (entry.region_province) continue
          const where = `${profile.file} ${version.code} ${domain}`
          const dates = datesOf(entry)
          const known = byCode.get(entry.code)
          if (!known) {
            byCode.set(entry.code, { dates, where })
          } else if (JSON.stringify(known.dates) !== JSON.stringify(dates)) {
            report.mismatch(
              'profile_dates_conflict',
              `${entry.code}: ${where} gives ${JSON.stringify(dates)}, ${known.where} gives ${JSON.stringify(known.dates)}`,
              entry.code
            )
          }
        }
      }
    }
  }

  const versions = (await trx
    .from('curriculum_versions')
    .select('id', 'code', 'effective_on', 'applies_from_school_year', 'supersedes_id')
    .forUpdate()) as {
    id: number
    code: string
    effective_on: string | null
    applies_from_school_year: string | null
    supersedes_id: number | null
  }[]
  const idByCode = new Map(versions.map((version) => [version.code, version.id]))

  const counts = { created: 0, updated: 0, unchanged: 0 }
  for (const version of versions) {
    const dates = byCode.get(version.code)?.dates
    let supersedesId: number | null = null
    if (dates?.supersedes) {
      supersedesId = idByCode.get(dates.supersedes) ?? null
      if (supersedesId === null) {
        report.note(
          'supersedes_not_imported',
          `${version.code} supersedes ${dates.supersedes}, which is not imported`,
          version.code
        )
      }
    }
    const target = {
      effective_on: dates?.effective_on ?? null,
      applies_from_school_year: dates?.applies_from_school_year ?? null,
      supersedes_id: supersedesId,
    }
    if (
      target.effective_on === version.effective_on &&
      target.applies_from_school_year === version.applies_from_school_year &&
      target.supersedes_id === version.supersedes_id
    ) {
      counts.unchanged++
      continue
    }
    await trx
      .from('curriculum_versions')
      .where('id', version.id)
      .update({ ...target, updated_at: trx.raw('now()') })
    counts.updated++
  }
  report.count('curriculum_versions', counts)

  for (const code of byCode.keys()) {
    if (!idByCode.has(code)) {
      report.note(
        'profile_code_not_imported',
        `${code} is listed in a profile but not imported`,
        code
      )
    }
  }
}
