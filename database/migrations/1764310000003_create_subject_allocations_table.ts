import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * JP allocation per version, subject, grade and learning type (data
 * model: Curriculum; D-366, D-458).
 *
 * - Structure versions (Permendikdasmen 13/2025, KMA 1503/2025) give
 *   the official yearly JP, intracurricular and cocurricular rows.
 * - SIGRAK topic versions give the semester targets the topics are
 *   checked against (`subjects[].allocations` of a SIGRAK file).
 *
 * `art_branch` is set only on the Seni dan Budaya tracks of a SIGRAK
 * version: one full track per branch, the school picks the branch per
 * class (D-458, D-464). `jp_target_set_by = 'school'` marks a row that
 * is only a SIGRAK suggestion, never a target (Tata Boga, D-458).
 * `status`: compulsory (from the structure), optional (SIGRAK content a
 * school switches on, D-204), elective (mata pelajaran pilihan, D-452).
 */
export default class extends BaseSchema {
  protected tableName = 'subject_allocations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('curriculum_version_id')
        .notNullable()
        .references('id')
        .inTable('curriculum_versions')
        .onDelete('CASCADE')
      table
        .bigInteger('subject_id')
        .notNullable()
        .references('id')
        .inTable('subjects')
        .onDelete('RESTRICT')
        .index()
      table.smallint('grade').notNullable()
      table.string('phase', 1).notNullable()
      table.string('learning_type', 15).notNullable()
      table.string('art_branch', 12).nullable()
      table.string('status', 12).notNullable()
      table.string('jp_target_set_by', 12).notNullable().defaultTo('curriculum')
      table.smallint('jp_per_week').notNullable()
      table.smallint('jp_per_year').notNullable()
      table.smallint('weeks_per_year').notNullable()
      table.smallint('s1_jp').notNullable()
      table.smallint('s1_effective_weeks').notNullable()
      table.smallint('s2_jp').notNullable()
      table.smallint('s2_effective_weeks').notNullable()
      table.text('basis').nullable()
      table.jsonb('meta').notNullable().defaultTo('{}')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['curriculum_version_id', 'grade'])
      table.check(`grade BETWEEN 1 AND 6`, [], 'subject_allocations_grade_check')
      table.check(`phase IN ('A', 'B', 'C')`, [], 'subject_allocations_phase_check')
      table.check(
        `learning_type IN ('intracurricular', 'cocurricular')`,
        [],
        'subject_allocations_learning_type_check'
      )
      table.check(
        `art_branch IN ('music', 'visual_art', 'dance', 'theatre')`,
        [],
        'subject_allocations_art_branch_check'
      )
      table.check(
        `status IN ('compulsory', 'optional', 'elective')`,
        [],
        'subject_allocations_status_check'
      )
      table.check(
        `jp_target_set_by IN ('curriculum', 'school')`,
        [],
        'subject_allocations_jp_target_set_by_check'
      )
      table.check(
        `jp_per_week >= 0 AND jp_per_year >= 0 AND s1_jp >= 0 AND s2_jp >= 0
          AND s1_effective_weeks BETWEEN 0 AND 20 AND s2_effective_weeks BETWEEN 0 AND 20
          AND weeks_per_year = s1_effective_weeks + s2_effective_weeks`,
        [],
        'subject_allocations_ranges_check'
      )
    })

    // One row per version, subject, grade, learning type and art branch;
    // rows without a branch count as one (NULLS NOT DISTINCT).
    this.schema.raw(`
      ALTER TABLE subject_allocations
        ADD CONSTRAINT subject_allocations_row_unique
        UNIQUE NULLS NOT DISTINCT (curriculum_version_id, subject_id, grade, learning_type, art_branch)
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
