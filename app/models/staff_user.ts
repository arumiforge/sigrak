import { StaffUserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { beforeSave } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import type { LucidModel } from '@adonisjs/lucid/types/model'
import { byEmail } from '#models/email_lookup'

export type StaffRole = 'admin' | 'support' | 'content'

/**
 * A Tim SIGRAK account (admin.), on its own table and guard.
 */
export default class StaffUser extends compose(
  StaffUserSchema,
  withAuthFinder(hash, { uids: ['email'], passwordColumnName: 'password' })
) {
  declare role: StaffRole

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
