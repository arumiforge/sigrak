import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

/**
 * Tables owned by one school through a parent row, without their own
 * school_id. Add a child table here when its migration adds childRls().
 */
const CHILD_TABLES = ['calendar_events', 'catalog_items', 'exam_participants', 'generation_steps']

/**
 * Guards every later migration: a table with a school_id column (or a
 * listed child table) must have row-level security on, a policy for
 * sigrak_app, one for sigrak_staff and a read policy for
 * sigrak_staff_readonly (app/tenancy/rls.ts, D-469).
 */
test.group('Tenancy | RLS coverage', () => {
  test('every school-owned table has RLS and the three policies', async ({ assert }) => {
    const result = await db.rawQuery(
      `SELECT c.relname AS table,
              c.relrowsecurity AS rls,
              coalesce(array_agg(DISTINCT r.rolname::text) FILTER (WHERE r.rolname IS NOT NULL), '{}') AS roles
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
         LEFT JOIN pg_policy p ON p.polrelid = c.oid
         LEFT JOIN pg_roles r ON r.oid = ANY(p.polroles)
        WHERE c.relkind = 'r'
          AND (c.relname = ANY(?) OR EXISTS (
                SELECT 1 FROM pg_attribute a
                 WHERE a.attrelid = c.oid AND a.attname = 'school_id' AND NOT a.attisdropped))
        GROUP BY c.relname, c.relrowsecurity
        ORDER BY c.relname`,
      [CHILD_TABLES]
    )
    const tables = result.rows as { table: string; rls: boolean; roles: string[] }[]

    assert.isAbove(tables.length, CHILD_TABLES.length)
    for (const row of tables) {
      assert.isTrue(row.rls, `${row.table}: row-level security is off`)
      assert.includeMembers(
        row.roles,
        ['sigrak_app', 'sigrak_staff', 'sigrak_staff_readonly'],
        `${row.table}: policies`
      )
    }
  })

  test('the app role cannot bypass RLS and does not own the tables', async ({ assert }) => {
    const roles = await db.rawQuery(
      `SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles
        WHERE rolname IN ('sigrak_app', 'sigrak_staff', 'sigrak_staff_readonly') ORDER BY rolname`
    )
    assert.deepEqual(roles.rows, [
      { rolname: 'sigrak_app', rolsuper: false, rolbypassrls: false, rolcanlogin: false },
      { rolname: 'sigrak_staff', rolsuper: false, rolbypassrls: false, rolcanlogin: false },
      {
        rolname: 'sigrak_staff_readonly',
        rolsuper: false,
        rolbypassrls: false,
        rolcanlogin: false,
      },
    ])

    const owned = await db.rawQuery(
      `SELECT count(*)::int AS count FROM pg_tables
        WHERE schemaname = 'public'
          AND tableowner IN ('sigrak_app', 'sigrak_staff', 'sigrak_staff_readonly')`
    )
    assert.equal(owned.rows[0].count, 0)
  })
})
