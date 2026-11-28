import { AcademicYearSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { withPublicId } from '#models/mixins/with_public_id'
import { withSchoolScope } from '#tenancy/with_school_scope'
import SchoolClass from './school_class.js'

/**
 * One academic year of a school (D-241). Its name follows the start
 * date (`2026/2027`); a closed year is read-only (D-318).
 */
export default class AcademicYear extends compose(
  AcademicYearSchema,
  withPublicId,
  withSchoolScope
) {
  @hasMany(() => SchoolClass)
  declare classes: HasMany<typeof SchoolClass>

  get isClosed() {
    return Boolean(this.closedAt)
  }
}
