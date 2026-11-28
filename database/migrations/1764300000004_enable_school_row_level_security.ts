import { BaseSchema } from '@adonisjs/lucid/schema'
import { childRls, dropRls, schoolRls, staffPolicy } from '../../app/tenancy/rls.js'
import { APP_ROLE } from '../../app/tenancy/database_roles.js'

/**
 * Row-level security on every school-owned table (D-398): the second
 * wall behind the app's school scope. The app role sees only rows of
 * the school set with `SET LOCAL app.school_id` in the current
 * transaction; without it, none. `sigrak_staff` passes.
 *
 * Special cases:
 * - school_memberships and supervisor_assignments: a user also sees
 *   their own rows in any school (the active membership is picked
 *   before a school is chosen; a supervisor lists their schools).
 * - calendars: region reference calendars (school_id NULL) are
 *   readable by every school; only staff write them.
 * - generations and ai_usage_logs: school_id is NULL for a teacher
 *   without a school (R0-06 spike); those rows belong to the user.
 * - calendar_events, exam_participants, generation_steps follow their
 *   parent row.
 *
 * schools, users, regions and staff_users have no policies: they are
 * not owned by one school. ai_credentials are per user (D-012), not
 * per school; per-user RLS is left for the AI slice.
 */
export default class extends BaseSchema {
  async up() {
    const statements = [
      ...schoolRls('school_memberships', { userColumn: 'user_id' }),
      ...schoolRls('supervisor_assignments', { userColumn: 'user_id' }),
      ...schoolRls('exam_sessions'),
      ...childRls('exam_participants', { table: 'exam_sessions', foreignKey: 'exam_session_id' }),

      `ALTER TABLE calendars ENABLE ROW LEVEL SECURITY`,
      `CREATE POLICY calendars_school ON calendars FOR ALL TO ${APP_ROLE}
         USING (school_id = app_school_id() OR school_id IS NULL)
         WITH CHECK (school_id = app_school_id())`,
      ...staffPolicy('calendars'),
      ...childRls('calendar_events', {
        table: 'calendars',
        foreignKey: 'calendar_id',
        writableWhen: 'p.school_id = app_school_id()',
      }),

      ...['generations', 'ai_usage_logs'].flatMap((table) => [
        `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
        `CREATE POLICY ${table}_school ON ${table} FOR ALL TO ${APP_ROLE}
           USING (school_id = app_school_id() OR (school_id IS NULL AND user_id = app_user_id()))
           WITH CHECK (school_id = app_school_id() OR (school_id IS NULL AND user_id = app_user_id()))`,
        ...staffPolicy(table),
      ]),
      ...childRls('generation_steps', { table: 'generations', foreignKey: 'generation_id' }),
    ]
    for (const sql of statements) {
      this.schema.raw(sql)
    }
  }

  async down() {
    const tables = [
      'generation_steps',
      'ai_usage_logs',
      'generations',
      'calendar_events',
      'calendars',
      'exam_participants',
      'exam_sessions',
      'supervisor_assignments',
      'school_memberships',
    ]
    for (const sql of tables.flatMap((table) => dropRls(table))) {
      this.schema.raw(sql)
    }
  }
}
