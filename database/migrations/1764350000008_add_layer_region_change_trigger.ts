import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Region change hook of the layer model (docs/drafts/regional-layers.md
 * §8, D-466). When a school's kabupaten/kota or kecamatan changes (an
 * accepted "Perubahan wilayah" applied by `RegionChangeQueue.applyDue()`,
 * or a staff correction), in the same transaction:
 *
 * - local agreement choices of areas the school left end with
 *   `end_reason = region_changed` (choices of areas it stays in, such as
 *   the province, are kept);
 * - the school's own differences stay;
 * - stamps: the school's region chain is part of the resolver's cache
 *   key, and the ended choices bump `choices:<school id>`;
 * - the operator and principal get a `region_changed` notice listing
 *   the ended packages.
 *
 * A trigger instead of code in applyDue(), so every path that moves a
 * school runs it.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE FUNCTION layer_school_region_changed() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        chain bigint[] := coalesce(layer_region_chain(NEW.id), '{}'::bigint[]);
        ended jsonb;
      BEGIN
        WITH closed AS (
          UPDATE school_package_choices c
             SET status = 'ended', ended_at = now(),
                 ends_on = greatest(c.starts_on, (now() AT TIME ZONE 'Asia/Jakarta')::date),
                 end_reason = 'region_changed', updated_at = now()
            FROM layer_packages p
           WHERE p.id = c.package_id AND c.school_id = NEW.id AND c.status = 'active'
             AND NOT (p.region_id = ANY (chain))
          RETURNING p.code, p.name, p.domain)
        SELECT coalesce(jsonb_agg(jsonb_build_object('package_code', code, 'package_name', name,
                                                     'domain', domain) ORDER BY code), '[]'::jsonb)
          INTO ended FROM closed;

        INSERT INTO layer_notices (school_id, kind, audience, payload, created_at)
        VALUES (NEW.id, 'region_changed', 'all',
                jsonb_build_object('from_region_id', OLD.region_id, 'from_district_id', OLD.district_id,
                                   'to_region_id', NEW.region_id, 'to_district_id', NEW.district_id,
                                   'ended_packages', ended),
                now());
        RETURN NULL;
      END
      $$
    `)
    this.schema.raw(`
      CREATE TRIGGER schools_layer_region_changed AFTER UPDATE OF region_id, district_id ON schools
        FOR EACH ROW
        WHEN (OLD.region_id IS DISTINCT FROM NEW.region_id OR OLD.district_id IS DISTINCT FROM NEW.district_id)
        EXECUTE FUNCTION layer_school_region_changed()
    `)
  }

  async down() {
    this.schema.raw(`DROP TRIGGER IF EXISTS schools_layer_region_changed ON schools`)
    this.schema.raw(`DROP FUNCTION IF EXISTS layer_school_region_changed()`)
  }
}
