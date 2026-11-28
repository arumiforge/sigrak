import { BaseSchema } from '@adonisjs/lucid/schema'
import { APP_ROLE, STAFF_ROLE } from '../../app/tenancy/database_roles.js'

/**
 * Database roles for the second tenancy wall (D-398, D-429).
 *
 * - `sigrak_app`: what the app runs as. Not the table owner, no
 *   BYPASSRLS, so row-level security always applies. Login users of
 *   the app are members of it.
 * - `sigrak_staff`: the only way past the school policies. The app's
 *   login user may switch to it with `SET LOCAL ROLE` inside one
 *   transaction (granted WITH INHERIT FALSE), never by default.
 *
 * Roles are cluster-wide: they are created only when missing and are
 * never dropped here, because other databases on the same server (test
 * databases, staging) use them too. If the migrating user cannot create
 * roles, the server setup creates them first and this migration only
 * grants.
 *
 * `app_school_id()` and `app_user_id()` read the tenant set by
 * `SET LOCAL` (set_config(..., true)) in the current transaction. A
 * pooled connection keeps the setting name after the transaction with
 * an empty value, so '' counts as "no tenant".
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
          BEGIN
            CREATE ROLE ${APP_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${STAFF_ROLE}') THEN
          BEGIN
            CREATE ROLE ${STAFF_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END;
        END IF;
        IF NOT pg_has_role('${STAFF_ROLE}', '${APP_ROLE}', 'MEMBER') THEN
          GRANT ${APP_ROLE} TO ${STAFF_ROLE};
        END IF;
      END
      $$
    `)

    this.schema.raw(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`)
    this.schema.raw(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`
    )
    this.schema.raw(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE}`)
    // Tables and sequences created later by the migrating user get the same grants.
    this.schema.raw(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_ROLE}`
    )
    this.schema.raw(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${APP_ROLE}`
    )
    // The migrations bookkeeping stays out of the app's reach.
    this.schema.raw(`REVOKE ALL ON adonis_schema, adonis_schema_versions FROM ${APP_ROLE}`)

    this.schema.raw(`
      CREATE FUNCTION app_school_id() RETURNS bigint
      LANGUAGE sql STABLE PARALLEL SAFE
      AS $$ SELECT nullif(current_setting('app.school_id', true), '')::bigint $$
    `)
    this.schema.raw(`
      CREATE FUNCTION app_user_id() RETURNS bigint
      LANGUAGE sql STABLE PARALLEL SAFE
      AS $$ SELECT nullif(current_setting('app.user_id', true), '')::bigint $$
    `)
  }

  async down() {
    this.schema.raw(`DROP FUNCTION IF EXISTS app_user_id()`)
    this.schema.raw(`DROP FUNCTION IF EXISTS app_school_id()`)
    this.schema.raw(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM ${APP_ROLE}`
    )
    this.schema.raw(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM ${APP_ROLE}`
    )
    this.schema.raw(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${APP_ROLE}`)
    this.schema.raw(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${APP_ROLE}`)
    this.schema.raw(`REVOKE USAGE ON SCHEMA public FROM ${APP_ROLE}`)
  }
}
