import { InvitationSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import School from '#models/school'
import User from '#models/user'
import type { MembershipRole } from '#models/school_membership'
import { withPublicId } from '#models/mixins/with_public_id'
import { withSchoolScope } from '#tenancy/with_school_scope'

export type InvitationState = 'open' | 'expired' | 'accepted'

/**
 * An invitation into a school (D-182). School-owned: read and written
 * inside a tenant transaction of its school, or a staff transaction in
 * the console. Only the hash of the mailed token is stored.
 */
export default class Invitation extends compose(InvitationSchema, withPublicId, withSchoolScope) {
  declare role: MembershipRole

  @belongsTo(() => School)
  declare school: BelongsTo<typeof School>

  @belongsTo(() => User, { foreignKey: 'invitedBy' })
  declare inviter: BelongsTo<typeof User>

  get state(): InvitationState {
    if (this.acceptedAt) return 'accepted'
    return this.expiresAt <= DateTime.now() ? 'expired' : 'open'
  }
}
