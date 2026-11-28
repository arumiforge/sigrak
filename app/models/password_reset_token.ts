import { PasswordResetTokenSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

/**
 * One open "Lupa kata sandi" link per user (D-183); only the token's
 * hash is stored.
 */
export default class PasswordResetToken extends PasswordResetTokenSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
