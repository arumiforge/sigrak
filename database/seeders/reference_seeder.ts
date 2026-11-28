import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { importNationalHolidays } from '#calendar/data_files'

/**
 * Reference data from docs/data/calendar (D-253, D-254): the national
 * holidays and joint leave as the national calendar package, after the
 * D-254 check of the file. It stays draft until Tim Validasi signs it
 * off (console: Kalender, "Aktifkan"). Idempotent.
 */
export default class ReferenceSeeder extends BaseSeeder {
  async run() {
    await db.transaction((trx) => importNationalHolidays(trx))
  }
}
