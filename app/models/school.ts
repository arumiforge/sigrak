import { SchoolSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Region from '#models/region'
import Calendar from '#models/calendar'

export type SchoolLevel = 'sd' | 'mi'
export type RegionSource = 'npsn_directory' | 'dapodik_import' | 'staff_manual'

/**
 * One school, one tenant. `region_id` is its kabupaten/kota and
 * `district_id` its kecamatan (app/regions); users never pick them.
 */
export default class School extends SchoolSchema {
  declare level: SchoolLevel
  declare regionSource: RegionSource

  @belongsTo(() => Region)
  declare region: BelongsTo<typeof Region>

  @belongsTo(() => Region, { foreignKey: 'districtId' })
  declare districtRegion: BelongsTo<typeof Region>

  @hasMany(() => Calendar)
  declare calendars: HasMany<typeof Calendar>
}
