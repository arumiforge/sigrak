import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { beforeSave, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import SchoolMembership from '#models/school_membership'

/**
 * A school user (app.). Roles come from school memberships; the active
 * one is picked per request by the school context middleware (R1-01)
 * and read in tenant transactions (app/accounts/memberships.ts).
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
}
