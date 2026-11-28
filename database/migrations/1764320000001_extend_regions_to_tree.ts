import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Codes of the regions the skeleton could already hold (the demo seed's
 * Jawa Tengah and Kabupaten Kudus, plus the other directory regencies).
 * Every other existing row stops the migration: give it a code by hand.
 */
const KNOWN: Record<string, { kemendagri: string; dapodik: string }> = {
  'Jawa Tengah': { kemendagri: '33', dapodik: '030000' },
  'Jawa Tengah|Pati': { kemendagri: '33.18', dapodik: '031800' },
  'Jawa Tengah|Kudus': { kemendagri: '33.19', dapodik: '031900' },
  'Jawa Tengah|Jepara': { kemendagri: '33.20', dapodik: '032000' },
}

/**
 * Regions become a province → kabupaten/kota → kecamatan tree keyed by
 * Kemendagri codes, with the Kemendikdasmen/Dapodik codes alongside
 * (D-456, D-466, docs/drafts/regional-layers.md §2.2). The text columns
 * `province`, `regency` and `regency_key` (D-377) give way to `level`,
 * `parent_id` and `name`; a province-level region is still a row of its
 * own (level `province`), so D-377 holds.
 */
export default class extends BaseSchema {
  protected tableName = 'regions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('level', 10).nullable()
      table
        .bigInteger('parent_id')
        .nullable()
        .references('id')
        .inTable('regions')
        .onDelete('RESTRICT')
        .index()
      table.string('name', 100).nullable()
      table.string('regency_kind', 10).nullable()
      table.string('kemendagri_code', 13).nullable()
      table.string('dapodik_code', 6).nullable()
      table.string('status', 10).notNullable().defaultTo('active')
      table
        .bigInteger('replaced_by_id')
        .nullable()
        .references('id')
        .inTable('regions')
        .onDelete('RESTRICT')
    })

    this.defer(async (db) => {
      const rows = (await db.from('regions').select('id', 'province', 'regency')) as {
        id: number
        province: string
        regency: string | null
      }[]
      const provinces = new Map<string, number>()

      for (const row of rows.filter((r) => r.regency === null)) {
        const code = KNOWN[row.province]
        if (!code) throw new Error(`regions ${row.id}: no Kemendagri code for "${row.province}"`)
        await db.from('regions').where('id', row.id).update({
          level: 'province',
          name: row.province,
          kemendagri_code: code.kemendagri,
          dapodik_code: code.dapodik,
        })
        provinces.set(row.province, row.id)
      }

      for (const row of rows.filter((r) => r.regency !== null)) {
        const kind = row.regency!.startsWith('Kota ') ? 'kota' : 'kabupaten'
        const name = row.regency!.replace(/^(Kabupaten|Kab\.|Kota)\s+/, '')
        const code = KNOWN[`${row.province}|${name}`]
        if (!code) throw new Error(`regions ${row.id}: no Kemendagri code for "${row.regency}"`)
        let parentId = provinces.get(row.province)
        if (parentId === undefined) {
          const province = KNOWN[row.province]
          const [created] = await db
            .table('regions')
            .insert({
              province: row.province,
              regency: null,
              level: 'province',
              name: row.province,
              kemendagri_code: province.kemendagri,
              dapodik_code: province.dapodik,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .returning('id')
          parentId = typeof created === 'object' ? created.id : created
          provinces.set(row.province, parentId!)
        }
        await db.from('regions').where('id', row.id).update({
          level: 'regency',
          parent_id: parentId,
          name,
          regency_kind: kind,
          kemendagri_code: code.kemendagri,
          dapodik_code: code.dapodik,
        })
      }
    })

    this.schema.raw(`ALTER TABLE regions DROP CONSTRAINT regions_province_regency_key_unique`)
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('regency_key')
      table.dropColumn('province')
      table.dropColumn('regency')
    })

    this.schema.raw(`
      ALTER TABLE regions
        ALTER COLUMN level SET NOT NULL,
        ALTER COLUMN name SET NOT NULL,
        ALTER COLUMN kemendagri_code SET NOT NULL,
        ADD CONSTRAINT regions_kemendagri_code_unique UNIQUE (kemendagri_code),
        ADD CONSTRAINT regions_dapodik_code_unique UNIQUE (dapodik_code),
        ADD CONSTRAINT regions_level_check CHECK (level IN ('province', 'regency', 'district')),
        ADD CONSTRAINT regions_status_check CHECK (status IN ('active', 'retired')),
        ADD CONSTRAINT regions_parent_check CHECK ((level = 'province') = (parent_id IS NULL)),
        ADD CONSTRAINT regions_regency_kind_check CHECK (
          CASE WHEN level = 'regency' THEN coalesce(regency_kind IN ('kabupaten', 'kota'), false)
          ELSE regency_kind IS NULL END),
        ADD CONSTRAINT regions_replaced_by_check CHECK (replaced_by_id IS NULL OR status = 'retired'),
        ADD CONSTRAINT regions_kemendagri_code_format_check CHECK (
          (level = 'province' AND kemendagri_code ~ '^[0-9]{2}$')
          OR (level = 'regency' AND kemendagri_code ~ '^[0-9]{2}\\.[0-9]{2}$')
          OR (level = 'district' AND kemendagri_code ~ '^[0-9]{2}\\.[0-9]{2}\\.[0-9]{2}$')),
        ADD CONSTRAINT regions_dapodik_code_format_check CHECK (dapodik_code ~ '^[0-9]{6}$')
    `)
    // Kabupaten Pekalongan and Kota Pekalongan share a name, so the kind is part of the key.
    this.schema.raw(`
      CREATE UNIQUE INDEX regions_active_name_unique
        ON regions (coalesce(parent_id, 0), coalesce(regency_kind, ''), lower(name))
        WHERE status = 'active'
    `)

    // The parent is one level up and its code is the prefix of the child's code.
    this.schema.raw(`
      CREATE FUNCTION regions_check_parent() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        parent regions%ROWTYPE;
      BEGIN
        IF NEW.parent_id IS NULL THEN
          RETURN NEW;
        END IF;
        SELECT * INTO parent FROM regions WHERE id = NEW.parent_id;
        IF NOT ((parent.level = 'province' AND NEW.level = 'regency')
             OR (parent.level = 'regency' AND NEW.level = 'district')) THEN
          RAISE EXCEPTION 'regions: a % cannot sit under a %', NEW.level, parent.level
            USING ERRCODE = 'check_violation';
        END IF;
        IF left(NEW.kemendagri_code, length(parent.kemendagri_code) + 1) <> parent.kemendagri_code || '.' THEN
          RAISE EXCEPTION 'regions: code % does not start with its parent code %',
            NEW.kemendagri_code, parent.kemendagri_code
            USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END
      $$
    `)
    this.schema.raw(`
      CREATE TRIGGER regions_check_parent
        BEFORE INSERT OR UPDATE OF parent_id, level, kemendagri_code ON regions
        FOR EACH ROW EXECUTE FUNCTION regions_check_parent()
    `)

    // Reference data: the app reads it; migrations and seeders (the owner) write it.
    this.schema.raw(`REVOKE INSERT, UPDATE, DELETE ON regions FROM sigrak_app`)
  }

  async down() {
    this.schema.raw(`GRANT INSERT, UPDATE, DELETE ON regions TO sigrak_app`)
    this.schema.raw(`DROP TRIGGER regions_check_parent ON regions`)
    this.schema.raw(`DROP FUNCTION regions_check_parent()`)
    this.schema.raw(`DROP INDEX regions_active_name_unique`)
    // Kecamatan rows have no place in the old shape.
    this.schema.raw(`DELETE FROM regions WHERE level = 'district'`)
    this.schema.alterTable(this.tableName, (table) => {
      table.string('province', 100).nullable()
      table.string('regency', 100).nullable()
    })
    this.schema.raw(`
      UPDATE regions r SET
        province = CASE WHEN r.level = 'province' THEN r.name
          ELSE (SELECT p.name FROM regions p WHERE p.id = r.parent_id) END,
        regency = CASE WHEN r.level = 'regency'
          THEN (CASE r.regency_kind WHEN 'kota' THEN 'Kota ' ELSE 'Kabupaten ' END) || r.name END
    `)
    this.schema.raw(`ALTER TABLE regions ALTER COLUMN province SET NOT NULL`)
    this.schema.raw(
      `ALTER TABLE regions ADD COLUMN regency_key varchar(100) GENERATED ALWAYS AS (coalesce(regency, '')) STORED NOT NULL`
    )
    this.schema.raw(
      `ALTER TABLE regions ADD CONSTRAINT regions_province_regency_key_unique UNIQUE (province, regency_key)`
    )
    this.schema.raw(`
      ALTER TABLE regions
        DROP CONSTRAINT regions_kemendagri_code_unique,
        DROP CONSTRAINT regions_dapodik_code_unique,
        DROP CONSTRAINT regions_level_check,
        DROP CONSTRAINT regions_status_check,
        DROP CONSTRAINT regions_parent_check,
        DROP CONSTRAINT regions_regency_kind_check,
        DROP CONSTRAINT regions_replaced_by_check,
        DROP CONSTRAINT regions_kemendagri_code_format_check,
        DROP CONSTRAINT regions_dapodik_code_format_check
    `)
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('replaced_by_id')
      table.dropColumn('status')
      table.dropColumn('dapodik_code')
      table.dropColumn('kemendagri_code')
      table.dropColumn('regency_kind')
      table.dropColumn('name')
      table.dropColumn('parent_id')
      table.dropColumn('level')
    })
  }
}
