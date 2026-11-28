import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, schoolRls } from '../../app/tenancy/rls.js'
import { NOTICE_AUDIENCES, NOTICE_KINDS } from '../../app/layers/types.js'

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ')

/**
 * Notices for a school's operator and principal about layer changes
 * (docs/drafts/regional-layers.md §6.3, D-466): a hidden item that
 * became mandatory, a region change that ended local agreements, a
 * local agreement chosen or left (the principal is told), a retired
 * package, a decided proposal. Written by the app and by the layer
 * trigger functions; shown on the school's pages until marked read.
 * The in-app inbox, Web Push (D-397) and Kabar come later and read
 * this table.
 */
export default class extends BaseSchema {
  protected tableName = 'layer_notices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique().defaultTo(this.raw('gen_random_uuid()'))
      table
        .bigInteger('school_id')
        .notNullable()
        .references('id')
        .inTable('schools')
        .onDelete('CASCADE')
      table.string('kind', 24).notNullable()
      table.string('audience', 10).notNullable().defaultTo('all')
      table.jsonb('payload').notNullable().defaultTo('{}')
      table.timestamp('read_at', { useTz: true }).nullable()
      table
        .bigInteger('read_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['school_id', 'read_at'])
    })
    this.schema.raw(`
      ALTER TABLE layer_notices
        ADD CONSTRAINT layer_notices_kind_check CHECK (kind IN (${list(NOTICE_KINDS)})),
        ADD CONSTRAINT layer_notices_audience_check CHECK (audience IN (${list(NOTICE_AUDIENCES)}))
    `)
    for (const sql of schoolRls(this.tableName)) this.schema.raw(sql)
  }

  async down() {
    for (const sql of dropRls(this.tableName)) this.schema.raw(sql)
    this.schema.dropTable(this.tableName)
  }
}
