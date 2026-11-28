import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, staffPolicy } from '../../app/tenancy/rls.js'
import {
  LAYERS,
  LEVEL_SCOPES,
  LINES,
  PACKAGE_KINDS,
  PACKAGE_STATUSES,
} from '../../app/layers/types.js'

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ')

/**
 * The frame of the layer model (D-456, D-466,
 * docs/drafts/regional-layers.md §2.3):
 *
 * - `layer_domains`: the registry of layered domains and the table that
 *   holds each domain's items (the database guards read it).
 * - `layer_stamps`: one counter per (scope, domain), bumped by triggers
 *   in the same transaction as every change (§5.4). Scope keys:
 *   `national`, `region:<id>`, `school:<id>`, `choices:<school id>`.
 * - `layer_packages`: a versioned bundle of items one authority set for
 *   one area and domain. National and area packages are written only
 *   by Tim SIGRAK (`sigrak_staff`) and the owner; a school writes only
 *   its own `school` package. A school reads national packages and the
 *   packages of its own province, kabupaten/kota and kecamatan.
 *
 * Functions: `layer_region_chain(school)` (province, regency, district
 * ids), `app_region_chain()` for the tenant in context,
 * `layer_scope_key(...)`, `layer_bump_stamp(...)` (owner only).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('layer_domains', (table) => {
      table.string('domain', 40).primary()
      table.string('item_table', 63).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.raw(`
      ALTER TABLE layer_domains
        ADD CONSTRAINT layer_domains_domain_check CHECK (domain ~ '^[a-z][a-z0-9_]*$'),
        ADD CONSTRAINT layer_domains_item_table_check CHECK (item_table ~ '^[a-z][a-z0-9_]*$')
    `)

    this.schema.createTable('layer_stamps', (table) => {
      table.string('scope_key', 60).notNullable()
      table.string('domain', 40).notNullable()
      table.bigInteger('stamp').notNullable().defaultTo(0)
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.primary(['scope_key', 'domain'])
    })

    this.schema.createTable('layer_packages', (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique().defaultTo(this.raw('gen_random_uuid()'))
      table.string('code', 120).notNullable().unique()
      table
        .string('domain', 40)
        .notNullable()
        .references('domain')
        .inTable('layer_domains')
        .onDelete('RESTRICT')
      table.string('layer', 10).notNullable()
      table
        .bigInteger('region_id')
        .nullable()
        .references('id')
        .inTable('regions')
        .onDelete('RESTRICT')
      table
        .bigInteger('school_id')
        .nullable()
        .references('id')
        .inTable('schools')
        .onDelete('CASCADE')
      table.string('line', 16).notNullable().defaultTo('all')
      table.string('kind', 16).notNullable()
      table.string('level_scope', 4).notNullable().defaultTo('both')
      table.string('name', 200).notNullable()
      table.string('status', 10).notNullable().defaultTo('draft')
      table.string('applies_from_school_year', 9).notNullable()
      table.string('applies_to_school_year', 9).nullable()
      table.date('effective_on').nullable()
      table.integer('version').notNullable().defaultTo(1)
      table.string('rule_set_code', 120).nullable()
      table.jsonb('evidence').nullable()
      table
        .bigInteger('approved_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('approved_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['domain', 'layer', 'status'])
      table.index(['region_id', 'domain'])
      table.index(['school_id', 'domain'])
    })

    this.schema.raw(`
      ALTER TABLE layer_packages
        ADD CONSTRAINT layer_packages_layer_check CHECK (layer IN (${list(LAYERS)})),
        ADD CONSTRAINT layer_packages_line_check CHECK (line IN (${list(LINES)})),
        ADD CONSTRAINT layer_packages_kind_check CHECK (kind IN (${list(PACKAGE_KINDS)})),
        ADD CONSTRAINT layer_packages_level_scope_check CHECK (level_scope IN (${list(LEVEL_SCOPES)})),
        ADD CONSTRAINT layer_packages_status_check CHECK (status IN (${list(PACKAGE_STATUSES)})),
        ADD CONSTRAINT layer_packages_area_check CHECK (
          (layer = 'national' AND region_id IS NULL AND school_id IS NULL)
          OR (layer = 'school' AND school_id IS NOT NULL AND region_id IS NULL)
          OR (layer IN ('province', 'regency', 'district') AND region_id IS NOT NULL AND school_id IS NULL)),
        ADD CONSTRAINT layer_packages_kind_layer_check CHECK (
          (layer = 'national' AND kind = 'base')
          OR (layer = 'school' AND kind = 'school')
          OR (layer IN ('province', 'regency') AND kind IN ('official', 'local_agreement'))
          OR (layer = 'district' AND kind = 'local_agreement')),
        ADD CONSTRAINT layer_packages_evidence_check CHECK (
          kind NOT IN ('official', 'local_agreement') OR evidence IS NOT NULL),
        ADD CONSTRAINT layer_packages_school_year_check CHECK (
          applies_from_school_year ~ '^[0-9]{4}/[0-9]{4}$'
          AND (applies_to_school_year IS NULL OR (applies_to_school_year ~ '^[0-9]{4}/[0-9]{4}$'
               AND applies_to_school_year >= applies_from_school_year))),
        ADD CONSTRAINT layer_packages_version_check CHECK (version >= 1),
        ADD CONSTRAINT layer_packages_approved_check CHECK (
          status = 'draft' OR layer IN ('national', 'school') OR approved_at IS NOT NULL)
    `)
    // A school has one own package per domain and school year.
    this.schema.raw(`
      CREATE UNIQUE INDEX layer_packages_one_school_package
        ON layer_packages (school_id, domain, applies_from_school_year) WHERE layer = 'school'
    `)

    this.schema.raw(`
      CREATE FUNCTION layer_region_chain(p_school bigint) RETURNS bigint[]
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
        SELECT array_remove(ARRAY[r.parent_id, s.region_id, s.district_id], NULL)
          FROM schools s JOIN regions r ON r.id = s.region_id
         WHERE s.id = p_school
      $$
    `)
    this.schema.raw(`
      CREATE FUNCTION app_region_chain() RETURNS bigint[]
      LANGUAGE sql STABLE
      AS $$ SELECT coalesce(layer_region_chain(app_school_id()), '{}'::bigint[]) $$
    `)
    this.schema.raw(`
      CREATE FUNCTION layer_scope_key(p_layer text, p_region bigint, p_school bigint) RETURNS text
      LANGUAGE sql IMMUTABLE
      AS $$
        SELECT CASE
          WHEN p_layer = 'national' THEN 'national'
          WHEN p_layer = 'school' THEN 'school:' || p_school
          ELSE 'region:' || p_region END
      $$
    `)
    this.schema.raw(`
      CREATE FUNCTION layer_bump_stamp(p_scope text, p_domain text) RETURNS void
      LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
        INSERT INTO layer_stamps (scope_key, domain, stamp, updated_at)
        VALUES (p_scope, p_domain, 1, now())
        ON CONFLICT (scope_key, domain)
        DO UPDATE SET stamp = layer_stamps.stamp + 1, updated_at = now()
      $$
    `)
    this.schema.raw(`REVOKE EXECUTE ON FUNCTION layer_bump_stamp(text, text) FROM PUBLIC`)

    // Area of a package: the region's level matches the layer; the frame never moves;
    // one active official package per (domain, area, line) and overlapping school years.
    this.schema.raw(`
      CREATE FUNCTION layer_packages_guard() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        region_level text;
      BEGIN
        IF TG_OP = 'UPDATE' AND (NEW.domain, NEW.layer, NEW.region_id, NEW.school_id, NEW.line, NEW.kind)
            IS DISTINCT FROM (OLD.domain, OLD.layer, OLD.region_id, OLD.school_id, OLD.line, OLD.kind) THEN
          RAISE EXCEPTION 'layer_packages: domain, layer, area, line and kind never change'
            USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.region_id IS NOT NULL THEN
          SELECT level INTO region_level FROM regions WHERE id = NEW.region_id;
          IF region_level IS DISTINCT FROM NEW.layer THEN
            RAISE EXCEPTION 'layer_packages: a % package needs a % region, got %',
              NEW.layer, NEW.layer, region_level
              USING ERRCODE = 'check_violation';
          END IF;
        END IF;
        IF NEW.kind = 'official' AND NEW.status = 'active' AND EXISTS (
          SELECT 1 FROM layer_packages o
           WHERE o.id <> NEW.id AND o.kind = 'official' AND o.status = 'active'
             AND o.domain = NEW.domain AND o.region_id = NEW.region_id AND o.line = NEW.line
             AND left(o.applies_from_school_year, 4)::int
                 <= coalesce(left(NEW.applies_to_school_year, 4)::int, 9999)
             AND left(NEW.applies_from_school_year, 4)::int
                 <= coalesce(left(o.applies_to_school_year, 4)::int, 9999)) THEN
          RAISE EXCEPTION 'layer_packages: another active official package covers this area, line and school year'
            USING ERRCODE = 'unique_violation';
        END IF;
        RETURN NEW;
      END
      $$
    `)
    this.schema.raw(`
      CREATE TRIGGER layer_packages_guard BEFORE INSERT OR UPDATE ON layer_packages
        FOR EACH ROW EXECUTE FUNCTION layer_packages_guard()
    `)

    // Every change bumps the package's scope stamp. Migration …07 extends this function
    // (activation voids hides of mandatory items; retiring a local agreement ends its choices).
    this.schema.raw(`
      CREATE FUNCTION layer_packages_after() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        row layer_packages%ROWTYPE;
      BEGIN
        IF TG_OP = 'DELETE' THEN row := OLD; ELSE row := NEW; END IF;
        PERFORM layer_bump_stamp(layer_scope_key(row.layer, row.region_id, row.school_id), row.domain);
        RETURN NULL;
      END
      $$
    `)
    this.schema.raw(`
      CREATE TRIGGER layer_packages_after AFTER INSERT OR UPDATE OR DELETE ON layer_packages
        FOR EACH ROW EXECUTE FUNCTION layer_packages_after()
    `)

    this.schema.raw(`ALTER TABLE layer_packages ENABLE ROW LEVEL SECURITY`)
    this.schema.raw(`
      CREATE POLICY layer_packages_read ON layer_packages FOR SELECT TO sigrak_app
        USING (school_id = app_school_id()
               OR (school_id IS NULL AND (region_id IS NULL OR region_id = ANY (app_region_chain()))))
    `)
    this.schema.raw(`
      CREATE POLICY layer_packages_school ON layer_packages FOR ALL TO sigrak_app
        USING (school_id = app_school_id()) WITH CHECK (school_id = app_school_id())
    `)
    for (const sql of staffPolicy('layer_packages')) this.schema.raw(sql)

    // Registry and stamps: read by the app; written by the owner and the trigger functions.
    this.schema.raw(`REVOKE INSERT, UPDATE, DELETE ON layer_domains, layer_stamps FROM sigrak_app`)
  }

  async down() {
    this.schema.raw(`DROP POLICY IF EXISTS layer_packages_read ON layer_packages`)
    for (const sql of dropRls('layer_packages')) this.schema.raw(sql)
    this.schema.dropTable('layer_packages')
    this.schema.raw(`DROP FUNCTION IF EXISTS layer_packages_after()`)
    this.schema.raw(`DROP FUNCTION IF EXISTS layer_packages_guard()`)
    this.schema.raw(`DROP FUNCTION IF EXISTS layer_bump_stamp(text, text)`)
    this.schema.raw(`DROP FUNCTION IF EXISTS layer_scope_key(text, bigint, bigint)`)
    this.schema.raw(`DROP FUNCTION IF EXISTS app_region_chain()`)
    this.schema.raw(`DROP FUNCTION IF EXISTS layer_region_chain(bigint)`)
    this.schema.dropTable('layer_stamps')
    this.schema.dropTable('layer_domains')
  }
}
