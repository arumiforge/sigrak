import type { Knex } from 'knex'
import { childRls, dropRls } from '../../tenancy/rls.js'
import { FORCES, ITEM_SHAPES, ITEM_STATUSES, ORIGINS } from '../types.js'

/**
 * Helpers for a **layered table**: a domain table whose rows are items
 * of a layer package (docs/drafts/regional-layers.md §2.3, D-456). The
 * layer frame (layer, area, line, kind) lives on `layer_packages`; the
 * item row carries the shared column set below plus its own fields.
 *
 * In a migration:
 *
 * ```ts
 * this.schema.createTable('catalog_items', (table) => {
 *   layeredColumns(table)
 *   table.string('label', 160).notNullable()
 * })
 * for (const sql of layeredTableSql('catalog_items')) this.schema.raw(sql)
 * // and in down(): for (const sql of dropLayeredTableSql('catalog_items')) …
 * ```
 *
 * then register the domain in `layer_domains` (domain → table) and add
 * the table to `CHILD_TABLES` in the RLS coverage test.
 */
export function layeredColumns(table: Knex.CreateTableBuilder) {
  table.bigIncrements('id')
  table
    .bigInteger('package_id')
    .notNullable()
    .references('id')
    .inTable('layer_packages')
    .onDelete('CASCADE')
  table.string('item_key', 80).notNullable()
  table.string('shape', 8).notNullable().defaultTo('list')
  table.string('force', 20).notNullable().defaultTo('free')
  table.string('origin', 16).notNullable()
  table.string('group_key', 40).nullable()
  table.string('match_key', 160).notNullable()
  table.integer('revision').notNullable().defaultTo(1)
  table.bigInteger('supersedes_id').nullable()
  table.string('status', 10).notNullable().defaultTo('active')
  table.jsonb('source_ref').nullable()
  table.timestamp('created_at', { useTz: true }).notNullable()
  table.timestamp('updated_at', { useTz: true }).notNullable()
}

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ')

/**
 * Constraints, indexes, triggers and row-level security of a layered
 * table:
 *
 * - CHECKs on `shape`, `force`, `origin`, `status`; one live revision
 *   per (package, item key); `supersedes_id` points into the same table.
 * - `layer_items_guard` (BEFORE): the origin fits the package kind, and
 *   package and item key never change on an existing row.
 * - `layer_items_after` (AFTER): an item that becomes `mandatory` voids
 *   every lower hide of its key and queues notices (§3.4, §4 wall 2);
 *   every change bumps the package's layer stamp (§5.4).
 * - RLS through the package: a row is visible when its package is, and
 *   writable by a school only in its own school package.
 */
export function layeredTableSql(table: string): string[] {
  return [
    `ALTER TABLE ${table}
       ADD CONSTRAINT ${table}_shape_check CHECK (shape IN (${list(ITEM_SHAPES)})),
       ADD CONSTRAINT ${table}_force_check CHECK (force IN (${list(FORCES)})),
       ADD CONSTRAINT ${table}_origin_check CHECK (origin IN (${list(ORIGINS)})),
       ADD CONSTRAINT ${table}_status_check CHECK (status IN (${list(ITEM_STATUSES)})),
       ADD CONSTRAINT ${table}_revision_check CHECK (revision >= 1),
       ADD CONSTRAINT ${table}_item_key_check CHECK (item_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$'),
       ADD CONSTRAINT ${table}_supersedes_fk FOREIGN KEY (supersedes_id)
         REFERENCES ${table} (id) ON DELETE SET NULL`,
    `CREATE UNIQUE INDEX ${table}_live_key ON ${table} (package_id, item_key) WHERE status <> 'retired'`,
    `CREATE INDEX ${table}_package_status ON ${table} (package_id, status)`,
    `CREATE INDEX ${table}_item_key ON ${table} (item_key)`,
    `CREATE TRIGGER ${table}_layer_guard BEFORE INSERT OR UPDATE ON ${table}
       FOR EACH ROW EXECUTE FUNCTION layer_items_guard()`,
    `CREATE TRIGGER ${table}_layer_after AFTER INSERT OR UPDATE OR DELETE ON ${table}
       FOR EACH ROW EXECUTE FUNCTION layer_items_after()`,
    ...childRls(table, {
      table: 'layer_packages',
      foreignKey: 'package_id',
      writableWhen: 'p.school_id = app_school_id()',
    }),
  ]
}

export function dropLayeredTableSql(table: string): string[] {
  return [
    ...dropRls(table),
    `DROP TRIGGER IF EXISTS ${table}_layer_after ON ${table}`,
    `DROP TRIGGER IF EXISTS ${table}_layer_guard ON ${table}`,
  ]
}
