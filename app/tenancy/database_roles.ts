import type { QueryClientContract } from '@adonisjs/lucid/types/database'

/**
 * The group role the app runs as: not the table owner and without
 * BYPASSRLS, so row-level security always applies.
 */
export const APP_ROLE = 'sigrak_app'

/**
 * The only role that passes the school policies. Reached with
 * `SET LOCAL ROLE` inside one transaction (see `staffTransaction`).
 */
export const STAFF_ROLE = 'sigrak_staff'

/**
 * Read-only staff (support, D-469): SELECT only, and a SELECT policy on
 * every school table, so it sees every school but cannot change a row.
 * Reached with `SET LOCAL ROLE` inside one transaction (see
 * `staffReadTransaction`). Not a member of `sigrak_app`, so it inherits
 * none of the app's write grants.
 */
export const STAFF_READ_ROLE = 'sigrak_staff_readonly'

/**
 * Tables the read-only staff role may not read even though it reads
 * everything else: mailed-link hashes, AI keys, migration bookkeeping.
 * A later table with secrets is added here and revoked in its migration.
 */
export const STAFF_READ_HIDDEN_TABLES = [
  'adonis_schema',
  'adonis_schema_versions',
  'password_reset_tokens',
  'email_confirmation_tokens',
  'ai_credentials',
] as const

/**
 * SQL that creates the read-only staff role when it is missing (roles
 * are cluster-wide and never dropped). Used by its migration and by the
 * RLS helpers, so a policy for it can always be created.
 */
export const ENSURE_STAFF_READ_ROLE_SQL = `
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${STAFF_READ_ROLE}') THEN
      BEGIN
        CREATE ROLE ${STAFF_READ_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END
  $$
`

/**
 * The connection that logs in as the app role (config/database.ts).
 */
export const TENANT_CONNECTION = 'tenant'

/**
 * Creates or updates the app's login user: a member of `sigrak_app`
 * (inherits its grants and the school policies) and of `sigrak_staff`
 * and `sigrak_staff_readonly` without inheritance, so staff access
 * needs an explicit `SET LOCAL ROLE`. Runs as a user that may create roles (the owner in
 * tests and CI; the server setup in production). Safe to run again and
 * from parallel test runs.
 */
export async function ensureAppLoginRole(
  client: QueryClientContract,
  login: { user: string; password: string }
) {
  const exists = await client.rawQuery('SELECT 1 FROM pg_roles WHERE rolname = ?', [login.user])
  const verb = exists.rows.length > 0 ? 'ALTER' : 'CREATE'
  const statement = await client.rawQuery(
    `SELECT format('${verb} ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB', ?::text, ?::text) AS sql`,
    [login.user, login.password]
  )
  try {
    await client.rawQuery(statement.rows[0].sql)
  } catch (error) {
    // Another test run created it between the check and the CREATE.
    if ((error as { code?: string }).code !== '42710') throw error
  }

  const quoted = await client.rawQuery('SELECT quote_ident(?) AS name', [login.user])
  const name = quoted.rows[0].name as string
  // Granted every time, so a membership made with other options is corrected.
  await retryCatalogRace(() => client.rawQuery(`GRANT ${APP_ROLE} TO ${name} WITH INHERIT TRUE`))
  await retryCatalogRace(() =>
    client.rawQuery(`GRANT ${STAFF_ROLE} TO ${name} WITH INHERIT FALSE, SET TRUE`)
  )
  await retryCatalogRace(() =>
    client.rawQuery(`GRANT ${STAFF_READ_ROLE} TO ${name} WITH INHERIT FALSE, SET TRUE`)
  )
}

/**
 * Parallel test runs on one server may update the same role catalog
 * row at once ("tuple concurrently updated"); a retry settles it.
 */
async function retryCatalogRace<T>(run: () => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      if (attempt >= attempts || (error as { code?: string }).code !== 'XX000') throw error
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt))
    }
  }
}
