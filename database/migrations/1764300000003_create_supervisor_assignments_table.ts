import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Read-only scope of a pengawas or korwil over a school (data model:
 * Accounts and schools; D-309). A supervisor requests a sekolah binaan
 * and Tim SIGRAK approves or rejects it; staff can also assign directly
 * (a row created as approved) and revoke (ended_on set). School data
 * opens only while a row is approved and not ended.
 *
 * `started_on` is NULL until the request is approved: a requested or
 * rejected row has not started.
 */
export default class extends BaseSchema {
  protected tableName = 'supervisor_assignments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
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
      table.string('status', 10).notNullable()
      table.date('started_on').nullable()
      table.date('ended_on').nullable()
      table
        .bigInteger('decided_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
        .index()
      table.timestamp('decided_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['school_id', 'status'])
      table.check(
        `status IN ('requested', 'approved', 'rejected')`,
        [],
        'supervisor_assignments_status_check'
      )
      table.check(
        `(status = 'approved') = (started_on IS NOT NULL)`,
        [],
        'supervisor_assignments_started_on_check'
      )
      table.check(
        `ended_on IS NULL OR (status = 'approved' AND ended_on >= started_on)`,
        [],
        'supervisor_assignments_ended_on_check'
      )
      table.check(
        `(status = 'requested') = (decided_at IS NULL)`,
        [],
        'supervisor_assignments_decided_at_check'
      )
    })

    // One open request or assignment per supervisor and school.
    this.schema.raw(
      `CREATE UNIQUE INDEX supervisor_assignments_open_unique ON supervisor_assignments (school_id, user_id) WHERE status IN ('requested', 'approved') AND ended_on IS NULL`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
