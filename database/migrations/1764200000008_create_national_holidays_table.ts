import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * National holidays and joint leave from the SKB, one central read-only
 * table merged into every calendar view (D-253, D-254).
 */
export default class extends BaseSchema {
  protected tableName = 'national_holidays'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.date('date').notNullable()
      table.string('name', 150).notNullable()
      table.string('kind', 20).notNullable()
      table.string('decree', 100).notNullable()
      table.string('academic_year', 9).notNullable()
      table.boolean('is_provisional').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['date', 'name'])
      table.index(['academic_year'])
      table.check(`kind IN ('national_holiday', 'joint_leave')`, [], 'national_holidays_kind_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
