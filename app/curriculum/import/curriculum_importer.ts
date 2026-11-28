import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { CurriculumImportError, type Json, type SourceFile } from './context.js'
import { FileReport, type ImportReport } from './report.js'
import { importSubjects } from './importers/subjects.js'
import { importCpGeneral, importCpMadrasah, importCpReligionSd } from './importers/cp.js'
import { importAllocationMi, importStructureSd } from './importers/structure.js'
import { importTopics } from './importers/topics.js'
import { syncProfileDates } from './profile_dates.js'
import { defaultCurriculumFiles } from '../data_files.js'
import {
  defaultProfilesDirectory,
  loadLevelProfiles,
  type LevelProfile,
} from '../policy/level_profiles.js'
import { PolicyProfileResolver } from '../policy/policy_profile_resolver.js'

type Importer = (
  trx: TransactionClientContract,
  source: SourceFile,
  report: FileReport,
  profiles: Map<string, LevelProfile>
) => Promise<void>

/**
 * File formats by their `dataset` key. Anything else, the legacy app's
 * format included, is refused (D-363).
 */
const importers: Record<string, Importer> = {
  subjects: importSubjects,
  cp_umum_sd: importCpGeneral,
  cp_pendidikan_agama_sd: importCpReligionSd,
  cp_pai_bahasa_arab_mi: importCpMadrasah,
  curriculum_structure_sd: importStructureSd,
  mi_allocation: importAllocationMi,
  sigrak_curriculum_topics: importTopics,
}

class StrictModeStop extends Error {}

export interface ImportOptions {
  /** Paths relative to the app root or absolute; default: `defaultCurriculumFiles`. */
  files?: string[]
  /** Stop at the first file with a data mismatch, writing nothing from it. */
  strict?: boolean
  profilesDirectory?: string
}

async function readSource(path: string): Promise<SourceFile> {
  const absolute = isAbsolute(path) ? path : resolve(app.makePath(), path)
  let buffer: Buffer
  try {
    buffer = await readFile(absolute)
  } catch {
    throw new CurriculumImportError(`${path}: file not found`)
  }
  let data: unknown
  try {
    data = JSON.parse(buffer.toString('utf8'))
  } catch (error) {
    throw new CurriculumImportError(`${path}: not valid JSON (${(error as Error).message})`)
  }
  const name = relative(app.makePath(), absolute)
  return {
    name: name.startsWith('..') ? absolute : name,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    data: (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as Json,
  }
}

function importerFor(source: SourceFile): Importer {
  const dataset = source.data.dataset
  if (dataset === 'curriculum_crosswalk') {
    throw new CurriculumImportError(
      `${source.name}: the legacy crosswalk is for the team only and is never imported (D-365)`
    )
  }
  const importer = typeof dataset === 'string' ? importers[dataset] : undefined
  if (!importer) {
    throw new CurriculumImportError(
      `${source.name}: unknown curriculum file format (dataset ${JSON.stringify(dataset ?? null)}). ` +
        'Only SIGRAK-format files are imported; the legacy app format is refused (D-363).'
    )
  }
  return importer
}

/**
 * `curriculum:import`: loads the curriculum files in order, one
 * transaction per file, idempotent by code (D-229), then copies the
 * Profil Jenjang dates onto the versions (D-378) and clears the
 * policy-profile cache.
 */
export async function importCurriculum(options: ImportOptions = {}): Promise<ImportReport> {
  const files =
    options.files && options.files.length > 0 ? options.files : [...defaultCurriculumFiles]
  const profiles = await loadLevelProfiles(options.profilesDirectory ?? defaultProfilesDirectory())
  const result: ImportReport = { files: [], profiles: null, failed: null }

  for (const path of files) {
    let report: FileReport | null = null
    try {
      const source = await readSource(path)
      const importer = importerFor(source)
      report = new FileReport(source.name, String(source.data.dataset))
      const fileReport = report
      await db.transaction(async (trx) => {
        await importer(trx, source, fileReport, profiles)
        if (options.strict && fileReport.mismatches.length > 0) {
          throw new StrictModeStop(
            `${source.name}: ${fileReport.mismatches.length} data mismatch(es) with --strict; nothing written from this file`
          )
        }
      })
      result.files.push(report)
    } catch (error) {
      if (report) result.files.push(report)
      if (error instanceof CurriculumImportError || error instanceof StrictModeStop) {
        result.failed = { file: path, error: error.message }
        break
      }
      throw error
    }
  }

  const profileReport = new FileReport(
    relative(app.makePath(), options.profilesDirectory ?? defaultProfilesDirectory()),
    'level_profile'
  )
  await db.transaction((trx) => syncProfileDates(trx, profiles, profileReport))
  result.profiles = profileReport

  PolicyProfileResolver.clearCache()
  return result
}
