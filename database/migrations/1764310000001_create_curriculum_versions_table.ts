import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per curriculum data set: official structure (JP allocation),
 * official CP, or SIGRAK topics (data model: Curriculum; D-355, D-363).
 * `effective_on`, `applies_from_school_year` and `supersedes_id` are
 * copied from the Profil Jenjang files by `curriculum:import` (D-378);
 * NULL means no profile lists the version yet. `meta.files` keeps one
 * entry per source file (sha256, source, subjects' curation, D-364).
 */
export default class extends BaseSchema {
  protected tableName = 'curriculum_versions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.string('code', 60).notNullable().unique()
      table.string('kind', 10).notNullable()
      table.text('name').notNullable()
      table.string('status', 10).notNullable().defaultTo('draft')
      table.date('effective_on').nullable()
      table.string('applies_from_school_year', 9).nullable()
      table
        .bigInteger('supersedes_id')
        .nullable()
        .references('id')
        .inTable('curriculum_versions')
        .onDelete('SET NULL')
        .index()
      table.jsonb('meta').notNullable().defaultTo('{}')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.check(`kind IN ('structure', 'cp', 'topics')`, [], 'curriculum_versions_kind_check')
      table.check(
        `status IN ('draft', 'active', 'retired')`,
        [],
        'curriculum_versions_status_check'
      )
      table.check(
        `applies_from_school_year ~ '^[0-9]{4}/[0-9]{4}$'`,
        [],
        'curriculum_versions_school_year_check'
      )
      table.check(`supersedes_id <> id`, [], 'curriculum_versions_supersedes_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
