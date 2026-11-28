import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Kabar from Tim SIGRAK (D-319, D-477, R2-05).
 *
 * - `announcements`: one editor for both places a Kabar can show: in
 *   the app (`show_in_app`, for the users its targets reach) and on
 *   sigrak.com/kabar (`show_public`), or both. The body is Markdown and
 *   is rendered through the allowlist renderer (app/publishing/
 *   markdown.ts), never stored as HTML. Targets (app only) are arrays:
 *   regions (province, kabupaten/kota or kecamatan ids), named schools,
 *   levels (sd, mi) and school roles; every empty array means "all".
 *   `kind` says what the Kabar is about; some staff roles may only
 *   write one kind (Kurator kurikulum: curriculum, Teknis:
 *   maintenance; app/publishing/announcement_rules.ts). A published
 *   Kabar shows from `starts_at` (or its publish time) until `ends_at`.
 * - `announcement_reads`: which school user opened which Kabar, for
 *   the unread badge in the app header.
 *
 * Neither table has a school_id: a Kabar belongs to Tim SIGRAK and a
 * read row to one user, so there is no RLS (as staff_role_assignments).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('announcements', (table) => {
      table.bigIncrements('id')
      table.string('slug', 120).notNullable().unique()
      table.string('title', 200).notNullable()
      table.string('summary', 300).nullable()
      table.text('body').notNullable()
      table.string('kind', 20).notNullable().defaultTo('general')
      table.string('status', 10).notNullable().defaultTo('draft')
      table.boolean('show_in_app').notNullable().defaultTo(true)
      table.boolean('show_public').notNullable().defaultTo(false)
      table.specificType('target_region_ids', 'bigint[]').notNullable().defaultTo('{}')
      table.specificType('target_school_ids', 'bigint[]').notNullable().defaultTo('{}')
      table.specificType('target_levels', 'text[]').notNullable().defaultTo('{}')
      table.specificType('target_roles', 'text[]').notNullable().defaultTo('{}')
      table.timestamp('starts_at', { useTz: true }).nullable()
      table.timestamp('ends_at', { useTz: true }).nullable()
      table.timestamp('published_at', { useTz: true }).nullable()
      table
        .bigInteger('created_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table
        .bigInteger('updated_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.check(
        `kind IN ('general', 'event', 'curriculum', 'maintenance')`,
        [],
        'announcements_kind_check'
      )
      table.check(`status IN ('draft', 'published')`, [], 'announcements_status_check')
      table.check(`show_in_app OR show_public`, [], 'announcements_audience_check')
      table.check(
        `(status = 'published') = (published_at IS NOT NULL)`,
        [],
        'announcements_published_at_check'
      )
      table.check(
        `ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at`,
        [],
        'announcements_window_check'
      )
      table.check(
        `target_levels <@ ARRAY['sd', 'mi']::text[]`,
        [],
        'announcements_target_levels_check'
      )
      table.check(
        `target_roles <@ ARRAY['principal', 'operator', 'teacher', 'supervisor']::text[]`,
        [],
        'announcements_target_roles_check'
      )
      table.index(['status', 'show_in_app', 'starts_at'])
      table.index(['status', 'show_public', 'published_at'])
    })

    this.schema.createTable('announcement_reads', (table) => {
      table
        .bigInteger('announcement_id')
        .notNullable()
        .references('id')
        .inTable('announcements')
        .onDelete('CASCADE')
      table
        .bigInteger('user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.timestamp('read_at', { useTz: true }).notNullable()
      table.primary(['announcement_id', 'user_id'])
      table.index(['user_id'])
    })
  }

  async down() {
    this.schema.dropTable('announcement_reads')
    this.schema.dropTable('announcements')
  }
}
