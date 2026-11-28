import { BaseSchema } from '@adonisjs/lucid/schema'
import {
  ENSURE_STAFF_READ_ROLE_SQL,
  STAFF_READ_HIDDEN_TABLES,
  STAFF_READ_ROLE,
} from '../../app/tenancy/database_roles.js'

/**
 * The read-only staff role for support (D-469, R1-01 open question 1):
 * `sigrak_staff_readonly` may SELECT every table except the hidden ones
 * (link hashes, AI keys, migration bookkeeping) and has a SELECT policy
 * on every table with row-level security, so it passes the school
 * rules for reading only. It has no INSERT, UPDATE or DELETE grant and
 * is not a member of `sigrak_app`; changes go through an admin (full
 * `sigrak_staff`). The app's login reaches it with `SET LOCAL ROLE`
 * (`staffReadTransaction`).
 *
 * The RLS helpers (app/tenancy/rls.ts) add the read policy to tables
 * made later; this migration adds it to the tables that exist now.
 * The role is cluster-wide and never dropped.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(ENSURE_STAFF_READ_ROLE_SQL)
    this.schema.raw(`GRANT USAGE ON SCHEMA public TO ${STAFF_READ_ROLE}`)
    this.schema.raw(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${STAFF_READ_ROLE}`)
    this.schema.raw(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${STAFF_READ_ROLE}`
    )
    for (const table of STAFF_READ_HIDDEN_TABLES) {
      this.schema.raw(`
        DO $$
        BEGIN
          IF to_regclass('public.${table}') IS NOT NULL THEN
            REVOKE ALL ON public.${table} FROM ${STAFF_READ_ROLE};
          END IF;
        END
        $$
      `)
    }

    // A read policy on every table with RLS that has none yet.
    this.schema.raw(`
      DO $$
      DECLARE t text;
      BEGIN
        FOR t IN
          SELECT c.relname FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
           WHERE c.relkind = 'r' AND c.relrowsecurity
             AND NOT EXISTS (
               SELECT 1 FROM pg_policy p
                WHERE p.polrelid = c.oid AND p.polname = c.relname || '_staff_read')
        LOOP
          EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR SELECT TO ${STAFF_READ_ROLE} USING (true)',
            t || '_staff_read', t);
        END LOOP;
      END
      $$
    `)
  }

  async down() {
    this.schema.raw(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT p.polname, c.relname FROM pg_policy p
            JOIN pg_class c ON c.oid = p.polrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
           WHERE p.polname = c.relname || '_staff_read'
        LOOP
          EXECUTE format('DROP POLICY %I ON public.%I', r.polname, r.relname);
        END LOOP;
      END
      $$
    `)
    this.schema.raw(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM ${STAFF_READ_ROLE}`
    )
    this.schema.raw(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${STAFF_READ_ROLE}`)
    this.schema.raw(`REVOKE USAGE ON SCHEMA public FROM ${STAFF_READ_ROLE}`)
  }
}
