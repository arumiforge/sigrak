import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { beforeSave, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import SchoolMembership from '#models/school_membership'

/**
 * A school user (app.). Roles come from school memberships.
 */
export default class User extends compose(
  UserSchema,
  withAuthFinder(hash, { uids: ['email'], passwordColumnName: 'password' })
) {
  @beforeSave()
  static normalizeEmail(user: User) {
    user.email = user.email.trim().toLowerCase()
  }

  @hasMany(() => SchoolMembership)
  declare memberships: HasMany<typeof SchoolMembership>

  /**
   * The school the user works in now: the earliest active membership.
   * A school switcher for users of several schools comes later.
   */
  async currentMembership() {
    return SchoolMembership.query()
      .where('user_id', this.id)
      .where('status', 'active')
      .preload('school')
      .orderBy('started_on', 'asc')
      .orderBy('id', 'asc')
      .first()
  }
}
