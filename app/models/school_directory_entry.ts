import { SchoolDirectoryEntrySchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Region from '#models/region'
import type { SchoolLevel } from '#models/school'

/**
 * One SD or MI of the NPSN directory (D-169, D-170). Reference data,
 * not a tenant; written only by `school-directory:import`.
 */
export default class SchoolDirectoryEntry extends SchoolDirectoryEntrySchema {
  declare level: SchoolLevel

  /** The kabupaten/kota. */
  @belongsTo(() => Region)
  declare region: BelongsTo<typeof Region>

  /** The kecamatan, when its name matched the region list. */
  @belongsTo(() => Region, { foreignKey: 'districtId' })
  declare district: BelongsTo<typeof Region>
}
