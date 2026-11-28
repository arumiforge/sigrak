import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type { FileReport } from '../app/curriculum/import/report.js'

/**
 * `node ace curriculum:import [files…] [--strict]` (D-229, D-363,
 * D-378). With no file it loads the repository curriculum data in
 * order. Each file is one transaction and is matched by code, so a
 * second run changes nothing. Data mismatches are listed; with
 * `--strict` the first file that has any writes nothing and the
 * command fails. `--by <staff email>` records who imported, so that
 * person cannot sign the version off in the curriculum console (R2-08,
 * D-339).
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

  @flags.string({
    description: 'Email of the staff member who prepared the files (they cannot sign it off)',
  })
  declare by?: string

  async run() {
    const { importCurriculum } = await import('../app/curriculum/import/curriculum_importer.js')
    const { default: StaffUser } = await import('#models/staff_user')
    const { recordImport } = await import('../app/curriculum/console/review.js')
    const { default: CurriculumVersion } =
      await import('../app/curriculum/models/curriculum_version.js')

    const staff = this.by
      ? await StaffUser.findBy('email', this.by.trim().toLowerCase())
      : undefined
    if (staff === null) {
      this.logger.error(`No staff account with the email ${this.by}`)
      this.exitCode = 1
      return
    }

    const result = await importCurriculum({ files: this.files, strict: this.strict })

    for (const report of result.files) this.#print(report)
    for (const report of result.files) {
      if (!report.versionCode || report.changes === 0) continue
      if (staff)
        await recordImport(staff, report.versionCode, {
          file: report.file,
          changes: report.changes,
        })
      const version = await CurriculumVersion.findBy('code', report.versionCode)
      if (version && version.status !== 'draft') {
        // D-229: an import never changes a status; the console shows the change.
        this.logger.warning(
          `${version.code} is ${version.status}: ${version.status === 'signed_off' ? 'publish now needs a new sign-off' : 'its data changed after publication'}`
        )
      }
    }
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
