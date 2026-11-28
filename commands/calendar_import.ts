import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Imports the calendar data of docs/data/calendar into layer packages
 * (R1-08): the SKB holiday file after its D-254 check, and every region
 * calendar file. Packages stay `draft` until Tim Validasi signs them off
 * (D-113); `--activate` publishes them. Safe to run again: only changes
 * are written.
 */
export default class CalendarImport extends BaseCommand {
  static commandName = 'calendar:import'
  static description =
    'Import docs/data/calendar (national holidays, region calendars) as layer packages'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Publish the packages (after Tim Validasi sign-off)' })
  declare activate: boolean

  async run() {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const calendar = await import('#calendar/data_files')
    try {
      const reports = await db.transaction(async (trx) => {
        const done = [await calendar.importNationalHolidays(trx)]
        for (const file of await calendar.regionFiles()) {
          done.push(await calendar.importRegionCalendar(trx, { file }))
        }
        if (this.activate) {
          for (const report of done) {
            await calendar.activateCalendarPackage(trx, report.packageCode, null)
            report.status = 'active'
          }
        }
        return done
      })
      for (const report of reports) {
        this.logger.success(
          `${report.packageCode}: ${report.created} created, ${report.revised} revised, ${report.retired} retired, ${report.unchanged} unchanged; package ${report.status}`
        )
      }
    } catch (error) {
      if (error instanceof calendar.CalendarImportException) {
        this.logger.error(
          `Check failed: ${error.problems.map((problem) => problem.key).join(', ')}`
        )
        this.exitCode = 1
        return
      }
      throw error
    }
  }
}
