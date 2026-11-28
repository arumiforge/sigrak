import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Loads NPSN directory files (docs/data/schools/*.json, made by
 * scripts/school-directory/fetch.cjs) into school_directory_entries
 * (D-169). Idempotent by NPSN; region differences of existing schools
 * go to the Perubahan wilayah queue (D-466).
 *
 *   node ace school-directory:import docs/data/schools/kudus.json
 */
export default class SchoolDirectoryImport extends BaseCommand {
  static commandName = 'school-directory:import'
  static description = 'Load NPSN school directory files into school_directory_entries'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.spread({ description: 'Directory JSON files' })
  declare files: string[]

  async run() {
    const { importSchoolDirectory, DirectoryImportError } =
      await import('#regions/school_directory_importer')

    for (const file of this.files) {
      try {
        const result = await importSchoolDirectory(this.app.makePath(file))
        this.logger.success(
          `${result.regency}: ${result.inserted} added, ${result.updated} updated, ` +
            `${result.unchanged} unchanged, ${result.removed} removed, ` +
            `${result.reviewsQueued} region changes to review`
        )
        if (result.unmatchedDistricts.length > 0) {
          this.logger.warning(
            `${result.regency}: kecamatan not in the region list: ${result.unmatchedDistricts.join(', ')}`
          )
        }
      } catch (error) {
        if (!(error instanceof DirectoryImportError)) throw error
        this.logger.error(error.message)
        this.exitCode = 1
      }
    }
  }
}
