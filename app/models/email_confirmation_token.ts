import { EmailConfirmationTokenSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

/**
 * One open sign-up confirmation link per user (D-469); only the
 * token's hash is stored.
 */
export default class EmailConfirmationToken extends EmailConfirmationTokenSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
