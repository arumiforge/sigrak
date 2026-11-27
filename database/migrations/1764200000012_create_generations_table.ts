import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One run of a template for one teacher (data model: Content;
 * content-engine.md). Spike subset from R0-06: `template_key` and
 * `template_version` have no foreign key until template_versions
 * exists. Two columns beyond the data model: `runs` (the run number,
 * raised by "Coba lagi", part of the queue job id so a stale job of an
 * earlier run does nothing) and `error_meta` (values for the failure
 * message, such as when the earliest key is usable again).
 */
export default class extends BaseSchema {
  protected tableName = 'generations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique()
      table
        .bigInteger('school_id')
        .nullable()
        .references('id')
        .inTable('schools')
        .onDelete('CASCADE')
      table
        .bigInteger('user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('template_key', 40).notNullable()
      table.integer('template_version').notNullable()
      table.string('kind', 20).notNullable().defaultTo('create')
      table.uuid('client_token').notNullable()
      table.jsonb('specification').notNullable()
      table.string('status', 10).notNullable().defaultTo('queued')
      table.integer('runs').notNullable().defaultTo(1)
      table
        .bigInteger('pinned_credential_id')
        .nullable()
        .references('id')
        .inTable('ai_credentials')
        .onDelete('SET NULL')
      table.string('error_class', 30).nullable()
      table.jsonb('error_meta').nullable()
      table.timestamp('started_at', { useTz: true }).nullable()
      table.timestamp('finished_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // A double submit of the same form creates one generation.
      table.unique(['user_id', 'client_token'])
      table.index(['user_id', 'status'])
      table.check(
        `status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')`,
        [],
        'generations_status_check'
      )
      table.check(`kind IN ('create', 'section_revision')`, [], 'generations_kind_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
