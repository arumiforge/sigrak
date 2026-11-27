import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * School users only: teachers, principals, operators, supervisors.
 * No role column; roles come from school_memberships. No student users.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.string('name', 150).notNullable()
      table.string('email', 254).notNullable()
      table.string('password').notNullable()
      // Non-civil-servant teachers have no NIP.
      table.string('nip', 18).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.raw(`CREATE UNIQUE INDEX users_email_unique ON users (lower(email))`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
