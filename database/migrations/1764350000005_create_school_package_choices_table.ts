import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, schoolRls } from '../../app/tenancy/rls.js'
import { CHOICE_END_REASONS, CHOICE_STATUSES } from '../../app/layers/types.js'

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ')

/**
 * A school's choice to follow a local agreement for one school year
 * (docs/drafts/regional-layers.md §2.3, §7; D-466: the operator chooses,
 * the principal is told). It applies from `starts_on` until `ends_on`
 * (exclusive). Ended by the operator (`operator_left`), by retiring the
 * package (`package_retired`) or by a region change (`region_changed`).
 *
 * `school_package_choices_guard` allows only an active local agreement
 * of the school's own province, kabupaten/kota or kecamatan whose school
 * years cover the choice. Every change bumps `choices:<school id>`.
 */
export default class extends BaseSchema {
  protected tableName = 'school_package_choices'

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
      table
        .bigInteger('package_id')
        .notNullable()
        .references('id')
        .inTable('layer_packages')
        .onDelete('CASCADE')
      table.string('school_year', 9).notNullable()
      table.string('status', 8).notNullable().defaultTo('active')
      table.date('starts_on').notNullable()
      table.date('ends_on').nullable()
      table
        .bigInteger('chosen_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('chosen_at', { useTz: true }).notNullable()
      table
        .bigInteger('ended_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamp('ended_at', { useTz: true }).nullable()
      table.string('end_reason', 20).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['school_id', 'school_year', 'status'])
    })
    this.schema.raw(`
      ALTER TABLE school_package_choices
        ADD CONSTRAINT school_package_choices_status_check CHECK (status IN (${list(CHOICE_STATUSES)})),
        ADD CONSTRAINT school_package_choices_end_reason_check CHECK (
          end_reason IS NULL OR end_reason IN (${list(CHOICE_END_REASONS)})),
        ADD CONSTRAINT school_package_choices_ended_check CHECK (
          (status = 'ended') = (ended_at IS NOT NULL AND end_reason IS NOT NULL AND ends_on IS NOT NULL)),
        ADD CONSTRAINT school_package_choices_dates_check CHECK (ends_on IS NULL OR ends_on >= starts_on),
        ADD CONSTRAINT school_package_choices_school_year_check CHECK (school_year ~ '^[0-9]{4}/[0-9]{4}$')
    `)
    this.schema.raw(`
      CREATE UNIQUE INDEX school_package_choices_one_active
        ON school_package_choices (school_id, package_id, school_year) WHERE status = 'active'
    `)

    this.schema.raw(`
      CREATE FUNCTION school_package_choices_guard() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        pkg layer_packages%ROWTYPE;
        year int := left(NEW.school_year, 4)::int;
      BEGIN
        IF TG_OP = 'UPDATE' AND (NEW.school_id, NEW.package_id, NEW.school_year)
            IS DISTINCT FROM (OLD.school_id, OLD.package_id, OLD.school_year) THEN
          RAISE EXCEPTION 'school_package_choices: school, package and school year never change'
            USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.status <> 'active' OR (TG_OP = 'UPDATE' AND OLD.status = 'active') THEN
          RETURN NEW;
        END IF;
        SELECT * INTO pkg FROM layer_packages WHERE id = NEW.package_id;
        IF pkg.kind <> 'local_agreement' OR pkg.status <> 'active' THEN
          RAISE EXCEPTION 'school_package_choices: only an active local agreement can be chosen'
            USING ERRCODE = 'check_violation', HINT = 'layer_choice_not_agreement';
        END IF;
        IF NOT (pkg.region_id = ANY (coalesce(layer_region_chain(NEW.school_id), '{}'::bigint[]))) THEN
          RAISE EXCEPTION 'school_package_choices: the package is outside the school''s area'
            USING ERRCODE = 'check_violation', HINT = 'layer_choice_outside_area';
        END IF;
        IF year < left(pkg.applies_from_school_year, 4)::int
           OR year > coalesce(left(pkg.applies_to_school_year, 4)::int, 9999) THEN
          RAISE EXCEPTION 'school_package_choices: the package does not apply in %', NEW.school_year
            USING ERRCODE = 'check_violation', HINT = 'layer_choice_school_year';
        END IF;
        RETURN NEW;
      END
      $$
    `)
    this.schema.raw(`
      CREATE TRIGGER school_package_choices_guard BEFORE INSERT OR UPDATE ON school_package_choices
        FOR EACH ROW EXECUTE FUNCTION school_package_choices_guard()
    `)
    this.schema.raw(`
      CREATE FUNCTION school_package_choices_after() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        row school_package_choices%ROWTYPE;
        pkg_domain text;
      BEGIN
        IF TG_OP = 'DELETE' THEN row := OLD; ELSE row := NEW; END IF;
        SELECT domain INTO pkg_domain FROM layer_packages WHERE id = row.package_id;
        IF pkg_domain IS NOT NULL THEN
          PERFORM layer_bump_stamp('choices:' || row.school_id, pkg_domain);
        END IF;
        RETURN NULL;
      END
      $$
    `)
    this.schema.raw(`
      CREATE TRIGGER school_package_choices_after AFTER INSERT OR UPDATE OR DELETE ON school_package_choices
        FOR EACH ROW EXECUTE FUNCTION school_package_choices_after()
    `)

    for (const sql of schoolRls(this.tableName)) this.schema.raw(sql)
  }

  async down() {
    for (const sql of dropRls(this.tableName)) this.schema.raw(sql)
    this.schema.dropTable(this.tableName)
    this.schema.raw(`DROP FUNCTION IF EXISTS school_package_choices_after()`)
    this.schema.raw(`DROP FUNCTION IF EXISTS school_package_choices_guard()`)
  }
}
