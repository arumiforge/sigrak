import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, schoolRls } from '../../app/tenancy/rls.js'

/**
 * What a user last saw of the school calendar for one school year
 * (D-466 impact notice, D-274 shift preview). Official area changes
 * apply directly; the next time the operator or a teacher opens
 * Kalender, the page compares the resolved calendar with this snapshot
 * and shows what changed until they mark it as read.
 *
 * - `area_items`: item key → a short fingerprint of every item and hide
 *   that comes from above the school (national, province, kabupaten/
 *   kota, kecamatan), for the operator's impact notice.
 * - `off_days`: date → title of every school day that is not an
 *   effective day for the whole school, for the teachers' shift preview.
 * - `effective_days`: the whole-school total at that time.
 *
 * School-owned (RLS); one row per school, user and school year.
 */
export default class extends BaseSchema {
  protected tableName = 'calendar_snapshots'

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
      table.string('school_year', 9).notNullable()
      table.jsonb('area_items').notNullable().defaultTo('{}')
      table.jsonb('off_days').notNullable().defaultTo('{}')
      table.integer('effective_days').notNullable().defaultTo(0)
      table.timestamp('seen_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['school_id', 'user_id', 'school_year'])
      table.check(`school_year ~ '^[0-9]{4}/[0-9]{4}$'`, [], 'calendar_snapshots_school_year_check')
    })
    for (const sql of schoolRls(this.tableName)) this.schema.raw(sql)
  }

  async down() {
    for (const sql of dropRls(this.tableName)) this.schema.raw(sql)
    this.schema.dropTable(this.tableName)
  }
}
