import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Regions hold the province and regency defaults for the calendar
 * (data model: Accounts and schools). A row with only a province owns
 * the province reference calendar.
 */
export default class extends BaseSchema {
  protected tableName = 'regions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.string('province', 100).notNullable()
      table.string('regency', 100).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.raw(
      `ALTER TABLE regions ADD COLUMN regency_key varchar(100) GENERATED ALWAYS AS (coalesce(regency, '')) STORED NOT NULL`
    )
    this.schema.raw(
      `ALTER TABLE regions ADD CONSTRAINT regions_province_regency_key_unique UNIQUE (province, regency_key)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
