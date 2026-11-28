import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Tujuan pembelajaran (TP) of a topic (data model: Curriculum).
 */
export default class extends BaseSchema {
  protected tableName = 'learning_objectives'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('topic_id')
        .notNullable()
        .references('id')
        .inTable('topics')
        .onDelete('CASCADE')
        .index()
      table.string('code', 70).notNullable().unique()
      table.smallint('order').notNullable()
      table.text('text').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
