import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Official CP text per CP version, subject, phase and element (D-226,
 * D-452). `element` NULL is the phase summary (order 0). Sub-elements
 * printed with no CP in a phase get no row. `element_code` links a row
 * to `learning_outcome_elements` where the data names one.
 */
export default class extends BaseSchema {
  protected tableName = 'learning_outcomes'

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
      table.string('art_branch', 12).nullable()
      table.string('phase', 1).notNullable()
      table.string('code', 80).notNullable().unique()
      table.smallint('order').notNullable()
      table.string('element_code', 20).nullable()
      table.string('element', 150).nullable()
      table.string('sub_element', 150).nullable()
      table.text('text').notNullable()
      table.jsonb('extras').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['curriculum_version_id', 'subject_id', 'phase'])
      table.check(`phase IN ('A', 'B', 'C')`, [], 'learning_outcomes_phase_check')
      table.check(
        `art_branch IN ('music', 'visual_art', 'dance', 'theatre')`,
        [],
        'learning_outcomes_art_branch_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
