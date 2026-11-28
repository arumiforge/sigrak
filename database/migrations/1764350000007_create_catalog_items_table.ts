import { BaseSchema } from '@adonisjs/lucid/schema'
import {
  dropLayeredTableSql,
  layeredColumns,
  layeredTableSql,
} from '../../app/layers/database/layered_table.js'

/**
 * The item functions every layered table uses, and the first layered
 * table: `catalog_items` (docs/drafts/regional-layers.md §5.6), here for
 * the `extracurricular` domain (R1-07 proof domain). Kokurikuler themes
 * join it later as `cocurricular_theme`.
 *
 * - `layer_items_guard()`: an item's origin fits its package kind
 *   (`base` → official or sigrak, `official` → official,
 *   `local_agreement` → local_agreement, `school` → school); package and
 *   item key never change.
 * - `layer_void_hides(package, key)`: voids every hide of `key` below the
 *   package's area (`became_mandatory`) and queues a notice for each
 *   school it touches (§3.4).
 * - `layer_items_after()`: bumps the stamp; an item that becomes
 *   mandatory in an active package voids hides. Activating a package
 *   does the same for its mandatory items (layer_packages_after).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE FUNCTION layer_items_guard() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        pkg_kind text;
      BEGIN
        IF TG_OP = 'UPDATE' AND (NEW.package_id, NEW.item_key)
            IS DISTINCT FROM (OLD.package_id, OLD.item_key) THEN
          RAISE EXCEPTION '%: package and item key never change', TG_TABLE_NAME
            USING ERRCODE = 'check_violation';
        END IF;
        SELECT kind INTO pkg_kind FROM layer_packages WHERE id = NEW.package_id;
        IF NOT ((pkg_kind = 'base' AND NEW.origin IN ('official', 'sigrak'))
             OR (pkg_kind = 'official' AND NEW.origin = 'official')
             OR (pkg_kind = 'local_agreement' AND NEW.origin = 'local_agreement')
             OR (pkg_kind = 'school' AND NEW.origin = 'school')) THEN
          RAISE EXCEPTION '%: origin % does not fit a % package', TG_TABLE_NAME, NEW.origin, pkg_kind
            USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END
      $$
    `)

    this.schema.raw(`
      CREATE FUNCTION layer_void_hides(p_package bigint, p_item_key text) RETURNS void
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        pkg layer_packages%ROWTYPE;
      BEGIN
        SELECT * INTO pkg FROM layer_packages WHERE id = p_package;
        IF NOT FOUND THEN
          RETURN;
        END IF;
        WITH voided AS (
          UPDATE layer_hides h
             SET status = 'void', void_reason = 'became_mandatory', updated_at = now()
            FROM layer_packages hp
           WHERE hp.id = h.package_id AND hp.id <> pkg.id
             AND h.domain = pkg.domain AND h.target_item_key = p_item_key AND h.status = 'active'
             AND layer_rank(hp.layer) >= layer_rank(pkg.layer)
             AND (pkg.layer = 'national'
                  OR (hp.school_id IS NOT NULL
                      AND pkg.region_id = ANY (coalesce(layer_region_chain(hp.school_id), '{}'::bigint[])))
                  OR hp.region_id = pkg.region_id
                  OR EXISTS (SELECT 1 FROM regions c
                              WHERE c.id = hp.region_id
                                AND (c.parent_id = pkg.region_id
                                     OR c.parent_id IN (SELECT id FROM regions WHERE parent_id = pkg.region_id))))
          RETURNING hp.school_id, hp.region_id),
        affected AS (
          SELECT v.school_id FROM voided v WHERE v.school_id IS NOT NULL
          UNION
          SELECT s.id FROM voided v
            JOIN schools s ON v.region_id IS NOT NULL
            JOIN regions r ON r.id = s.region_id
           WHERE v.region_id IN (r.parent_id, s.region_id, s.district_id))
        INSERT INTO layer_notices (school_id, kind, audience, payload, created_at)
        SELECT a.school_id, 'became_mandatory', 'all',
               jsonb_build_object('domain', pkg.domain, 'item_key', p_item_key,
                                  'package_code', pkg.code, 'package_name', pkg.name,
                                  'layer', pkg.layer),
               now()
          FROM affected a;
      END
      $$
    `)
    this.schema.raw(`REVOKE EXECUTE ON FUNCTION layer_void_hides(bigint, text) FROM PUBLIC`)

    this.schema.raw(`
      CREATE FUNCTION layer_items_after() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        pkg layer_packages%ROWTYPE;
      BEGIN
        SELECT * INTO pkg FROM layer_packages
         WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.package_id ELSE NEW.package_id END;
        IF NOT FOUND THEN
          RETURN NULL;
        END IF;
        PERFORM layer_bump_stamp(layer_scope_key(pkg.layer, pkg.region_id, pkg.school_id), pkg.domain);
        IF TG_OP <> 'DELETE' AND pkg.status = 'active'
           AND NEW.force = 'mandatory' AND NEW.status = 'active'
           AND (TG_OP = 'INSERT' OR OLD.force <> 'mandatory' OR OLD.status <> 'active') THEN
          PERFORM layer_void_hides(pkg.id, NEW.item_key);
        END IF;
        RETURN NULL;
      END
      $$
    `)

    // Activating a package voids lower hides of its mandatory items.
    this.schema.raw(`
      CREATE OR REPLACE FUNCTION layer_packages_after() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        row layer_packages%ROWTYPE;
        item_table text;
        key text;
      BEGIN
        IF TG_OP = 'DELETE' THEN row := OLD; ELSE row := NEW; END IF;
        PERFORM layer_bump_stamp(layer_scope_key(row.layer, row.region_id, row.school_id), row.domain);
        IF TG_OP = 'UPDATE' AND NEW.status = 'active' AND OLD.status <> 'active' THEN
          SELECT d.item_table INTO item_table FROM layer_domains d WHERE d.domain = NEW.domain;
          FOR key IN EXECUTE format(
            'SELECT item_key FROM %I WHERE package_id = $1 AND status = ''active'' AND force = ''mandatory''',
            item_table) USING NEW.id
          LOOP
            PERFORM layer_void_hides(NEW.id, key);
          END LOOP;
        END IF;
        IF TG_OP = 'UPDATE' AND NEW.status = 'retired' AND OLD.status <> 'retired'
           AND NEW.kind = 'local_agreement' THEN
          WITH ended AS (
            UPDATE school_package_choices
               SET status = 'ended', ended_at = now(),
                   ends_on = greatest(starts_on, (now() AT TIME ZONE 'Asia/Jakarta')::date),
                   end_reason = 'package_retired', updated_at = now()
             WHERE package_id = NEW.id AND status = 'active'
            RETURNING school_id)
          INSERT INTO layer_notices (school_id, kind, audience, payload, created_at)
          SELECT DISTINCT school_id, 'package_retired', 'all',
                 jsonb_build_object('domain', NEW.domain, 'package_code', NEW.code,
                                    'package_name', NEW.name),
                 now()
            FROM ended;
        END IF;
        RETURN NULL;
      END
      $$
    `)

    this.schema.createTable('catalog_items', (table) => {
      layeredColumns(table)
      table.string('label', 160).notNullable()
      table.string('category', 40).nullable()
      table.string('catalog_key', 60).nullable()
      table.text('description').nullable()
      table.boolean('offered_by_default').notNullable().defaultTo(false)
      table.integer('sort_order').notNullable().defaultTo(0)
    })
    for (const sql of layeredTableSql('catalog_items')) this.schema.raw(sql)

    this.schema.raw(`
      INSERT INTO layer_domains (domain, item_table, created_at)
      VALUES ('extracurricular', 'catalog_items', now())
    `)
  }

  async down() {
    this.schema.raw(`DELETE FROM layer_domains WHERE item_table = 'catalog_items'`)
    for (const sql of dropLayeredTableSql('catalog_items')) this.schema.raw(sql)
    this.schema.dropTable('catalog_items')
    this.schema.raw(`DROP FUNCTION IF EXISTS layer_items_after()`)
    this.schema.raw(`DROP FUNCTION IF EXISTS layer_void_hides(bigint, text)`)
    this.schema.raw(`DROP FUNCTION IF EXISTS layer_items_guard()`)
  }
}
