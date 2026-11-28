import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Links between a fokus and the TP it serves (`focus_items[].objective_codes`).
 * The import syncs a fokus's links only when the file has them.
 */
export default class extends BaseSchema {
  protected tableName = 'focus_item_objectives'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .bigInteger('focus_item_id')
        .notNullable()
        .references('id')
        .inTable('focus_items')
        .onDelete('CASCADE')
      table
        .bigInteger('learning_objective_id')
        .notNullable()
        .references('id')
        .inTable('learning_objectives')
        .onDelete('CASCADE')
        .index()
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.primary(['focus_item_id', 'learning_objective_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
