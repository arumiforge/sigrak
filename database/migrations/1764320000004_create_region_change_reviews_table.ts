import { BaseSchema } from '@adonisjs/lucid/schema'
import { staffPolicy, dropRls } from '../../app/tenancy/rls.js'

/**
 * "Perubahan wilayah" (D-466, docs/drafts/regional-layers.md §8): a
 * directory re-import that puts a school in another kabupaten/kota or
 * kecamatan creates a pending row; nothing changes silently. Staff
 * accept it from the next day or from the next school year
 * (`apply_from`, `effective_on`), or reject it. An accepted row is
 * applied to the school on its `effective_on` (`applied_at`). A newer
 * difference marks an open or waiting row `superseded`.
 *
 * School-owned: the school may read its own rows (the operator sees
 * what is coming); only staff write them.
 */
export default class extends BaseSchema {
  protected tableName = 'region_change_reviews'

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
        .index()
      table
        .bigInteger('directory_entry_id')
        .nullable()
        .references('id')
        .inTable('school_directory_entries')
        .onDelete('SET NULL')
      for (const column of [
        'from_region_id',
        'from_district_id',
        'to_region_id',
        'to_district_id',
      ]) {
        table.bigInteger(column).nullable().references('id').inTable('regions').onDelete('RESTRICT')
      }
      table.string('status', 12).notNullable().defaultTo('pending')
      table.string('apply_from', 20).nullable()
      table.date('effective_on').nullable()
      table.timestamp('detected_at', { useTz: true }).notNullable()
      table
        .bigInteger('decided_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('decided_at', { useTz: true }).nullable()
      table.timestamp('applied_at', { useTz: true }).nullable()
      table.text('note').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['school_id', 'status'])
    })

    this.schema.raw(`
      ALTER TABLE region_change_reviews
        ALTER COLUMN from_region_id SET NOT NULL,
        ALTER COLUMN to_region_id SET NOT NULL,
        ADD CONSTRAINT region_change_reviews_status_check
          CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
        ADD CONSTRAINT region_change_reviews_apply_from_check
          CHECK (apply_from IN ('next_day', 'next_school_year')),
        ADD CONSTRAINT region_change_reviews_accepted_check
          CHECK (status <> 'accepted' OR (apply_from IS NOT NULL AND effective_on IS NOT NULL)),
        ADD CONSTRAINT region_change_reviews_open_check
          CHECK (status NOT IN ('pending', 'rejected') OR (apply_from IS NULL AND effective_on IS NULL)),
        ADD CONSTRAINT region_change_reviews_decided_check
          CHECK (status NOT IN ('accepted', 'rejected') OR decided_at IS NOT NULL),
        ADD CONSTRAINT region_change_reviews_pending_check
          CHECK (status <> 'pending' OR decided_at IS NULL),
        ADD CONSTRAINT region_change_reviews_applied_check
          CHECK (applied_at IS NULL OR status = 'accepted'),
        ADD CONSTRAINT region_change_reviews_changes_check
          CHECK (from_region_id <> to_region_id OR from_district_id IS DISTINCT FROM to_district_id)
    `)
    // At most one open review and one accepted change waiting for its date per school.
    this.schema.raw(`
      CREATE UNIQUE INDEX region_change_reviews_one_pending
        ON region_change_reviews (school_id) WHERE status = 'pending'
    `)
    this.schema.raw(`
      CREATE UNIQUE INDEX region_change_reviews_one_scheduled
        ON region_change_reviews (school_id) WHERE status = 'accepted' AND applied_at IS NULL
    `)

    this.schema.raw(`ALTER TABLE region_change_reviews ENABLE ROW LEVEL SECURITY`)
    this.schema.raw(`
      CREATE POLICY region_change_reviews_school ON region_change_reviews
        FOR SELECT TO sigrak_app USING (school_id = app_school_id())
    `)
    for (const sql of staffPolicy('region_change_reviews')) this.schema.raw(sql)
  }

  async down() {
    for (const sql of dropRls('region_change_reviews')) this.schema.raw(sql)
    this.schema.dropTable(this.tableName)
  }
}
