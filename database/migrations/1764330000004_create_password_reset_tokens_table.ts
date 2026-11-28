import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * "Lupa kata sandi" links for school users (D-183). Like invitations,
 * only a SHA-256 hash of the mailed token is kept. A link works once
 * and for 60 minutes; asking again replaces the user's open link (one
 * row per user). Belongs to a user, not a school, so there is no
 * school_id and no RLS (users has none either).
 */
export default class extends BaseSchema {
  protected tableName = 'password_reset_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .unique()
      table.string('token_hash', 64).notNullable().unique()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
