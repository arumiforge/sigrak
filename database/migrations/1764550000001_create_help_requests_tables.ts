import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, staffPolicy } from '../../app/tenancy/rls.js'
import { APP_ROLE } from '../../app/tenancy/database_roles.js'

/**
 * Minta Bantuan and support sessions (R2-06, D-320, D-341).
 *
 * - `help_requests`: one request from a school user. `school_id` is the
 *   school the sender acted for, NULL for a teacher without a school
 *   (D-459); `membership_role` the role they acted as. `category` is
 *   one of the form's categories, `page_url` the app path the sender
 *   was on. `status` new / in_progress / done (Baru, Diproses,
 *   Selesai), `assignee_staff_id` the staff member handling it.
 *   `sender_unread_at` is set when staff reply or change the status and
 *   cleared when the sender opens the request (the in-app notice).
 * - `help_request_notes`: the request's timeline. `reply` is an answer
 *   the sender reads, `status` a status change the sender sees, `note`
 *   an internal staff note the sender never sees (not even through
 *   RLS). `emailed` marks a reply that was also mailed.
 * - `support_sessions`: one internal row per support session (staff,
 *   school, start, end; D-341). Not shown to schools: the app role has
 *   a policy that matches no row.
 *
 * RLS: a school reads only its own requests; a request without a
 * school belongs to its sender (the generations pattern of R1-01).
 * Notes follow their request, without internal notes, and only staff
 * write them. Staff and read-only staff policies as on every school
 * table.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('help_requests', (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique()
      table
        .bigInteger('school_id')
        .nullable()
        .references('id')
        .inTable('schools')
        .onDelete('CASCADE')
      table.bigInteger('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.string('membership_role', 20).nullable()
      table.string('category', 30).notNullable()
      table.text('message').notNullable()
      table.string('page_url', 500).nullable()
      table.string('status', 20).notNullable().defaultTo('new')
      table.timestamp('status_changed_at', { useTz: true }).notNullable()
      table
        .bigInteger('assignee_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('sender_unread_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['school_id', 'created_at'])
      table.index(['user_id', 'created_at'])
      table.index(['status', 'created_at'])
      table.index(['assignee_staff_id'])
      table.check(`status IN ('new', 'in_progress', 'done')`, [], 'help_requests_status_check')
      table.check(
        `category IN ('account', 'school_data', 'content', 'ai_key', 'exam', 'payment', 'other')`,
        [],
        'help_requests_category_check'
      )
      table.check(
        `membership_role IS NULL OR membership_role IN ('principal', 'operator', 'teacher')`,
        [],
        'help_requests_membership_role_check'
      )
      table.check(`char_length(message) BETWEEN 10 AND 2000`, [], 'help_requests_message_check')
      table.check(`page_url IS NULL OR left(page_url, 1) = '/'`, [], 'help_requests_page_url_check')
    })

    this.schema.createTable('help_request_notes', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('help_request_id')
        .notNullable()
        .references('id')
        .inTable('help_requests')
        .onDelete('CASCADE')
      table
        .bigInteger('staff_user_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.string('kind', 10).notNullable()
      table.text('body').nullable()
      table.string('status', 20).nullable()
      table.boolean('emailed').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['help_request_id', 'created_at'])
      table.check(`kind IN ('reply', 'note', 'status')`, [], 'help_request_notes_kind_check')
      table.check(`(kind = 'status') = (status IS NOT NULL)`, [], 'help_request_notes_status_check')
      table.check(
        `status IS NULL OR status IN ('new', 'in_progress', 'done')`,
        [],
        'help_request_notes_status_value_check'
      )
      table.check(
        `kind = 'status' OR char_length(body) BETWEEN 1 AND 4000`,
        [],
        'help_request_notes_body_check'
      )
    })

    this.schema.createTable('support_sessions', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('staff_user_id')
        .notNullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('CASCADE')
      table
        .bigInteger('school_id')
        .notNullable()
        .references('id')
        .inTable('schools')
        .onDelete('CASCADE')
      table.timestamp('started_at', { useTz: true }).notNullable()
      table.timestamp('ended_at', { useTz: true }).nullable()

      table.index(['started_at'])
      table.index(['school_id', 'started_at'])
      table.check(`ended_at IS NULL OR ended_at >= started_at`, [], 'support_sessions_ended_check')
    })
    // At most one open session per staff member.
    this.schema.raw(
      `CREATE UNIQUE INDEX support_sessions_open_unique ON support_sessions (staff_user_id) WHERE ended_at IS NULL`
    )

    const statements = [
      `ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY`,
      `CREATE POLICY help_requests_school ON help_requests FOR ALL TO ${APP_ROLE}
         USING (school_id = app_school_id() OR (school_id IS NULL AND user_id = app_user_id()))
         WITH CHECK (school_id = app_school_id() OR (school_id IS NULL AND user_id = app_user_id()))`,
      ...staffPolicy('help_requests'),

      `ALTER TABLE help_request_notes ENABLE ROW LEVEL SECURITY`,
      `CREATE POLICY help_request_notes_school ON help_request_notes FOR SELECT TO ${APP_ROLE}
         USING (kind <> 'note' AND EXISTS (
           SELECT 1 FROM help_requests p WHERE p.id = help_request_notes.help_request_id))`,
      ...staffPolicy('help_request_notes'),

      `ALTER TABLE support_sessions ENABLE ROW LEVEL SECURITY`,
      `CREATE POLICY support_sessions_school ON support_sessions FOR ALL TO ${APP_ROLE}
         USING (false) WITH CHECK (false)`,
      ...staffPolicy('support_sessions'),
    ]
    for (const sql of statements) {
      this.schema.raw(sql)
    }
  }

  async down() {
    for (const table of ['support_sessions', 'help_request_notes', 'help_requests']) {
      for (const sql of dropRls(table)) this.schema.raw(sql)
      this.schema.dropTable(table)
    }
  }
}
