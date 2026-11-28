import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Topics (materi pokok / ATP) of a SIGRAK topic version (data model:
 * Curriculum; D-363, D-452). `art_branch` is copied from
 * `extras.art_branch` so a Seni dan Budaya class can list its own
 * branch's topics (D-458). General SD topics carry `cp_summary` (the
 * "Ringkasan SIGRAK") and `element_codes`; religion and MI topics keep
 * `cp_text`, a printed copy of the official CP (D-127).
 */
export default class extends BaseSchema {
  protected tableName = 'topics'

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
      table.string('code', 60).notNullable().unique()
      table.smallint('grade').notNullable()
      table.string('phase', 1).notNullable()
      table.smallint('semester').notNullable()
      table.string('art_branch', 12).nullable()
      table.smallint('order_in_semester').notNullable()
      table.text('elements').notNullable()
      table.jsonb('element_codes').nullable()
      table.string('title', 255).notNullable()
      table.text('cp_summary').nullable()
      table.text('cp_text').nullable()
      table.string('atp_code', 40).notNullable()
      table.smallint('jp_total').notNullable()
      table.smallint('jp_per_week').notNullable()
      table.smallint('week_start').notNullable()
      table.smallint('week_end').notNullable()
      table.jsonb('weekly_distribution').notNullable()
      table.jsonb('references').notNullable()
      table.jsonb('curation_notes').nullable()
      table.jsonb('outside_cp').nullable()
      table.jsonb('extras').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['curriculum_version_id', 'subject_id', 'grade', 'semester'])
      table.check(`grade BETWEEN 1 AND 6`, [], 'topics_grade_check')
      table.check(`phase IN ('A', 'B', 'C')`, [], 'topics_phase_check')
      table.check(`semester IN (1, 2)`, [], 'topics_semester_check')
      table.check(
        `art_branch IN ('music', 'visual_art', 'dance', 'theatre')`,
        [],
        'topics_art_branch_check'
      )
      table.check(
        `jp_total >= 0 AND jp_per_week >= 0 AND week_start >= 1 AND week_end >= week_start`,
        [],
        'topics_ranges_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
