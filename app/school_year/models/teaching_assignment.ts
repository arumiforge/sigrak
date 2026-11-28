import { TeachingAssignmentSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import { withSchoolScope } from '#tenancy/with_school_scope'
import Subject from '../../curriculum/models/subject.js'
import SchoolClass from './school_class.js'

/**
 * The teacher of one subject in one class (D-032). No row means no
 * teacher yet (D-240).
 */
export default class TeachingAssignment extends compose(TeachingAssignmentSchema, withSchoolScope) {
  @belongsTo(() => SchoolClass, { foreignKey: 'classId' })
  declare schoolClass: BelongsTo<typeof SchoolClass>

  @belongsTo(() => Subject)
  declare subject: BelongsTo<typeof Subject>

  @belongsTo(() => User, { foreignKey: 'teacherId' })
  declare teacher: BelongsTo<typeof User>
}
