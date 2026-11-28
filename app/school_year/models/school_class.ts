import { ClassSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import { withPublicId } from '#models/mixins/with_public_id'
import { withSchoolScope } from '#tenancy/with_school_scope'
import type { ArtBranch } from '../../curriculum/types.js'
import AcademicYear from './academic_year.js'
import TeachingAssignment from './teaching_assignment.js'

/**
 * A class (rombel) of one academic year (table `classes`, D-241). The
 * homeroom teacher is the guru kelas (SD) or wali kelas (MI), D-383;
 * `artBranch` is the Seni dan Budaya branch the class learns (D-458).
 */
export default class SchoolClass extends compose(ClassSchema, withPublicId, withSchoolScope) {
  static table = 'classes'

  declare artBranch: ArtBranch | null

  @belongsTo(() => AcademicYear)
  declare academicYear: BelongsTo<typeof AcademicYear>

  @belongsTo(() => User, { foreignKey: 'homeroomTeacherId' })
  declare homeroomTeacher: BelongsTo<typeof User>

  @hasMany(() => TeachingAssignment, { foreignKey: 'classId' })
  declare assignments: HasMany<typeof TeachingAssignment>
}
