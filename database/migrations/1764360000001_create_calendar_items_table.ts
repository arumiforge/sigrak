import { BaseSchema } from '@adonisjs/lucid/schema'
import {
  dropLayeredTableSql,
  layeredColumns,
  layeredTableSql,
} from '../../app/layers/database/layered_table.js'
import { CALENDAR_ITEM_KINDS, EXAM_TYPES, FRAME_KEYS } from '../../app/calendar/types.js'

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ')

/**
 * The calendar as a layered domain (D-456, D-466,
 * docs/drafts/regional-layers.md §5.6, §10): one layered table,
 * `calendar_items`, holds every calendar item of every layer.
 *
 * - National base package: the SKB holidays (`national_holiday`,
 *   mandatory) and joint leave (`joint_leave`, hideable, D-255), item
 *   key `HOL-<date>-<kind>`.
 * - Official area packages (the Jawa Tengah kaldik, line `all`): events
 *   (mandatory for the area's schools, D-466), the school-year frame as
 *   `setting` items (`FRAME-starts_on`, …) and notes (`note`: SAS
 *   windows and milestones that are not events, D-379).
 * - The school package: the school's own events, also for one class
 *   (`class_id`, D-258); hides of joint leave days it keeps open.
 *
 * `calendar_items_guard` keeps the national kinds in national packages,
 * class events in school packages (and the class in that school), and
 * frame settings out of school packages: a school's own frame is its
 * academic year (R1-06). RLS and the layer triggers come from
 * `layeredTableSql()`.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('calendar_items', (table) => {
      layeredColumns(table)
      table
        .bigInteger('class_id')
        .nullable()
        .references('id')
        .inTable('classes')
        .onDelete('CASCADE')
      table.string('kind', 20).notNullable()
      table.string('exam_type', 10).nullable()
      table.string('title', 150).notNullable()
      table.date('starts_on').nullable()
      table.date('ends_on').nullable()
      table.string('setting_value', 40).nullable()

      table.index(['package_id', 'starts_on'])
      table.index(['class_id'])
    })
    this.schema.raw(`
      ALTER TABLE calendar_items
        ADD CONSTRAINT calendar_items_kind_check CHECK (kind IN (${list(CALENDAR_ITEM_KINDS)})),
        ADD CONSTRAINT calendar_items_exam_type_check CHECK (
          (kind = 'exam' AND exam_type IN (${list(EXAM_TYPES)})) OR (kind <> 'exam' AND exam_type IS NULL)),
        ADD CONSTRAINT calendar_items_setting_shape_check CHECK ((kind = 'setting') = (shape = 'setting')),
        ADD CONSTRAINT calendar_items_setting_value_check CHECK (
          (kind = 'setting') = (setting_value IS NOT NULL)
          AND (kind = 'setting') = (starts_on IS NULL)
          AND (starts_on IS NULL) = (ends_on IS NULL)),
        ADD CONSTRAINT calendar_items_dates_check CHECK (starts_on IS NULL OR starts_on <= ends_on),
        ADD CONSTRAINT calendar_items_title_check CHECK (length(btrim(title)) > 0)
    `)

    this.schema.raw(`
      CREATE FUNCTION calendar_items_guard() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        pkg layer_packages%ROWTYPE;
        class_school bigint;
      BEGIN
        SELECT * INTO pkg FROM layer_packages WHERE id = NEW.package_id;
        IF NEW.kind IN ('national_holiday', 'joint_leave') AND pkg.layer <> 'national' THEN
          RAISE EXCEPTION 'calendar_items: % only in the national package', NEW.kind
            USING ERRCODE = 'check_violation';
        END IF;
        IF NEW.kind = 'setting' THEN
          IF pkg.layer = 'school' THEN
            RAISE EXCEPTION 'calendar_items: a school''s frame is its academic year'
              USING ERRCODE = 'check_violation';
          END IF;
          IF NEW.item_key NOT IN (${list(FRAME_KEYS)}) THEN
            RAISE EXCEPTION 'calendar_items: unknown setting %', NEW.item_key
              USING ERRCODE = 'check_violation';
          END IF;
        END IF;
        IF NEW.class_id IS NOT NULL THEN
          SELECT school_id INTO class_school FROM classes WHERE id = NEW.class_id;
          IF pkg.layer <> 'school' OR class_school IS DISTINCT FROM pkg.school_id THEN
            RAISE EXCEPTION 'calendar_items: the class is not of the package''s school'
              USING ERRCODE = 'check_violation', HINT = 'calendar_class_school';
          END IF;
        END IF;
        RETURN NEW;
      END
      $$
    `)
    this.schema.raw(`
      CREATE TRIGGER calendar_items_guard BEFORE INSERT OR UPDATE ON calendar_items
        FOR EACH ROW EXECUTE FUNCTION calendar_items_guard()
    `)

    for (const sql of layeredTableSql('calendar_items')) this.schema.raw(sql)

    this.schema.raw(`
      INSERT INTO layer_domains (domain, item_table, created_at)
      VALUES ('calendar', 'calendar_items', now())
    `)
  }

  async down() {
    this.schema.raw(`DELETE FROM layer_proposals WHERE domain = 'calendar'`)
    this.schema.raw(`DELETE FROM layer_packages WHERE domain = 'calendar'`)
    this.schema.raw(`DELETE FROM layer_stamps WHERE domain = 'calendar'`)
    this.schema.raw(`DELETE FROM layer_domains WHERE domain = 'calendar'`)
    for (const sql of dropLayeredTableSql('calendar_items')) this.schema.raw(sql)
    this.schema.dropTable('calendar_items')
    this.schema.raw(`DROP FUNCTION IF EXISTS calendar_items_guard()`)
  }
}
