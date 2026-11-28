import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import { jawaTengah } from '#regions/data/jawa_tengah'
import { seedRegionList } from '#regions/region_list'
import { importSchoolDirectory } from '#regions/school_directory_importer'

/**
 * The files of docs/data/schools loaded into the directory, in order.
 */
export const DIRECTORY_FILES = [
  'docs/data/schools/kudus.json',
  'docs/data/schools/jepara.json',
  'docs/data/schools/pati.json',
]

/**
 * Reference data for regions (R1-04): the Jawa Tengah region list
 * (Kudus, Jepara, Pati with their kecamatan) and the NPSN directory of
 * those three regencies from docs/data/schools. Idempotent; safe in
 * every environment.
 */
export default class RegionSeeder extends BaseSeeder {
  async run() {
    await seedRegionList(db.connection(), jawaTengah)
    for (const file of DIRECTORY_FILES) {
      const result = await importSchoolDirectory(app.makePath(file))
      if (result.unmatchedDistricts.length > 0) {
        logger.warn(
          `${result.regency}: kecamatan not in the region list: ${result.unmatchedDistricts.join(', ')}`
        )
      }
    }
  }
}
