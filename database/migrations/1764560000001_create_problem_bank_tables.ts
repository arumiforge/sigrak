import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, staffPolicy } from '../../app/tenancy/rls.js'
import { APP_ROLE } from '../../app/tenancy/database_roles.js'

/**
 * Bank Masalah, Bank Praktik Baik and the Forum Masalah→Solusi (R2-07,
 * D-439, D-477).
 *
 * - `problems`: one problem in staff's own words. `source` is where it
 *   came from (a help request, a field note from a visit or chat, a
 *   webinar, other), `region_id` the kabupaten/kota it is about and
 *   `level` SD or MI (both optional). `status` runs new → triaged →
 *   analysed → decided → in_progress → released → closed (Baru,
 *   Dipilah, Dianalisis, Diputuskan, Dikerjakan, Rilis, Ditutup).
 *   `merged_into_id` marks a duplicate closed into another problem.
 *   `release_note` is the staff-written line the reporters read when
 *   it ships.
 * - `problem_reports`: the reporters, one row per help request linked
 *   to a problem (a request belongs to at most one problem; merging
 *   moves the rows). `notified_at` is set when the reporter was told
 *   about the release, so nobody is told twice.
 * - `problem_analyses`: Tim Kurikulum & Riset's root cause, regulation
 *   check and evidence links, with the researchers credited (staff and
 *   named outside contributors, F-034).
 * - `forum_meetings` and `forum_decisions`: the fortnightly forum, its
 *   agenda (one row per problem, in order) and the owner's decision on
 *   each item (`go`, `decline`, `defer`).
 * - `good_practices`: Bank Praktik Baik (practice, PTK, skripsi,
 *   seminar, webinar) with its authors credited and a link.
 *
 * None of these tables has a school column; they are staff records.
 * Row-level security is on with a policy that matches no row for the
 * app role, so only the console (staff roles) reads or writes them.
 */
const TABLES = [
  'problems',
  'problem_reports',
  'problem_analyses',
  'forum_meetings',
  'forum_decisions',
  'good_practices',
] as const

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('problems', (table) => {
      table.bigIncrements('id')
      table.string('title', 160).notNullable()
      table.text('description').notNullable()
      table.string('source', 20).notNullable()
      table
        .bigInteger('region_id')
        .nullable()
        .references('id')
        .inTable('regions')
        .onDelete('SET NULL')
      table.string('level', 2).nullable()
      table.string('status', 20).notNullable().defaultTo('new')
      table.timestamp('status_changed_at', { useTz: true }).notNullable()
      table
        .bigInteger('merged_into_id')
        .nullable()
        .references('id')
        .inTable('problems')
        .onDelete('SET NULL')
      table.text('release_note').nullable()
      table
        .bigInteger('recorded_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['status', 'created_at'])
      table.index(['region_id'])
      table.index(['merged_into_id'])
      table.check(
        `status IN ('new', 'triaged', 'analysed', 'decided', 'in_progress', 'released', 'closed')`,
        [],
        'problems_status_check'
      )
      table.check(
        `source IN ('help_request', 'field_note', 'webinar', 'other')`,
        [],
        'problems_source_check'
      )
      table.check(`level IS NULL OR level IN ('sd', 'mi')`, [], 'problems_level_check')
      table.check(`char_length(title) BETWEEN 3 AND 160`, [], 'problems_title_check')
      table.check(`char_length(description) BETWEEN 10 AND 4000`, [], 'problems_description_check')
      table.check(
        `release_note IS NULL OR char_length(release_note) <= 1000`,
        [],
        'problems_release_note_check'
      )
      table.check(
        `merged_into_id IS NULL OR (status = 'closed' AND merged_into_id <> id)`,
        [],
        'problems_merged_check'
      )
    })

    this.schema.createTable('problem_reports', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('problem_id')
        .notNullable()
        .references('id')
        .inTable('problems')
        .onDelete('CASCADE')
      table
        .bigInteger('help_request_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('help_requests')
        .onDelete('CASCADE')
      table
        .bigInteger('linked_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('notified_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['problem_id'])
    })

    this.schema.createTable('problem_analyses', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('problem_id')
        .notNullable()
        .references('id')
        .inTable('problems')
        .onDelete('CASCADE')
      table.text('root_cause').notNullable()
      table.text('regulations').nullable()
      table.specificType('evidence_links', 'text[]').notNullable().defaultTo('{}')
      table
        .bigInteger('author_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.specificType('credited_staff_ids', 'bigint[]').notNullable().defaultTo('{}')
      table.specificType('credited_names', 'text[]').notNullable().defaultTo('{}')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['problem_id', 'created_at'])
      table.check(
        `char_length(root_cause) BETWEEN 10 AND 4000`,
        [],
        'problem_analyses_root_cause_check'
      )
      table.check(
        `regulations IS NULL OR char_length(regulations) <= 2000`,
        [],
        'problem_analyses_regulations_check'
      )
      table.check(`cardinality(evidence_links) <= 10`, [], 'problem_analyses_evidence_links_check')
      table.check(
        `cardinality(credited_staff_ids) + cardinality(credited_names) BETWEEN 1 AND 20`,
        [],
        'problem_analyses_credits_check'
      )
    })

    this.schema.createTable('forum_meetings', (table) => {
      table.bigIncrements('id')
      table.date('held_on').notNullable()
      table.string('status', 10).notNullable().defaultTo('planned')
      table.text('notes').nullable()
      table.timestamp('held_at', { useTz: true }).nullable()
      table
        .bigInteger('created_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['held_on'])
      table.check(`status IN ('planned', 'held')`, [], 'forum_meetings_status_check')
      table.check(`(status = 'held') = (held_at IS NOT NULL)`, [], 'forum_meetings_held_check')
      table.check(`notes IS NULL OR char_length(notes) <= 8000`, [], 'forum_meetings_notes_check')
    })

    this.schema.createTable('forum_decisions', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('meeting_id')
        .notNullable()
        .references('id')
        .inTable('forum_meetings')
        .onDelete('CASCADE')
      table
        .bigInteger('problem_id')
        .notNullable()
        .references('id')
        .inTable('problems')
        .onDelete('CASCADE')
      table.integer('position').notNullable()
      table.string('outcome', 10).nullable()
      table.text('note').nullable()
      table
        .bigInteger('added_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table
        .bigInteger('decided_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('decided_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.unique(['meeting_id', 'problem_id'])
      table.index(['problem_id'])
      table.check(
        `outcome IS NULL OR outcome IN ('go', 'decline', 'defer')`,
        [],
        'forum_decisions_outcome_check'
      )
      table.check(`(outcome IS NULL) = (decided_at IS NULL)`, [], 'forum_decisions_decided_check')
      table.check(`note IS NULL OR char_length(note) <= 1000`, [], 'forum_decisions_note_check')
    })

    this.schema.createTable('good_practices', (table) => {
      table.bigIncrements('id')
      table.string('title', 160).notNullable()
      table.text('summary').notNullable()
      table.string('type', 20).notNullable()
      table.specificType('authors', 'text[]').notNullable()
      table.string('link', 500).nullable()
      table.string('level', 2).nullable()
      table.smallint('year').nullable()
      table
        .bigInteger('problem_id')
        .nullable()
        .references('id')
        .inTable('problems')
        .onDelete('SET NULL')
      table
        .bigInteger('added_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['type', 'created_at'])
      table.index(['problem_id'])
      table.check(
        `type IN ('practice', 'classroom_research', 'thesis', 'seminar', 'webinar')`,
        [],
        'good_practices_type_check'
      )
      table.check(`level IS NULL OR level IN ('sd', 'mi')`, [], 'good_practices_level_check')
      table.check(`char_length(title) BETWEEN 3 AND 160`, [], 'good_practices_title_check')
      table.check(`char_length(summary) BETWEEN 10 AND 2000`, [], 'good_practices_summary_check')
      table.check(`cardinality(authors) BETWEEN 1 AND 10`, [], 'good_practices_authors_check')
      table.check(`link IS NULL OR link ~ '^https{0,1}://'`, [], 'good_practices_link_check')
      table.check(`year IS NULL OR year BETWEEN 1945 AND 2100`, [], 'good_practices_year_check')
    })

    for (const table of TABLES) {
      for (const sql of [
        `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
        `CREATE POLICY ${table}_school ON ${table} FOR ALL TO ${APP_ROLE}
           USING (false) WITH CHECK (false)`,
        ...staffPolicy(table),
      ]) {
        this.schema.raw(sql)
      }
    }
  }

  async down() {
    for (const table of [...TABLES].reverse()) {
      for (const sql of dropRls(table)) this.schema.raw(sql)
      this.schema.dropTable(table)
    }
  }
}
