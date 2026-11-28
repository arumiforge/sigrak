import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Several staff roles per person, each with its own scope (D-338,
 * D-339, D-439), replacing the single `staff_users.role` of R1-05.
 *
 * - `staff_role_assignments`: one row per staff member and role. The
 *   scope is data the admin edits: region ids (province, kabupaten/kota
 *   or kecamatan), a named school list, levels (sd, mi) and fields
 *   (bidang). What a role may do stays in code (app/staff/powers.ts).
 *   Which scope parts a role uses, and what an empty scope means, is
 *   also code (app/staff/roles.ts). No school_id column: a row belongs
 *   to Tim SIGRAK, not to a school, so there is no RLS.
 * - The old roles move over with an empty scope (`admin`, `support`,
 *   `content` keep their meaning, D-339), then the column goes.
 * - `staff_users.disabled_at`: a disabled account cannot sign in;
 *   staff accounts are never deleted, so the log keeps its names.
 * - `staff_password_tokens`: the one-time link a new staff member uses
 *   to set a password (also sent again by an admin), hashed like the
 *   school invitations (D-182).
 * - `staff_activity_logs` takes the R2 subject types and gets indexes
 *   for the Log aktivitas filters.
 */
const ROLES = [
  'owner',
  'admin',
  'validator',
  'content',
  'curriculum',
  'support',
  'marketing',
  'sales',
  'regional_lead',
  'finance',
  'engineer',
  'researcher',
]

const SUBJECT_TYPES = [
  'school',
  'user',
  'setting',
  'invitation',
  'staff',
  'integration',
  'ai_model',
  'job',
  'announcement',
  'event',
  'story',
  'legal_document',
  'help_request',
  'support_session',
  'problem',
  'good_practice',
  'forum_meeting',
  'curriculum_version',
]

const list = (values: string[]) => values.map((value) => `'${value}'`).join(', ')

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('staff_role_assignments', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('staff_user_id')
        .notNullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('CASCADE')
      table.string('role', 20).notNullable()
      table.specificType('region_ids', 'bigint[]').notNullable().defaultTo('{}')
      table.specificType('school_ids', 'bigint[]').notNullable().defaultTo('{}')
      table.specificType('levels', 'text[]').notNullable().defaultTo('{}')
      table.specificType('fields', 'text[]').notNullable().defaultTo('{}')
      table
        .bigInteger('created_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['staff_user_id', 'role'])
      table.index(['role'])
      table.check(`role IN (${list(ROLES)})`, [], 'staff_role_assignments_role_check')
      table.check(`levels <@ ARRAY['sd', 'mi']::text[]`, [], 'staff_role_assignments_levels_check')
    })

    this.schema.raw(`
      INSERT INTO staff_role_assignments (staff_user_id, role, created_at, updated_at)
      SELECT id, role, now(), now() FROM staff_users
    `)

    this.schema.alterTable('staff_users', (table) => {
      table.dropChecks(['staff_users_role_check'])
      table.dropColumn('role')
      table.timestamp('disabled_at', { useTz: true }).nullable()
    })

    this.schema.createTable('staff_password_tokens', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('staff_user_id')
        .notNullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('CASCADE')
        .unique()
      table.string('token_hash', 64).notNullable().unique()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
    })

    this.schema.alterTable('staff_activity_logs', (table) => {
      table.dropChecks(['staff_activity_logs_subject_type_check'])
      table.check(
        `subject_type IN (${list(SUBJECT_TYPES)})`,
        [],
        'staff_activity_logs_subject_type_check'
      )
      table.index(['created_at'])
      table.index(['action'])
    })
  }

  async down() {
    this.schema.alterTable('staff_activity_logs', (table) => {
      table.dropIndex(['action'])
      table.dropIndex(['created_at'])
      table.dropChecks(['staff_activity_logs_subject_type_check'])
      table.check(
        `subject_type IN ('school', 'user', 'setting', 'invitation')`,
        [],
        'staff_activity_logs_subject_type_check'
      )
    })
    this.schema.dropTable('staff_password_tokens')
    this.schema.alterTable('staff_users', (table) => {
      table.dropColumn('disabled_at')
      table.string('role', 20).nullable()
    })
    this.schema.raw(`
      UPDATE staff_users u SET role = coalesce(
        (SELECT a.role FROM staff_role_assignments a
          WHERE a.staff_user_id = u.id AND a.role IN ('admin', 'support', 'content')
          ORDER BY array_position(ARRAY['admin', 'support', 'content'], a.role::text) LIMIT 1),
        'content')
    `)
    this.schema.alterTable('staff_users', (table) => {
      table.string('role', 20).notNullable().alter()
      table.check(`role IN ('admin', 'support', 'content')`, [], 'staff_users_role_check')
    })
    this.schema.dropTable('staff_role_assignments')
  }
}
