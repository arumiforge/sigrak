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
 * The connection that logs in as the app role (config/database.ts).
 */
export const TENANT_CONNECTION = 'tenant'

/**
 * Creates or updates the app's login user: a member of `sigrak_app`
 * (inherits its grants and the school policies) and of `sigrak_staff`
 * without inheritance, so staff access needs an explicit
 * `SET LOCAL ROLE`. Runs as a user that may create roles (the owner in
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
