import { BaseSchema } from '@adonisjs/lucid/schema'
import { FORCES, LINES } from '../../app/layers/types.js'

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ')

/**
 * Minimum-offer rules over several items of one domain
 * (docs/drafts/regional-layers.md §2.3, §4): at least `min` visible
 * items with `group_key` per school; when hides from several layers
 * break it, the resolver brings back `default_item_key`. The first row
 * is the kepanduan group (`scouting`, min 1, default Pramuka,
 * Permendikdasmen 13/2025 Pasal 22 ayat (2), D-452). It replaces
 * `offer_groups` of the catalog file. National reference data: the app
 * only reads it.
 */
export default class extends BaseSchema {
  protected tableName = 'layer_group_rules'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table
        .string('domain', 40)
        .notNullable()
        .references('domain')
        .inTable('layer_domains')
        .onDelete('CASCADE')
      table.string('group_key', 40).notNullable()
      table.string('label', 160).notNullable()
      table.integer('min').notNullable()
      table.string('default_item_key', 80).notNullable()
      table.string('line', 16).notNullable().defaultTo('all')
      table.string('force', 20).notNullable().defaultTo('mandatory')
      table.jsonb('source_ref').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['domain', 'group_key', 'line'])
    })
    this.schema.raw(`
      ALTER TABLE layer_group_rules
        ADD CONSTRAINT layer_group_rules_min_check CHECK (min >= 1),
        ADD CONSTRAINT layer_group_rules_line_check CHECK (line IN (${list(LINES)})),
        ADD CONSTRAINT layer_group_rules_force_check CHECK (force IN (${list(FORCES)}))
    `)
    this.schema.raw(`REVOKE INSERT, UPDATE, DELETE ON layer_group_rules FROM sigrak_app`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
