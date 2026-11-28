import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fokus materi of a topic (data model: Curriculum). `allocation_status`
 * is free text in the data ("sesuai", or a sentence).
 */
export default class extends BaseSchema {
  protected tableName = 'focus_items'

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
      table.string('title', 255).notNullable()
      table.smallint('estimated_jp').notNullable()
      table.string('allocation_status', 255).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.check(`estimated_jp >= 0`, [], 'focus_items_estimated_jp_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
