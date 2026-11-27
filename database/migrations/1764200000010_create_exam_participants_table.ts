import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Exam participants sign in to ujian. with the exam card of one session.
 * They are not users. The password is encrypted (not hashed) so cards
 * can be reprinted (data model). Spike subset: student_id, item order
 * and timing columns come with the exam slice.
 */
export default class extends BaseSchema {
  protected tableName = 'exam_participants'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique()
      table
        .bigInteger('exam_session_id')
        .notNullable()
        .references('id')
        .inTable('exam_sessions')
        .onDelete('CASCADE')
      table.string('username', 32).notNullable().index()
      table.text('password').notNullable()
      table.string('status', 15).notNullable().defaultTo('not_started')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['exam_session_id', 'username'])
      table.check(
        `status IN ('not_started', 'in_progress', 'submitted', 'expired')`,
        [],
        'exam_participants_status_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
