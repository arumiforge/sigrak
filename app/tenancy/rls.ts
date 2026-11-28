import {
  APP_ROLE,
  ENSURE_STAFF_READ_ROLE_SQL,
  STAFF_READ_ROLE,
  STAFF_ROLE,
} from './database_roles.js'

/**
 * SQL for row-level security on school-owned tables, for migrations:
 *
 * ```ts
 * for (const sql of schoolRls('classes')) this.schema.raw(sql)
 * ```
 *
 * Every school-owned table gets three policies: the school policy for
 * the app role (rows of the school set by `SET LOCAL app.school_id`,
 * nothing when it is unset), the staff policy for `sigrak_staff`, and
 * a SELECT-only policy for the read-only staff role (support, D-469).
 * `tests/functional/tenancy/rls_coverage.spec.ts` fails when a table
 * with a `school_id` column has RLS off or misses one of them.
 */
export function schoolRls(table: string, options: { userColumn?: string } = {}) {
  const own = options.userColumn
    ? `school_id = app_school_id() OR (${options.userColumn} = app_user_id())`
    : `school_id = app_school_id()`
  return [
    `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
    `CREATE POLICY ${table}_school ON ${table} FOR ALL TO ${APP_ROLE} USING (${own}) WITH CHECK (school_id = app_school_id())`,
    ...staffPolicy(table),
  ]
}

/**
 * Row-level security for a child table without `school_id`: a row is
 * visible and writable when its parent row is visible (the parent's
 * own policy filters the subquery). `writableWhen` narrows writes, for
 * parents that show shared rows (region calendars).
 */
export function childRls(
  table: string,
  parent: { table: string; foreignKey: string; writableWhen?: string }
) {
  const parentRow = `SELECT 1 FROM ${parent.table} p WHERE p.id = ${table}.${parent.foreignKey}`
  const visible = `EXISTS (${parentRow})`
  const writable = parent.writableWhen
    ? `EXISTS (${parentRow} AND (${parent.writableWhen}))`
    : visible
  return [
    `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`,
    `CREATE POLICY ${table}_school ON ${table} FOR ALL TO ${APP_ROLE} USING (${visible}) WITH CHECK (${writable})`,
    ...staffPolicy(table),
  ]
}

/**
 * The staff policies alone (full and read-only), for tables whose
 * school policy is written by hand. The read-only role is created first
 * when missing, so migrations older than its own still run on an empty
 * server.
 */
export function staffPolicy(table: string) {
  return [
    `CREATE POLICY ${table}_staff ON ${table} FOR ALL TO ${STAFF_ROLE} USING (true) WITH CHECK (true)`,
    ...staffReadPolicy(table),
  ]
}

/**
 * The read-only staff policy: every row is visible, nothing is
 * writable (the role has no write grants either).
 */
export function staffReadPolicy(table: string) {
  return [
    ENSURE_STAFF_READ_ROLE_SQL,
    `CREATE POLICY ${table}_staff_read ON ${table} FOR SELECT TO ${STAFF_READ_ROLE} USING (true)`,
  ]
}

/**
 * Undoes `schoolRls`, `childRls` or a hand-written pair (down migrations).
 */
export function dropRls(table: string) {
  return [
    `DROP POLICY IF EXISTS ${table}_staff_read ON ${table}`,
    `DROP POLICY IF EXISTS ${table}_staff ON ${table}`,
    `DROP POLICY IF EXISTS ${table}_school ON ${table}`,
    `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`,
  ]
}
