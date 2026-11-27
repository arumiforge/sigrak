import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * TKA practice sessions (data model: TKA practice exam). Spike subset:
 * enough for the ujian. guard. The package, subject, duration, token
 * and proctor columns come with the exam slice.
 */
export default class extends BaseSchema {
  protected tableName = 'exam_sessions'

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
        .index()
      table.string('title', 150).notNullable()
      table.timestamp('opens_at', { useTz: true }).notNullable()
      table.timestamp('closes_at', { useTz: true }).notNullable()
      table.string('status', 10).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.check(`opens_at < closes_at`, [], 'exam_sessions_window_check')
      table.check(
        `status IN ('draft', 'scheduled', 'open', 'closed')`,
        [],
        'exam_sessions_status_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
