import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, schoolRls } from '../../app/tenancy/rls.js'

/**
 * Classes (rombel) of an academic year (data model; D-241, D-458,
 * D-464). Model `SchoolClass`.
 *
 * - `grade` 1–6; `name` free text up to 20 characters, unique per year
 *   ignoring case (`4A` and `4a` are one class).
 * - The year must belong to the same school: composite foreign key on
 *   `(academic_year_id, school_id)`. A year with classes cannot be
 *   deleted (RESTRICT).
 * - `art_branch`: the Seni dan Budaya branch the class learns (music,
 *   visual_art, dance, theatre; D-458); NULL = not chosen yet. Dance and
 *   theatre may be chosen although SIGRAK has no topics for them yet
 *   (D-464).
 * - `homeroom_teacher_id`: the guru kelas (SD) / wali kelas (MI),
 *   NULL = not assigned yet (D-383).
 * - `(id, school_id)` is unique for the composite foreign key of
 *   `teaching_assignments`.
 *
 * School-owned, so RLS applies (R1-01).
 */
export default class extends BaseSchema {
  protected tableName = 'classes'

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
      table.smallint('grade').notNullable()
      table.string('name', 20).notNullable()
      table.string('art_branch', 20).nullable()
      table
        .bigInteger('homeroom_teacher_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .index()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table
        .foreign(['academic_year_id', 'school_id'], 'classes_academic_year_school_foreign')
        .references(['id', 'school_id'])
        .inTable('academic_years')
        .onDelete('RESTRICT')
      table.unique(['id', 'school_id'])
      table.index(['school_id', 'academic_year_id', 'grade'])
      table.check('grade BETWEEN 1 AND 6', [], 'classes_grade_check')
      table.check(`name = btrim(name) AND name <> ''`, [], 'classes_name_check')
      table.check(
        `art_branch IS NULL OR art_branch IN ('music', 'visual_art', 'dance', 'theatre')`,
        [],
        'classes_art_branch_check'
      )
    })

    this.schema.raw(
      `CREATE UNIQUE INDEX classes_year_name_unique ON classes (academic_year_id, lower(name))`
    )

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
