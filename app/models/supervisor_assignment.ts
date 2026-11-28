import { SupervisorAssignmentSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import School from '#models/school'
import User from '#models/user'
import { withSchoolScope } from '#tenancy/with_school_scope'

export type SupervisorAssignmentStatus = 'requested' | 'approved' | 'rejected'

/**
 * A pengawas or korwil's read-only scope over one school (D-309).
 * Open while approved and not ended.
 */
export default class SupervisorAssignment extends compose(
  SupervisorAssignmentSchema,
  withSchoolScope
) {
  declare status: SupervisorAssignmentStatus

  @belongsTo(() => School)
  declare school: BelongsTo<typeof School>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
