import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Integration settings set in the console (D-431, Fondasi F-005) and
 * the AI model per purpose (D-315). Both belong to Tim SIGRAK, not to a
 * school, so there is no school_id and no RLS.
 *
 * - `integration_settings`: one row per integration (`mail`,
 *   `chatbot`, `storage`, `ai_team_key`). `payload` is the whole value
 *   object encrypted with the app key (app/integrations/store.ts types
 *   each one); the console shows secrets only by their last four
 *   characters.
 * - `ai_purpose_models`: the active model and the ordered fallbacks of
 *   one purpose (`models[1]` is the active one). A purpose without a
 *   row uses its starting value in config/ai.ts.
 *
 * Every change is logged in `staff_activity_logs` (subject types
 * `integration` and `ai_model`, added in R2-01).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('integration_settings', (table) => {
      table.bigIncrements('id')
      table.string('key', 40).notNullable().unique()
      table.text('payload').notNullable()
      table
        .bigInteger('updated_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable('ai_purpose_models', (table) => {
      table.bigIncrements('id')
      table.string('purpose', 40).notNullable().unique()
      table.specificType('models', 'text[]').notNullable()
      table
        .bigInteger('updated_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.check('cardinality(models) BETWEEN 1 AND 5', [], 'ai_purpose_models_models_count_check')
    })
  }

  async down() {
    this.schema.dropTable('ai_purpose_models')
    this.schema.dropTable('integration_settings')
  }
}
