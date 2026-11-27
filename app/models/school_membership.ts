import { SchoolMembershipSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import School from '#models/school'
import User from '#models/user'
import { withPublicId } from '#models/mixins/with_public_id'

export type MembershipRole = 'principal' | 'operator' | 'teacher'
export type MembershipStatus = 'active' | 'ended'

export default class SchoolMembership extends compose(SchoolMembershipSchema, withPublicId) {
  declare role: MembershipRole
  declare status: MembershipStatus

  @belongsTo(() => School)
  declare school: BelongsTo<typeof School>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
