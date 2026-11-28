import { StaffPasswordTokenSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import StaffUser from '#models/staff_user'

/**
 * The one open "set your password" link of a staff member (new
 * accounts, or sent again by an admin); only the token's hash is
 * stored.
 */
export default class StaffPasswordToken extends StaffPasswordTokenSchema {
  @belongsTo(() => StaffUser)
  declare staffUser: BelongsTo<typeof StaffUser>
}
