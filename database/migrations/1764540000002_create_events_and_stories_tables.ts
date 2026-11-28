import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Acara and Cerita Sekolah on sigrak.com (D-435, R2-05), written in the
 * console. Bodies are Markdown, rendered through the allowlist renderer
 * (app/publishing/markdown.ts).
 *
 * - `events`: a webinar, workshop or visit with its date and time, a
 *   place or an online link (at least one), and an optional
 *   registration link.
 * - `stories`: a school's story. The school is named only with its
 *   consent, so the consent note (who agreed, how) and its date are
 *   required. Photos come later.
 *
 * Neither table has a school_id (a story names the school as text,
 * with consent), so there is no RLS.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('events', (table) => {
      table.bigIncrements('id')
      table.string('slug', 120).notNullable().unique()
      table.string('title', 200).notNullable()
      table.string('summary', 300).nullable()
      table.text('body').notNullable().defaultTo('')
      table.timestamp('starts_at', { useTz: true }).notNullable()
      table.timestamp('ends_at', { useTz: true }).nullable()
      table.string('place', 200).nullable()
      table.string('online_url', 500).nullable()
      table.string('registration_url', 500).nullable()
      table.string('status', 10).notNullable().defaultTo('draft')
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

      table.check(`status IN ('draft', 'published')`, [], 'events_status_check')
      table.check(
        `(status = 'published') = (published_at IS NOT NULL)`,
        [],
        'events_published_at_check'
      )
      table.check(`place IS NOT NULL OR online_url IS NOT NULL`, [], 'events_where_check')
      table.check(`ends_at IS NULL OR ends_at > starts_at`, [], 'events_window_check')
      table.index(['status', 'starts_at'])
    })

    this.schema.createTable('stories', (table) => {
      table.bigIncrements('id')
      table.string('slug', 120).notNullable().unique()
      table.string('title', 200).notNullable()
      table.string('summary', 300).nullable()
      table.text('body').notNullable()
      table.string('school_name', 200).notNullable()
      table.string('consent_note', 500).notNullable()
      table.date('consent_on').notNullable()
      table.string('status', 10).notNullable().defaultTo('draft')
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

      table.check(`status IN ('draft', 'published')`, [], 'stories_status_check')
      table.check(
        `(status = 'published') = (published_at IS NOT NULL)`,
        [],
        'stories_published_at_check'
      )
      table.index(['status', 'published_at'])
    })
  }

  async down() {
    this.schema.dropTable('stories')
    this.schema.dropTable('events')
  }
}
