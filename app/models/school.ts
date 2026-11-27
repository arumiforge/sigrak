import { SchoolSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Region from '#models/region'
import Calendar from '#models/calendar'

export type SchoolLevel = 'sd' | 'mi'

/**
 * One school, one tenant.
 */
export default class School extends SchoolSchema {
  declare level: SchoolLevel

  @belongsTo(() => Region)
  declare region: BelongsTo<typeof Region>

  @hasMany(() => Calendar)
  declare calendars: HasMany<typeof Calendar>
}
