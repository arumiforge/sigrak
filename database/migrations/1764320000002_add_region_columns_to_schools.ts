import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A school's place in the region tree (docs/drafts/regional-layers.md
 * §2.2, §8): `region_id` stays the kabupaten/kota (D-377), `district_id`
 * is the kecamatan when known, `region_source` says where they came
 * from and `region_checked_at` when they were last confirmed. The text
 * column `district` (D-319) becomes nullable and stays, as the name
 * shown, until every school has a `district_id`; it then goes in a
 * later migration.
 */
export default class extends BaseSchema {
  protected tableName = 'schools'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .bigInteger('district_id')
        .nullable()
        .references('id')
        .inTable('regions')
        .onDelete('RESTRICT')
        .index()
      table.string('region_source', 20).notNullable().defaultTo('staff_manual')
      table.timestamp('region_checked_at', { useTz: true }).nullable()
      table.string('district', 100).nullable().alter()
      table.check(
        `region_source IN ('npsn_directory', 'dapodik_import', 'staff_manual')`,
        [],
        'schools_region_source_check'
      )
    })

    // region_id is a kabupaten/kota; district_id a kecamatan inside it.
    this.schema.raw(`
      CREATE FUNCTION schools_check_region() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM regions WHERE id = NEW.region_id AND level = 'regency') THEN
          RAISE EXCEPTION 'schools: region_id must be a kabupaten or kota'
            USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.district_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM regions WHERE id = NEW.district_id AND level = 'district' AND parent_id = NEW.region_id
        ) THEN
          RAISE EXCEPTION 'schools: district_id must be a kecamatan of region_id'
            USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END
      $$
    `)
    this.schema.raw(`
      CREATE TRIGGER schools_check_region
        BEFORE INSERT OR UPDATE OF region_id, district_id ON schools
        FOR EACH ROW EXECUTE FUNCTION schools_check_region()
    `)
  }

  async down() {
    this.schema.raw(`DROP TRIGGER schools_check_region ON schools`)
    this.schema.raw(`DROP FUNCTION schools_check_region()`)
    this.schema.alterTable(this.tableName, (table) => {
      table.dropChecks(['schools_region_source_check'])
      table.dropColumn('region_checked_at')
      table.dropColumn('region_source')
      table.dropColumn('district_id')
    })
    this.schema.raw(`UPDATE schools SET district = '' WHERE district IS NULL`)
    this.schema.raw(`ALTER TABLE schools ALTER COLUMN district SET NOT NULL`)
  }
}
