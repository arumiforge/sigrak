import { BaseSchema } from '@adonisjs/lucid/schema'
import { dropRls, schoolRls } from '../../app/tenancy/rls.js'
import { APP_ROLE } from '../../app/tenancy/database_roles.js'

/**
 * Invitations: the only way into a school (data model: Accounts and
 * schools; D-182).
 *
 * - Only a SHA-256 hash of the mailed token is stored (`token_hash`,
 *   hex). A link is valid for 7 days (`expires_at`).
 * - Sending again to the same school, email and role renews the open
 *   row with a new token: at most one open row per school, email and
 *   role (partial unique index).
 * - `invited_by` is the operator (school app); `invited_by_staff_id`
 *   is Tim SIGRAK (console). At most one of them is set.
 * - Cancelling deletes the row (no soft deletes); an accepted row stays
 *   as the record of who joined, with `accepted_user_id`.
 *
 * School-owned, so RLS applies. Opening a link happens before there is
 * a session or a school: `invitation_school_id(token_hash)` is a narrow
 * SECURITY DEFINER lookup that returns only the school id of the row
 * with that hash. The app then reads the row inside a tenant
 * transaction for that school, where RLS applies as usual.
 */
export default class extends BaseSchema {
  protected tableName = 'invitations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('public_id').notNullable().unique()
      table
        .bigInteger('school_id')
        .notNullable()
        .references('id')
        .inTable('schools')
        .onDelete('CASCADE')
      table.string('email', 254).notNullable()
      table.string('role', 20).notNullable()
      table.string('token_hash', 64).notNullable().unique()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('sent_at', { useTz: true }).notNullable()
      table.integer('send_count').notNullable().defaultTo(1)
      table.timestamp('accepted_at', { useTz: true }).nullable()
      table
        .bigInteger('accepted_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .index()
      table
        .bigInteger('invited_by')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .index()
      table
        .bigInteger('invited_by_staff_id')
        .nullable()
        .references('id')
        .inTable('staff_users')
        .onDelete('SET NULL')
        .index()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['school_id', 'accepted_at'])
      table.check(`role IN ('principal', 'operator', 'teacher')`, [], 'invitations_role_check')
      table.check(`email = lower(email)`, [], 'invitations_email_lower_check')
      table.check(
        `invited_by IS NULL OR invited_by_staff_id IS NULL`,
        [],
        'invitations_one_inviter_check'
      )
      table.check(
        `accepted_at IS NOT NULL OR accepted_user_id IS NULL`,
        [],
        'invitations_accepted_check'
      )
    })

    this.schema.raw(
      `CREATE UNIQUE INDEX invitations_open_unique ON invitations (school_id, email, role) WHERE accepted_at IS NULL`
    )

    for (const sql of schoolRls(this.tableName)) {
      this.schema.raw(sql)
    }

    this.schema.raw(`
      CREATE FUNCTION invitation_school_id(p_token_hash text) RETURNS bigint
      LANGUAGE sql STABLE SECURITY DEFINER
      SET search_path = pg_catalog, public
      AS $$ SELECT school_id FROM invitations WHERE token_hash = p_token_hash $$
    `)
    this.schema.raw(`REVOKE ALL ON FUNCTION invitation_school_id(text) FROM PUBLIC`)
    this.schema.raw(`GRANT EXECUTE ON FUNCTION invitation_school_id(text) TO ${APP_ROLE}`)
  }

  async down() {
    this.schema.raw(`DROP FUNCTION IF EXISTS invitation_school_id(text)`)
    for (const sql of dropRls(this.tableName)) {
      this.schema.raw(sql)
    }
    this.schema.dropTable(this.tableName)
  }
}
