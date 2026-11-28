import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The NPSN school directory (D-169, D-170): SD and MI from the
 * Kemendikdasmen reference site, loaded from docs/data/schools/*.json
 * by `node ace school-directory:import`. Reference data, not tenants:
 * a directory row becomes a school only when staff create it. The text
 * names are kept as fetched; `region_id` and `district_id` are the
 * matching rows of the region tree (NULL when no match).
 */
export default class extends BaseSchema {
  protected tableName = 'school_directory_entries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.string('npsn', 8).notNullable().unique()
      table.string('name', 150).notNullable()
      table.string('level', 2).notNullable()
      table.text('address').notNullable()
      table.string('village', 100).nullable()
      table.string('district_name', 100).notNullable()
      table.string('regency_name', 100).notNullable()
      table.string('province_name', 100).notNullable()
      table
        .bigInteger('region_id')
        .nullable()
        .references('id')
        .inTable('regions')
        .onDelete('RESTRICT')
        .index()
      table
        .bigInteger('district_id')
        .nullable()
        .references('id')
        .inTable('regions')
        .onDelete('RESTRICT')
        .index()
      table.double('latitude').nullable()
      table.double('longitude').nullable()
      table.string('source_url', 255).notNullable().index()
      table.date('fetched_on').notNullable()
      // Set when a later fetch of the same source no longer lists the school.
      table.timestamp('removed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.check(`npsn ~ '^[0-9]{8}$'`, [], 'school_directory_entries_npsn_check')
      table.check(`level IN ('sd', 'mi')`, [], 'school_directory_entries_level_check')
      table.check(
        `(latitude IS NULL) = (longitude IS NULL)`,
        [],
        'school_directory_entries_coordinates_check'
      )
    })

    // Written only by the import command (the owner); the app reads it.
    this.schema.raw(`REVOKE INSERT, UPDATE, DELETE ON school_directory_entries FROM sigrak_app`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
