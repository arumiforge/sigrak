import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Official CP elements per CP version and subject (D-452): `PP-E1`,
 * `SB-MUS-E3`, and PAI's `PAI-E1`…`PAI-E5`, whose text lives in the
 * religion CP set (`linked_version_code`). Topics name the elements
 * they cover in `topics.element_codes`.
 */
export default class extends BaseSchema {
  protected tableName = 'learning_outcome_elements'

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
      table.string('code', 20).notNullable()
      table.smallint('order').notNullable()
      table.string('name', 150).notNullable()
      table.string('name_en', 150).nullable()
      table.jsonb('phases').notNullable()
      table.string('linked_version_code', 60).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['curriculum_version_id', 'code'])
      table.check(
        `art_branch IN ('music', 'visual_art', 'dance', 'theatre')`,
        [],
        'learning_outcome_elements_art_branch_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
