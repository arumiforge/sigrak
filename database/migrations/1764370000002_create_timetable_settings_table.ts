import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, schoolRls } from '../../app/tenancy/rls.js'

/**
 * The school's frame for the draft timetable (D-262). Model
 * `TimetableSetting`; at most one row per school, and no row means the
 * defaults in `app/timetable/settings.ts`.
 *
 * - `days`: per weekday the start time, the number of lessons (0 = no
 *   school) and an optional opening row (Upacara or Kegiatan) before
 *   the first lesson.
 * - `breaks`: Istirahat after lesson n, in minutes, on every day that
 *   has a lesson after it.
 * - The five soft preferences of D-262 as on/off switches, no weights.
 *
 * School-owned, so RLS applies (R1-01).
 */
export default class extends BaseSchema {
  protected tableName = 'timetable_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('school_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('schools')
        .onDelete('CASCADE')
      table.jsonb('days').notNullable()
      table.jsonb('breaks').notNullable()
      table.boolean('pref_max_consecutive').notNullable().defaultTo(true)
      table.boolean('pref_pjok_morning').notNullable().defaultTo(true)
      table.boolean('pref_core_early').notNullable().defaultTo(true)
      table.boolean('pref_spread_week').notNullable().defaultTo(true)
      table.boolean('pref_no_split_break').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.check(`jsonb_typeof(days) = 'array'`, [], 'timetable_settings_days_check')
      table.check(`jsonb_typeof(breaks) = 'array'`, [], 'timetable_settings_breaks_check')
    })

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
