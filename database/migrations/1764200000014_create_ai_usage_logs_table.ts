import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per AI attempt (ai-provider-engine.md, Usage logs).
 * Append-only; no key and no prompt or response text. `outcome` is
 * `success`, an error class, or `unknown` for an attempt cut off by a
 * worker crash.
 */
export default class extends BaseSchema {
  protected tableName = 'ai_usage_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .bigInteger('school_id')
        .nullable()
        .references('id')
        .inTable('schools')
        .onDelete('SET NULL')
      table
        .bigInteger('ai_credential_id')
        .nullable()
        .references('id')
        .inTable('ai_credentials')
        .onDelete('SET NULL')
      table
        .bigInteger('generation_id')
        .nullable()
        .references('id')
        .inTable('generations')
        .onDelete('SET NULL')
        .index()
      table.string('step_key', 40).nullable()
      table.smallint('attempt').notNullable()
      table.string('purpose', 40).notNullable()
      table.string('model', 80).notNullable()
      table.string('outcome', 30).notNullable()
      table.smallint('http_status').nullable()
      table.integer('input_tokens').notNullable().defaultTo(0)
      table.integer('output_tokens').notNullable().defaultTo(0)
      table.integer('latency_ms').notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['user_id', 'created_at'])
      table.index(['school_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
