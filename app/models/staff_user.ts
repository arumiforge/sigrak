import { StaffUserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { beforeSave } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'

export type StaffRole = 'admin' | 'support' | 'content'

/**
 * A Tim SIGRAK account (admin.), on its own table and guard.
 */
export default class StaffUser extends compose(
  StaffUserSchema,
  withAuthFinder(hash, { uids: ['email'], passwordColumnName: 'password' })
) {
  declare role: StaffRole

  @beforeSave()
  static normalizeEmail(staff: StaffUser) {
    staff.email = staff.email.trim().toLowerCase()
  }
}
