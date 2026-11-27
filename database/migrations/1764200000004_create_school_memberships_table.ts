import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A user's roles in a school (data model: Accounts and schools). One
 * user can hold several roles; one active principal per school.
 */
export default class extends BaseSchema {
  protected tableName = 'school_memberships'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique()
      table
        .bigInteger('school_id')
        .notNullable()
        .references('id')
        .inTable('schools')
        .onDelete('CASCADE')
      table
        .bigInteger('user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .index()
      table.string('role', 20).notNullable()
      table.string('status', 10).notNullable()
      table.date('started_on').notNullable()
      table.date('ended_on').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['school_id', 'user_id', 'role'])
      table.check(
        `role IN ('principal', 'operator', 'teacher')`,
        [],
        'school_memberships_role_check'
      )
      table.check(`status IN ('active', 'ended')`, [], 'school_memberships_status_check')
    })

    this.schema.raw(
      `CREATE UNIQUE INDEX school_memberships_active_principal_unique ON school_memberships (school_id) WHERE role = 'principal' AND status = 'active'`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
