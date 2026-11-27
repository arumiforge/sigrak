import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Steps of a generation. A step's output is accepted exactly once: it
 * moves running → succeeded by compare-and-set, so a late duplicate
 * call cannot overwrite it (ai-provider-engine.md, rule 4).
 */
export default class extends BaseSchema {
  protected tableName = 'generation_steps'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('generation_id')
        .notNullable()
        .references('id')
        .inTable('generations')
        .onDelete('CASCADE')
      table.string('step_key', 40).notNullable()
      table.smallint('position').notNullable()
      table.string('status', 10).notNullable().defaultTo('pending')
      table.integer('attempts').notNullable().defaultTo(0)
      table.jsonb('output').nullable()
      table.timestamp('started_at', { useTz: true }).nullable()
      table.timestamp('finished_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['generation_id', 'step_key'])
      table.unique(['generation_id', 'position'])
      table.check(
        `status IN ('pending', 'running', 'succeeded', 'failed')`,
        [],
        'generation_steps_status_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
