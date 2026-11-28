import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Sign-up confirmation links (D-469). Like invitations and reset links,
 * only a SHA-256 hash of the mailed token is kept. One open link per
 * user (asking again replaces it); a link works once, until
 * `expires_at`, and only for the address it was sent to (`email`), so
 * a later change of address needs a new link. Belongs to a user, not a
 * school, so there is no school_id and no RLS (users has none either).
 */
export default class extends BaseSchema {
  protected tableName = 'email_confirmation_tokens'

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
      table.string('email', 254).notNullable()
      table.string('token_hash', 64).notNullable().unique()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
