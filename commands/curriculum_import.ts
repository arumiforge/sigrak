import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type { FileReport } from '../app/curriculum/import/report.js'

/**
 * `node ace curriculum:import [files…] [--strict]` (D-229, D-363,
 * D-378). With no file it loads the repository curriculum data in
 * order. Each file is one transaction and is matched by code, so a
 * second run changes nothing. Data mismatches are listed; with
 * `--strict` the first file that has any writes nothing and the
 * command fails.
 */
export default class CurriculumImport extends BaseCommand {
  static commandName = 'curriculum:import'
  static description = 'Import the SIGRAK curriculum data files (idempotent by code)'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.spread({
    description: 'Files to import (default: the repository data, in order)',
    required: false,
  })
  declare files?: string[]

  @flags.boolean({
    description: 'Stop at the first file with a data mismatch and write nothing from it',
  })
  declare strict: boolean

  @flags.boolean({ description: 'List every mismatch, note and kept row instead of the first ten' })
  declare verbose: boolean

  async run() {
    const { importCurriculum } = await import('../app/curriculum/import/curriculum_importer.js')
    const result = await importCurriculum({ files: this.files, strict: this.strict })

    for (const report of result.files) this.#print(report)
    if (result.profiles) this.#print(result.profiles)

    const mismatches = result.files.reduce((sum, report) => sum + report.mismatches.length, 0)
    if (result.failed) {
      this.logger.error(result.failed.error)
      this.exitCode = 1
      return
    }
    this.logger.success(
      `Imported ${result.files.length} file(s): ${result.files.reduce((sum, r) => sum + r.changes, 0)} row(s) created or updated, ${mismatches} mismatch(es)`
    )
  }

  #print(report: FileReport) {
    const version = report.versionCode
      ? ` → ${report.versionCode}${report.versionCreated ? ' (new, draft)' : ''}`
      : ''
    this.logger.info(`${report.file} [${report.dataset}]${version}`)
    for (const [table, counts] of Object.entries(report.tables)) {
      this.logger.log(
        `  ${table}: ${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged`
      )
    }
    const limit = this.verbose ? Number.POSITIVE_INFINITY : 10
    for (const [label, findings] of [
      ['mismatch', report.mismatches],
      ['kept', report.missing],
      ['note', report.notes],
    ] as const) {
      if (findings.length === 0) continue
      this.logger.log(`  ${findings.length} ${label}(es):`)
      for (const finding of findings.slice(0, limit)) {
        this.logger.log(`    - [${finding.kind}] ${finding.message}`)
      }
      if (findings.length > limit)
        this.logger.log(`    … ${findings.length - limit} more (--verbose)`)
    }
  }
}
