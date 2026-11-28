import type { Assert } from '@japa/assert'
import { DateTime } from 'luxon'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import type School from '#models/school'
import User from '#models/user'
import SchoolMembership from '#models/school_membership'
import { createSchool, PASSWORD } from '#tests/helpers'
import { ensureAppLoginRole } from '#tenancy/database_roles'
import { SchoolContext } from '#tenancy/school_context'
import { tenantTransaction } from '#tenancy/tenant_transaction'

/**
 * Test helpers for tenancy: two schools, and the IDOR assertions every
 * school-owned resource uses (school A never reads school B).
 *
 * Data for tests that use the tenant connection must be committed, so
 * those groups use `testUtils.db().truncate()`, not a global
 * transaction (a global transaction is invisible to other connections).
 */

/**
 * Creates the app's login user for the tenant connection (runner setup,
 * after the migrations made the sigrak_app and sigrak_staff roles). The
 * migrating user must be allowed to create roles: the local and CI
 * `sigrak` user is a superuser.
 */
export async function prepareTenantLogin() {
  await ensureAppLoginRole(db.connection(), {
    user: env.get('DB_APP_USER', 'sigrak_app_user'),
    password: env.get('DB_APP_PASSWORD')?.release() ?? 'sigrak_app',
  })
}

let counter = 0

export interface TenantFixture {
  school: School
  user: User
  membership: SchoolMembership
}

/**
 * A user with an active membership in a school (owner connection, so
 * it bypasses the walls under test).
 */
export async function createMember(
  school: School,
  role: SchoolMembership['role'] = 'teacher',
  user?: User
): Promise<TenantFixture> {
  const member =
    user ??
    (await User.create({
      name: 'Anggota Uji',
      email: `anggota-${Date.now().toString(36)}${(counter++).toString(36)}@uji.test`,
      password: PASSWORD,
      nip: null,
    }))
  const membership = await SchoolMembership.create({
    schoolId: school.id,
    userId: member.id,
    role,
    status: 'active',
    startedOn: DateTime.fromISO('2026-07-01'),
  })
  return { school, user: member, membership }
}

/**
 * School A and school B, each with one teacher.
 */
export async function createTwoSchools() {
  const a = await createMember(await createSchool('SD Uji A'))
  const b = await createMember(await createSchool('SD Uji B'))
  return { a, b }
}

/**
 * Runs `work` as a request or job of `school` would: inside its school
 * context and one tenant transaction.
 */
export function asSchool<T>(school: School, work: () => Promise<T>, userId: number | null = null) {
  return SchoolContext.runFor(school.id, () => tenantTransaction(() => work()), userId)
}

/**
 * IDOR assertion through the app: inside `viewer`'s context, `read`
 * (for example `() => Model.find(rowOfOtherSchool.id)`) must give
 * nothing: null, an empty list, or a 404 error.
 */
export async function assertSchoolCannotRead(
  assert: Assert,
  viewer: School,
  read: () => Promise<unknown>
) {
  let result: unknown
  try {
    result = await asSchool(viewer, read)
  } catch (error) {
    assert.equal((error as { status?: number }).status, 404, String(error))
    return
  }
  if (Array.isArray(result)) {
    assert.lengthOf(result, 0, 'another school’s rows were returned')
  } else {
    assert.isNull(result, 'another school’s row was returned')
  }
}

/**
 * IDOR assertion at the database wall: inside `viewer`'s tenant
 * transaction, a raw SELECT that skips every app scope finds none of
 * the given rows of `table`.
 */
export async function assertRlsHides(assert: Assert, viewer: School, table: string, ids: number[]) {
  const rows = await asSchool(viewer, async () => {
    const trx = SchoolContext.current()!.trx!
    const result = await trx.rawQuery(`SELECT id FROM ${table} WHERE id = ANY(?)`, [ids])
    return result.rows as { id: number }[]
  })
  assert.deepEqual(rows, [], `${table} rows of another school are visible`)
}
