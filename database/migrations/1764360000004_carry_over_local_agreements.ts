import { BaseSchema } from '@adonisjs/lucid/schema'
import { NOTICE_KINDS } from '../../app/layers/types.js'

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ')

/**
 * D-472: a school's chosen local agreements are copied into a new
 * school year when that year is created; the operator is told and can
 * stop following them on Paket daerah.
 *
 * The copy runs as a trigger on `academic_years` (R1-06), so every path
 * that creates a year (the Tahun Ajaran form, a later rollover job,
 * imports) carries the choices over in the same transaction. It copies
 * the active choices of the school's latest earlier school year whose
 * package is still an active local agreement of the school's own area
 * and still applies in the new year (the `school_package_choices`
 * guard checks the same again). The new choice starts on the new year's
 * first day and keeps the user who chose it. One notice per new year
 * lists the packages (`package_carried_over`, audience operator).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`ALTER TABLE layer_notices DROP CONSTRAINT layer_notices_kind_check`)
    this.schema.raw(`
      ALTER TABLE layer_notices
        ADD CONSTRAINT layer_notices_kind_check CHECK (kind IN (${list(NOTICE_KINDS)}))
    `)

    this.schema.raw(`
      CREATE FUNCTION academic_years_carry_over_choices() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        previous text;
        copied jsonb;
        year int := left(NEW.name, 4)::int;
      BEGIN
        SELECT max(school_year) INTO previous
          FROM school_package_choices
         WHERE school_id = NEW.school_id AND school_year < NEW.name;
        IF previous IS NULL THEN
          RETURN NULL;
        END IF;

        WITH source AS (
          SELECT DISTINCT ON (c.package_id)
                 c.package_id, c.chosen_by_user_id, p.code, p.name, p.domain
            FROM school_package_choices c
            JOIN layer_packages p ON p.id = c.package_id
           WHERE c.school_id = NEW.school_id AND c.school_year = previous AND c.status = 'active'
             AND p.kind = 'local_agreement' AND p.status = 'active'
             AND p.region_id = ANY (coalesce(layer_region_chain(NEW.school_id), '{}'::bigint[]))
             AND left(p.applies_from_school_year, 4)::int <= year
             AND coalesce(left(p.applies_to_school_year, 4)::int, 9999) >= year
             AND NOT EXISTS (
               SELECT 1 FROM school_package_choices e
                WHERE e.school_id = NEW.school_id AND e.package_id = c.package_id
                  AND e.school_year = NEW.name AND e.status = 'active')
           ORDER BY c.package_id, c.chosen_at DESC),
        inserted AS (
          INSERT INTO school_package_choices
            (school_id, package_id, school_year, status, starts_on, chosen_by_user_id,
             chosen_at, created_at, updated_at)
          SELECT NEW.school_id, s.package_id, NEW.name, 'active', NEW.starts_on,
                 s.chosen_by_user_id, now(), now(), now()
            FROM source s
          RETURNING package_id)
        SELECT jsonb_agg(jsonb_build_object('package_code', s.code, 'package_name', s.name,
                                            'domain', s.domain) ORDER BY s.name)
          INTO copied
          FROM source s JOIN inserted i ON i.package_id = s.package_id;

        IF copied IS NOT NULL THEN
          INSERT INTO layer_notices (school_id, kind, audience, payload, created_at)
          VALUES (NEW.school_id, 'package_carried_over', 'operator',
                  jsonb_build_object('school_year', NEW.name, 'from_school_year', previous,
                                     'packages', copied),
                  now());
        END IF;
        RETURN NULL;
      END
      $$
    `)
    this.schema.raw(`
      CREATE TRIGGER academic_years_carry_over_choices AFTER INSERT ON academic_years
        FOR EACH ROW EXECUTE FUNCTION academic_years_carry_over_choices()
    `)
  }

  async down() {
    this.schema.raw(`DROP TRIGGER IF EXISTS academic_years_carry_over_choices ON academic_years`)
    this.schema.raw(`DROP FUNCTION IF EXISTS academic_years_carry_over_choices()`)
    this.schema.raw(`DELETE FROM layer_notices WHERE kind = 'package_carried_over'`)
    this.schema.raw(`ALTER TABLE layer_notices DROP CONSTRAINT layer_notices_kind_check`)
    this.schema.raw(`
      ALTER TABLE layer_notices
        ADD CONSTRAINT layer_notices_kind_check CHECK (kind IN (${list(
          NOTICE_KINDS.filter((kind) => kind !== 'package_carried_over')
        )}))
    `)
  }
}
