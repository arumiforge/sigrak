import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Events of a region or school calendar (data model: Calendar; D-258,
 * D-269). The class_id column (NULL = whole school) is added with the
 * classes table.
 */
export default class extends BaseSchema {
  protected tableName = 'calendar_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique()
      table
        .bigInteger('calendar_id')
        .notNullable()
        .references('id')
        .inTable('calendars')
        .onDelete('CASCADE')
      table.date('starts_on').notNullable()
      table.date('ends_on').notNullable()
      table.string('kind', 20).notNullable()
      table.string('exam_type', 10).nullable()
      table.string('title', 150).notNullable()
      // A school copy of a region event keeps that event's public_id (D-256).
      table.uuid('source_event_uid').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['calendar_id', 'starts_on'])
      table.check(`starts_on <= ends_on`, [], 'calendar_events_dates_check')
      table.check(
        `kind IN ('holiday', 'exam', 'school_event', 'no_lessons')`,
        [],
        'calendar_events_kind_check'
      )
      table.check(
        `(kind = 'exam' AND exam_type IN ('sts', 'sas', 'other')) OR (kind <> 'exam' AND exam_type IS NULL)`,
        [],
        'calendar_events_exam_type_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
