import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Region reference calendars and school calendars share one table with
 * exactly one owner (data model: Calendar; D-256, D-377). A school
 * calendar is copied from its region calendar.
 */
export default class extends BaseSchema {
  protected tableName = 'calendars'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique()
      table
        .bigInteger('region_id')
        .nullable()
        .references('id')
        .inTable('regions')
        .onDelete('CASCADE')
      table
        .bigInteger('school_id')
        .nullable()
        .references('id')
        .inTable('schools')
        .onDelete('CASCADE')
      table.string('academic_year', 9).notNullable()
      table.string('code', 60).nullable().unique()
      table.string('name', 150).notNullable()
      table.string('status', 10).notNullable()
      table.smallint('school_days_per_week').notNullable()
      table.date('starts_on').notNullable()
      table.date('even_semester_starts_on').notNullable()
      table.date('ends_on').notNullable()
      table.integer('version').notNullable().defaultTo(1)
      table
        .bigInteger('source_calendar_id')
        .nullable()
        .references('id')
        .inTable('calendars')
        .onDelete('SET NULL')
        .index()
      table.integer('source_version').nullable()
      // Joint-leave dates kept as school days (D-255): ["2027-02-05", …]
      table.jsonb('joint_leave_school_days').notNullable().defaultTo('[]')
      table.jsonb('meta').notNullable().defaultTo('{}')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['region_id', 'academic_year'])
      table.unique(['school_id', 'academic_year'])
      table.check(`num_nonnulls(region_id, school_id) = 1`, [], 'calendars_one_owner_check')
      table.check(`status IN ('draft', 'active')`, [], 'calendars_status_check')
      table.check(
        `school_days_per_week BETWEEN 5 AND 6`,
        [],
        'calendars_school_days_per_week_check'
      )
      table.check(
        `starts_on < even_semester_starts_on AND even_semester_starts_on < ends_on`,
        [],
        'calendars_dates_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
