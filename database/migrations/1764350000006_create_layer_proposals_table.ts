import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, staffPolicy } from '../../app/tenancy/rls.js'
import { PROPOSAL_ACTIONS, PROPOSAL_STATUSES } from '../../app/layers/types.js'

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ')

/**
 * Proposals to change a layer (docs/drafts/regional-layers.md §6,
 * D-380, D-456, D-466):
 *
 * - **School** (`target_layer = school`, `school_id` set): a teacher or
 *   the principal proposes; the operator approves or rejects. School-owned
 *   with RLS.
 * - **Area** (province, kabupaten/kota, kecamatan; `region_id` set): Tim
 *   SIGRAK staff propose with evidence; an approver of another person
 *   decides, and may return it for changes. Staff only.
 *
 * National changes never go through this table (rule-set console). A
 * proposer never decides their own proposal (CHECKs below, D-339).
 */
export default class extends BaseSchema {
  protected tableName = 'layer_proposals'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique().defaultTo(this.raw('gen_random_uuid()'))
      table
        .string('domain', 40)
        .notNullable()
        .references('domain')
        .inTable('layer_domains')
        .onDelete('RESTRICT')
      table.string('target_layer', 10).notNullable()
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
      table
        .bigInteger('package_id')
        .nullable()
        .references('id')
        .inTable('layer_packages')
        .onDelete('SET NULL')
      table.string('action', 16).notNullable()
      table.string('item_key', 80).nullable()
      table.jsonb('payload').notNullable().defaultTo('{}')
      table.text('reason').nullable()
      table.jsonb('evidence').nullable()
      table.string('status', 10).notNullable().defaultTo('submitted')
      table
        .bigInteger('proposed_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .bigInteger('proposed_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table
        .bigInteger('decided_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table
        .bigInteger('decided_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('submitted_at', { useTz: true }).nullable()
      table.timestamp('decided_at', { useTz: true }).nullable()
      table.text('decision_note').nullable()
      table.jsonb('impact').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['school_id', 'status'])
      table.index(['region_id', 'status'])
      table.index(['status', 'submitted_at'])
    })
    this.schema.raw(`
      ALTER TABLE layer_proposals
        ADD CONSTRAINT layer_proposals_action_check CHECK (action IN (${list(PROPOSAL_ACTIONS)})),
        ADD CONSTRAINT layer_proposals_status_check CHECK (status IN (${list(PROPOSAL_STATUSES)})),
        ADD CONSTRAINT layer_proposals_target_check CHECK (
          (target_layer = 'school' AND school_id IS NOT NULL AND region_id IS NULL
             AND proposed_by_user_id IS NOT NULL AND proposed_by_staff_id IS NULL
             AND decided_by_staff_id IS NULL AND status <> 'returned')
          OR (target_layer IN ('province', 'regency', 'district') AND region_id IS NOT NULL
             AND school_id IS NULL AND proposed_by_user_id IS NULL AND decided_by_user_id IS NULL)),
        ADD CONSTRAINT layer_proposals_school_action_check CHECK (
          target_layer <> 'school' OR action IN ('add', 'revise', 'hide', 'unhide', 'retire')),
        ADD CONSTRAINT layer_proposals_item_key_check CHECK (
          action IN ('create_package', 'retire_package', 'add') OR item_key IS NOT NULL),
        ADD CONSTRAINT layer_proposals_decided_check CHECK (
          (status IN ('approved', 'rejected', 'returned')) = (decided_at IS NOT NULL)),
        ADD CONSTRAINT layer_proposals_own_user_check CHECK (
          decided_by_user_id IS NULL OR decided_by_user_id IS DISTINCT FROM proposed_by_user_id),
        ADD CONSTRAINT layer_proposals_own_staff_check CHECK (
          decided_by_staff_id IS NULL OR decided_by_staff_id IS DISTINCT FROM proposed_by_staff_id)
    `)

    // The region's level matches the target layer.
    this.schema.raw(`
      CREATE FUNCTION layer_proposals_guard() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
      AS $$
      DECLARE
        region_level text;
      BEGIN
        IF NEW.region_id IS NOT NULL THEN
          SELECT level INTO region_level FROM regions WHERE id = NEW.region_id;
          IF region_level IS DISTINCT FROM NEW.target_layer THEN
            RAISE EXCEPTION 'layer_proposals: a % proposal needs a % region', NEW.target_layer, NEW.target_layer
              USING ERRCODE = 'check_violation';
          END IF;
        END IF;
        RETURN NEW;
      END
      $$
    `)
    this.schema.raw(`
      CREATE TRIGGER layer_proposals_guard BEFORE INSERT OR UPDATE ON layer_proposals
        FOR EACH ROW EXECUTE FUNCTION layer_proposals_guard()
    `)

    this.schema.raw(`ALTER TABLE layer_proposals ENABLE ROW LEVEL SECURITY`)
    this.schema.raw(`
      CREATE POLICY layer_proposals_school ON layer_proposals FOR ALL TO sigrak_app
        USING (school_id = app_school_id()) WITH CHECK (school_id = app_school_id())
    `)
    for (const sql of staffPolicy(this.tableName)) this.schema.raw(sql)
  }

  async down() {
    for (const sql of dropRls(this.tableName)) this.schema.raw(sql)
    this.schema.dropTable(this.tableName)
    this.schema.raw(`DROP FUNCTION IF EXISTS layer_proposals_guard()`)
  }
}
