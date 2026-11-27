import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One school, one tenant (data model: Accounts and schools).
 */
export default class extends BaseSchema {
  protected tableName = 'schools'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.string('name', 150).notNullable()
      // Nullable until verified against the NPSN directory.
      table.string('npsn', 8).nullable().unique()
      table.string('level', 2).notNullable()
      table
        .bigInteger('region_id')
        .notNullable()
        .references('id')
        .inTable('regions')
        .onDelete('RESTRICT')
        .index()
      table.string('district', 100).notNullable()
      table.text('address').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.check(`level IN ('sd', 'mi')`, [], 'schools_level_check')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
