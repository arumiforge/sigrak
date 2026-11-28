import { StaffUserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { beforeSave, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import { byEmail } from '#models/email_lookup'
import StaffRoleAssignment from '#models/staff_role_assignment'

export type { StaffRole } from '#staff/roles'

/**
 * A Tim SIGRAK account (admin.), on its own table and guard. Its roles
 * and scopes are `roleAssignments` (D-338, D-339); app/staff/access.ts
 * reads them. A disabled account (`disabledAt`) cannot sign in.
 */
export default class StaffUser extends compose(
  StaffUserSchema,
  withAuthFinder(hash, { uids: ['email'], passwordColumnName: 'password' })
) {
  @hasMany(() => StaffRoleAssignment)
  declare roleAssignments: HasMany<typeof StaffRoleAssignment>

  /** The TOTP secret, encrypted (app/staff/two_factor.ts); never serialized. */
  @column({ serializeAs: null })
  declare twoFactorSecret: string | null

  /** Never serialized either: the step of the last accepted code. */
  @column({ serializeAs: null })
  declare twoFactorLastStep: number | null

  get isDisabled() {
    return this.disabledAt !== null
  }

  /**
   * Sign-in lookup on the `lower(email)` index (see byEmail); replaces
   * the mixin's `where email = ?`, which scans the table.
   */
  static findForAuth<T extends LucidModel>(this: T, _uids: string[], value: string) {
    return byEmail(this, value).first()
  }

  @beforeSave()
  static normalizeEmail(staff: StaffUser) {
    staff.email = staff.email.trim().toLowerCase()
  }
}
