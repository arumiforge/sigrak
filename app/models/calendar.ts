import { CalendarSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import CalendarEvent from '#models/calendar_event'
import { withPublicId } from '#models/mixins/with_public_id'

export type CalendarStatus = 'draft' | 'active'

/**
 * A region reference calendar or a school calendar (exactly one owner).
 * Queries for school users always filter on school_id; region rows are
 * never shown in the school scope (D-377).
 */
export default class Calendar extends compose(CalendarSchema, withPublicId) {
  declare status: CalendarStatus

  /**
   * jsonb: node-postgres would send a JS array as a Postgres array, so
   * the value is serialised explicitly.
   */
  @column({ prepare: (value: string[]) => JSON.stringify(value) })
  declare jointLeaveSchoolDays: string[]

  @column({ prepare: (value: Record<string, unknown>) => JSON.stringify(value) })
  declare meta: Record<string, unknown>

  @hasMany(() => CalendarEvent)
  declare events: HasMany<typeof CalendarEvent>
}
