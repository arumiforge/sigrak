import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, staffPolicy } from '../../app/tenancy/rls.js'
import { HIDE_STATUSES, VOID_REASONS } from '../../app/layers/types.js'

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ')

/**
 * "Not used" marks, the only other kind of difference a lower layer
 * stores (docs/drafts/regional-layers.md §2.3, §3.1). A hide targets an
 * item key, not a revision, so new revisions stay hidden. Un-hiding
 * voids the row (`unhidden`) instead of deleting it, so the history
 * stays.
 *
 * Database wall (§4, wall 2): `layer_hides_guard` refuses an active
 * hide whose target is a `mandatory` item of the same or a higher
 * layer, copies `school_id` and `domain` from the package (so the
 * school policy holds), and keeps package and target fixed. Every
 * change bumps the hiding package's stamp.
 *
 * `school_id` is set for hides of a school package (school-owned, RLS);
 * area hides have none and are readable where their package is.
 */
export default class extends BaseSchema {
  protected tableName = 'layer_hides'

  async up() {
    this.schema.raw(`
      CREATE FUNCTION layer_rank(p_layer text) RETURNS int
      LANGUAGE sql IMMUTABLE PARALLEL SAFE
      AS $$ SELECT array_position(ARRAY['national', 'province', 'regency', 'district', 'school'], p_layer) - 1 $$
    `)
    // True when an active item with this key is mandatory in an active package of the
    // domain at or above the given layer rank. Reads the domain's table from layer_domains.
    this.schema.raw(`
      CREATE FUNCTION layer_item_is_mandatory(p_domain text, p_item_key text, p_max_rank int)
      RETURNS boolean
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        item_table text;
        found boolean;
      BEGIN
        SELECT d.item_table INTO item_table FROM layer_domains d WHERE d.domain = p_domain;
        IF item_table IS NULL THEN
          RETURN false;
        END IF;
        EXECUTE format(
          'SELECT EXISTS (SELECT 1 FROM %I i JOIN layer_packages p ON p.id = i.package_id
             WHERE p.domain = $1 AND p.status = ''active'' AND i.item_key = $2
               AND i.status = ''active'' AND i.force = ''mandatory''
               AND layer_rank(p.layer) <= $3)', item_table)
          INTO found USING p_domain, p_item_key, p_max_rank;
        RETURN found;
      END
      $$
    `)

    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('package_id')
        .notNullable()
        .references('id')
        .inTable('layer_packages')
        .onDelete('CASCADE')
      table
        .bigInteger('school_id')
        .nullable()
        .references('id')
        .inTable('schools')
        .onDelete('CASCADE')
        .index()
      table.string('domain', 40).notNullable()
      table.string('target_item_key', 80).notNullable()
      table.text('reason').nullable()
      table.string('status', 8).notNullable().defaultTo('active')
      table.string('void_reason', 20).nullable()
      table
        .bigInteger('created_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .bigInteger('created_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['package_id', 'target_item_key'])
      table.index(['domain', 'target_item_key', 'status'])
    })
    this.schema.raw(`
      ALTER TABLE layer_hides
        ADD CONSTRAINT layer_hides_status_check CHECK (status IN (${list(HIDE_STATUSES)})),
        ADD CONSTRAINT layer_hides_void_reason_check CHECK (
          void_reason IS NULL OR void_reason IN (${list(VOID_REASONS)})),
        ADD CONSTRAINT layer_hides_void_check CHECK ((status = 'void') = (void_reason IS NOT NULL))
    `)

    this.schema.raw(`
      CREATE FUNCTION layer_hides_guard() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        pkg layer_packages%ROWTYPE;
      BEGIN
        IF TG_OP = 'UPDATE' AND (NEW.package_id, NEW.target_item_key)
            IS DISTINCT FROM (OLD.package_id, OLD.target_item_key) THEN
          RAISE EXCEPTION 'layer_hides: package and target never change'
            USING ERRCODE = 'check_violation';
        END IF;
        SELECT * INTO pkg FROM layer_packages WHERE id = NEW.package_id;
        NEW.school_id := pkg.school_id;
        NEW.domain := pkg.domain;
        IF NEW.status = 'active' THEN
          NEW.void_reason := NULL;
          IF layer_item_is_mandatory(pkg.domain, NEW.target_item_key, layer_rank(pkg.layer)) THEN
            RAISE EXCEPTION 'layer_hides: % is mandatory and cannot be hidden', NEW.target_item_key
              USING ERRCODE = 'check_violation', HINT = 'layer_hide_on_mandatory';
          END IF;
        END IF;
        RETURN NEW;
      END
      $$
    `)
    this.schema.raw(`
      CREATE TRIGGER layer_hides_guard BEFORE INSERT OR UPDATE ON layer_hides
        FOR EACH ROW EXECUTE FUNCTION layer_hides_guard()
    `)
    this.schema.raw(`
      CREATE FUNCTION layer_hides_after() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        pkg layer_packages%ROWTYPE;
      BEGIN
        SELECT * INTO pkg FROM layer_packages
         WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.package_id ELSE NEW.package_id END;
        IF FOUND THEN
          PERFORM layer_bump_stamp(layer_scope_key(pkg.layer, pkg.region_id, pkg.school_id), pkg.domain);
        END IF;
        RETURN NULL;
      END
      $$
    `)
    this.schema.raw(`
      CREATE TRIGGER layer_hides_after AFTER INSERT OR UPDATE OR DELETE ON layer_hides
        FOR EACH ROW EXECUTE FUNCTION layer_hides_after()
    `)

    this.schema.raw(`ALTER TABLE layer_hides ENABLE ROW LEVEL SECURITY`)
    this.schema.raw(`
      CREATE POLICY layer_hides_read ON layer_hides FOR SELECT TO sigrak_app
        USING (school_id = app_school_id()
               OR (school_id IS NULL
                   AND EXISTS (SELECT 1 FROM layer_packages p WHERE p.id = layer_hides.package_id)))
    `)
    this.schema.raw(`
      CREATE POLICY layer_hides_school ON layer_hides FOR ALL TO sigrak_app
        USING (school_id = app_school_id()) WITH CHECK (school_id = app_school_id())
    `)
    for (const sql of staffPolicy(this.tableName)) this.schema.raw(sql)
  }

  async down() {
    this.schema.raw(`DROP POLICY IF EXISTS layer_hides_read ON layer_hides`)
    for (const sql of dropRls(this.tableName)) this.schema.raw(sql)
    this.schema.dropTable(this.tableName)
    this.schema.raw(`DROP FUNCTION IF EXISTS layer_hides_after()`)
    this.schema.raw(`DROP FUNCTION IF EXISTS layer_hides_guard()`)
    this.schema.raw(`DROP FUNCTION IF EXISTS layer_item_is_mandatory(text, text, int)`)
    this.schema.raw(`DROP FUNCTION IF EXISTS layer_rank(text)`)
  }
}
