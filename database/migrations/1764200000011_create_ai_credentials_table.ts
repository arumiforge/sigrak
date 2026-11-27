import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Teachers' Gemini keys (data model: AI layer; ai-provider-engine.md,
 * Keys). Spike subset from R0-06: enough for key selection, failover
 * and the circuit breaker. Keys belong to the teacher, never to a
 * school (D-012), so there is no school_id. The secret is encrypted
 * with the app key and never leaves the server.
 */
export default class extends BaseSchema {
  protected tableName = 'ai_credentials'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique()
      table
        .bigInteger('user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .index()
      table.string('label', 60).notNullable()
      table.string('project_label', 100).notNullable()
      table.string('account_label', 150).nullable()
      table.text('secret').notNullable()
      table.string('secret_last4', 4).notNullable()
      table.string('secret_fingerprint', 64).notNullable()
      table.string('status', 10).notNullable().defaultTo('active')
      table.boolean('is_backup').notNullable().defaultTo(false)
      table.string('invalid_reason', 40).nullable()
      table.integer('consecutive_failures').notNullable().defaultTo(0)
      table.timestamp('circuit_open_until', { useTz: true }).nullable()
      table.timestamp('last_success_at', { useTz: true }).nullable()
      table.timestamp('last_tested_at', { useTz: true }).nullable()
      table.timestamp('multi_key_consent_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['user_id', 'secret_fingerprint'])
      table.check(`status IN ('active', 'invalid', 'disabled')`, [], 'ai_credentials_status_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
