import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, schoolRls } from '../../app/tenancy/rls.js'

/**
 * A draft timetable for one class or every class of a year (D-262,
 * D-381). Model `TimetableDraft`.
 *
 * - `class_ids`: the classes the draft covers (a class deleted later is
 *   skipped when the draft is saved).
 * - `seed`: the generator is pure and seeded, so a draft can be made
 *   again; Acak ulang makes a new draft with a new seed.
 * - `status`: queued → running → ready or failed; saved once its rows
 *   replaced the unlocked rows of its classes.
 * - `input`: the frame and switches the draft was made with; `result`:
 *   the rows per class and the JP that could not be placed, with the
 *   reason.
 * - The year must belong to the same school (composite foreign key).
 *
 * School-owned, so RLS applies (R1-01).
 */
export default class extends BaseSchema {
  protected tableName = 'timetable_drafts'

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
      table.bigInteger('academic_year_id').notNullable()
      table.specificType('class_ids', 'bigint[]').notNullable()
      table.integer('seed').notNullable()
      table.string('status', 20).notNullable().defaultTo('queued')
      table.jsonb('input').nullable()
      table.jsonb('result').nullable()
      table.string('error', 200).nullable()
      table
        .bigInteger('created_by_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .index()
      table.timestamp('saved_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table
        .foreign(['academic_year_id', 'school_id'], 'timetable_drafts_academic_year_school_foreign')
        .references(['id', 'school_id'])
        .inTable('academic_years')
        .onDelete('CASCADE')
      table.index(['school_id', 'created_at'])
      table.check(
        `status IN ('queued', 'running', 'ready', 'failed', 'saved')`,
        [],
        'timetable_drafts_status_check'
      )
      table.check(`cardinality(class_ids) >= 1`, [], 'timetable_drafts_class_ids_check')
      table.check(`(status = 'saved') = (saved_at IS NOT NULL)`, [], 'timetable_drafts_saved_check')
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
