import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, schoolRls } from '../../app/tenancy/rls.js'

/**
 * Academic years of a school (data model: School year, classes,
 * students; D-241, D-318).
 *
 * - `name` follows the start date (`2026/2027`) and is never typed; a
 *   CHECK keeps the two in step.
 * - `starts_on < even_semester_starts_on < ends_on`, and a year lasts
 *   at most 12 months.
 * - Years of one school never overlap: an exclusion constraint on the
 *   date range (btree_gist, a trusted extension), so two requests at
 *   the same time cannot both slip past the app check.
 * - `closed_at` marks a closed year, which is read-only (D-318).
 * - `(id, school_id)` is unique so `classes` can point at a year of
 *   its own school only (composite foreign key).
 *
 * School-owned, so RLS applies (R1-01).
 */
export default class extends BaseSchema {
  protected tableName = 'academic_years'

  async up() {
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS btree_gist')

    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique()
      table
        .bigInteger('school_id')
        .notNullable()
        .references('id')
        .inTable('schools')
        .onDelete('CASCADE')
      table.string('name', 9).notNullable()
      table.date('starts_on').notNullable()
      table.date('even_semester_starts_on').notNullable()
      table.date('ends_on').notNullable()
      table.timestamp('closed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['school_id', 'name'])
      table.unique(['id', 'school_id'])
      table.index(['school_id', 'starts_on'])
      table.check(
        'starts_on < even_semester_starts_on AND even_semester_starts_on < ends_on',
        [],
        'academic_years_dates_check'
      )
      table.check(
        `ends_on < starts_on + interval '1 year'`,
        [],
        'academic_years_at_most_a_year_check'
      )
      table.check(
        `name = extract(year FROM starts_on)::int::text || '/' || (extract(year FROM starts_on)::int + 1)::text`,
        [],
        'academic_years_name_check'
      )
    })

    this.schema.raw(`
      ALTER TABLE academic_years ADD CONSTRAINT academic_years_no_overlap
      EXCLUDE USING gist (school_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&)
    `)

    for (const sql of schoolRls(this.tableName)) {
      this.schema.raw(sql)
    }
  }

  async down() {
    for (const sql of dropRls(this.tableName)) {
      this.schema.raw(sql)
    }
    this.schema.dropTable(this.tableName)
  }
}
