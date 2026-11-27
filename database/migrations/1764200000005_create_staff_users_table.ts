import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Tim SIGRAK accounts for admin., on a separate guard and table, so a
 * school account can never become staff. TOTP 2FA and the scoped
 * staff_role_assignments (D-338, D-339, D-343) come with the console.
 */
export default class extends BaseSchema {
  protected tableName = 'staff_users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.string('name', 150).notNullable()
      table.string('email', 254).notNullable()
      table.string('password').notNullable()
      table.string('role', 20).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.check(`role IN ('admin', 'support', 'content')`, [], 'staff_users_role_check')
    })

    this.schema.raw(`CREATE UNIQUE INDEX staff_users_email_unique ON staff_users (lower(email))`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
