import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { beforeSave, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import { byEmail } from '#models/email_lookup'
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
  /**
   * Sign-in lookup on the `lower(email)` index (see byEmail); replaces
   * the mixin's `where email = ?`, which scans the table.
   */
  static findForAuth<T extends LucidModel>(this: T, _uids: string[], value: string) {
    return byEmail(this, value).first()
  }

  @beforeSave()
  static normalizeEmail(user: User) {
    user.email = user.email.trim().toLowerCase()
  }

  @hasMany(() => SchoolMembership)
  declare memberships: HasMany<typeof SchoolMembership>
}
