import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import type School from '#models/school'
import type User from '#models/user'
import { createCalendar, createParticipant, testRegions } from '#tests/helpers'
import { assertRlsHides, asSchool, createMember, createTwoSchools } from '#tests/tenancy'
import { syncLayerDomains } from '#layers/domains/registry'
import { STAFF_READ_ROLE, TENANT_CONNECTION } from '#tenancy/database_roles'
import { SchoolContext } from '#tenancy/school_context'
import {
  staffReadTransaction,
  staffTransaction,
  tenantTransaction,
} from '#tenancy/tenant_transaction'

/**
 * Rows of every school-owned table for one school, written on the owner
 * connection (it bypasses RLS).
 */
async function seedSchoolRows(school: School, user: User) {
  const participant = await createParticipant(school)
  const calendar = await createCalendar(school, ['Acara sekolah'])
  const now = new Date()
  const [generation] = await db
    .table('generations')
    .insert({
      public_id: randomUUID(),
      school_id: school.id,
      user_id: user.id,
      template_key: 'uji',
      template_version: 1,
      client_token: randomUUID(),
      specification: {},
      created_at: now,
      updated_at: now,
    })
    .returning('id')
  const [step] = await db
    .table('generation_steps')
    .insert({
      generation_id: generation.id,
      step_key: 'content',
      position: 1,
      created_at: now,
      updated_at: now,
    })
    .returning('id')
  const [usage] = await db
    .table('ai_usage_logs')
    .insert({
      user_id: user.id,
      school_id: school.id,
      attempt: 1,
      purpose: 'uji',
      model: 'uji',
      outcome: 'ok',
      created_at: now,
    })
    .returning('id')
  const [assignment] = await db
    .table('supervisor_assignments')
    .insert({
      school_id: school.id,
      user_id: user.id,
      status: 'requested',
      created_at: now,
      updated_at: now,
    })
    .returning('id')
  const memberships = await db.from('school_memberships').where('school_id', school.id).select('id')

  return {
    school_memberships: memberships.map((row) => row.id as number),
    supervisor_assignments: [assignment.id as number],
    exam_sessions: [participant.examSessionId],
    exam_participants: [participant.id],
    layer_packages: [calendar.packageId],
    calendar_items: calendar.itemIds,
    generations: [generation.id as number],
    generation_steps: [step.id as number],
    ai_usage_logs: [usage.id as number],
  }
}

type SeededRows = Awaited<ReturnType<typeof seedSchoolRows>>

async function seedTwoSchools() {
  const { a, b } = await createTwoSchools()
  return {
    a,
    b,
    rowsA: await seedSchoolRows(a.school, a.user),
    rowsB: await seedSchoolRows(b.school, b.user),
  }
}

async function visibleIds(trx: { rawQuery: typeof db.rawQuery }, table: string, ids: number[]) {
  const result = await trx.rawQuery(`SELECT id FROM ${table} WHERE id = ANY(?) ORDER BY id`, [ids])
  return (result.rows as { id: number }[]).map((row) => row.id)
}

test.group('Tenancy | row-level security', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('the tenant connection logs in as a non-superuser without BYPASSRLS', async ({ assert }) => {
    const result = await db.connection(TENANT_CONNECTION).rawQuery(
      `SELECT current_user AS name, r.rolsuper, r.rolbypassrls,
              pg_has_role(current_user, 'sigrak_app', 'USAGE') AS app_usage,
              pg_has_role(current_user, 'sigrak_staff', 'USAGE') AS staff_usage,
              pg_has_role(current_user, 'sigrak_staff', 'SET') AS staff_set
         FROM pg_roles r WHERE r.rolname = current_user`
    )
    const role = result.rows[0]
    assert.equal(role.name, env.get('DB_APP_USER', 'sigrak_app_user'))
    assert.isFalse(role.rolsuper)
    assert.isFalse(role.rolbypassrls)
    assert.isTrue(role.app_usage)
    // Staff rights only through an explicit SET ROLE, never inherited.
    assert.isFalse(role.staff_usage)
    assert.isTrue(role.staff_set)
  })

  test('a raw query without SET LOCAL returns no school rows', async ({ assert }) => {
    const { rowsA, rowsB } = await seedTwoSchools()
    const tenant = db.connection(TENANT_CONNECTION)

    for (const table of Object.keys(rowsA) as (keyof SeededRows)[]) {
      const ids = [...rowsA[table], ...rowsB[table]]
      assert.deepEqual(await visibleIds(tenant, table, ids), [], `${table} leaked`)
    }
  })

  test('RLS limits raw SQL to the school set in the transaction', async ({ assert }) => {
    const { a, b, rowsA, rowsB } = await seedTwoSchools()

    for (const table of Object.keys(rowsA) as (keyof SeededRows)[]) {
      const ids = [...rowsA[table], ...rowsB[table]]
      const seenByA = await tenantTransaction((trx) => visibleIds(trx, table, ids), {
        schoolId: a.school.id,
        userId: null,
      })
      assert.deepEqual(seenByA, rowsA[table], `${table} for school A`)
      await assertRlsHides(assert, a.school, table, rowsB[table])
      await assertRlsHides(assert, b.school, table, rowsA[table])
    }
  })

  test('writes to another school are refused or touch nothing', async ({ assert }) => {
    const { a, b, rowsB } = await seedTwoSchools()

    await asSchool(a.school, async () => {
      const trx = SchoolContext.current()!.trx!
      const updated = await trx
        .from('exam_sessions')
        .whereIn('id', rowsB.exam_sessions)
        .update({ title: 'Diubah A' })
      assert.equal(updated, 0)
      const deleted = await trx.from('generations').whereIn('id', rowsB.generations).delete()
      assert.equal(deleted, 0)
    })

    await assert.rejects(
      () =>
        asSchool(a.school, async () => {
          const trx = SchoolContext.current()!.trx!
          const now = new Date()
          await trx.table('exam_sessions').insert({
            public_id: randomUUID(),
            school_id: b.school.id,
            title: 'Disusupkan',
            opens_at: now,
            closes_at: new Date(now.getTime() + 3_600_000),
            status: 'open',
            created_at: now,
            updated_at: now,
          })
        }),
      /row-level security/
    )

    await assert.rejects(
      () =>
        asSchool(a.school, async () => {
          const trx = SchoolContext.current()!.trx!
          await trx
            .from('school_memberships')
            .where('school_id', a.school.id)
            .update({ school_id: b.school.id })
        }),
      /row-level security/
    )

    const titles = await db.from('exam_sessions').whereIn('id', rowsB.exam_sessions).select('title')
    assert.notEqual(titles[0].title, 'Diubah A')
  })

  test('the tenant never leaks between pooled transactions', async ({ assert, cleanup }) => {
    const { a, b, rowsA, rowsB } = await seedTwoSchools()
    // One physical connection, as PgBouncer in transaction mode reuses it.
    const config = db.getRawConnection(TENANT_CONNECTION)!.config
    db.manager.add('tenant_single', { ...config, pool: { min: 1, max: 1 } })
    cleanup(() => db.manager.close('tenant_single'))
    const single = db.connection('tenant_single')
    const pid = async (client: { rawQuery: typeof db.rawQuery }) => {
      const result = await client.rawQuery('SELECT pg_backend_pid() AS pid')
      return result.rows[0].pid as number
    }

    const ids = [...rowsA.exam_sessions, ...rowsB.exam_sessions]
    const asTenant = (schoolId: number) =>
      single.transaction(async (trx) => {
        await trx.rawQuery(`SELECT set_config('app.school_id', ?, true)`, [String(schoolId)])
        return { pid: await pid(trx), ids: await visibleIds(trx, 'exam_sessions', ids) }
      })

    const first = await asTenant(a.school.id)
    assert.deepEqual(first.ids, rowsA.exam_sessions)

    // Same backend, next transaction, no SET LOCAL: nothing.
    const after = await single.transaction(async (trx) => {
      const setting = await trx.rawQuery(`SELECT current_setting('app.school_id', true) AS v`)
      return {
        pid: await pid(trx),
        setting: setting.rows[0].v as string | null,
        ids: await visibleIds(trx, 'exam_sessions', ids),
      }
    })
    assert.equal(after.pid, first.pid)
    assert.isTrue(after.setting === '' || after.setting === null)
    assert.deepEqual(after.ids, [])
    // Outside any transaction as well.
    assert.deepEqual(await visibleIds(single, 'exam_sessions', ids), [])

    const second = await asTenant(b.school.id)
    assert.equal(second.pid, first.pid)
    assert.deepEqual(second.ids, rowsB.exam_sessions)

    // A failed transaction does not leave its tenant behind either.
    await assert.rejects(() =>
      single.transaction(async (trx) => {
        await trx.rawQuery(`SELECT set_config('app.school_id', ?, true)`, [String(a.school.id)])
        throw new Error('gagal')
      })
    )
    assert.deepEqual(await visibleIds(single, 'exam_sessions', ids), [])
  })

  test('parallel tenant transactions each see only their own school', async ({ assert }) => {
    const { a, b, rowsA, rowsB } = await seedTwoSchools()
    const ids = [...rowsA.generations, ...rowsB.generations]

    const runs = Array.from({ length: 20 }, (_, index) => {
      const school = index % 2 === 0 ? a.school : b.school
      return SchoolContext.runFor(school.id, () =>
        tenantTransaction(async (trx) => {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 10))
          return { school: school.id, ids: await visibleIds(trx, 'generations', ids) }
        })
      )
    })
    for (const run of await Promise.all(runs)) {
      assert.deepEqual(run.ids, run.school === a.school.id ? rowsA.generations : rowsB.generations)
    }
  })

  test('a user sees their own memberships in every school before a school is chosen', async ({
    assert,
  }) => {
    const { a, b } = await createTwoSchools()
    const second = await createMember(b.school, 'operator', a.user)

    const seen = await tenantTransaction(
      async (trx) => {
        const rows = await trx.from('school_memberships').select('id').orderBy('id')
        return rows.map((row) => row.id as number)
      },
      { schoolId: null, userId: a.user.id }
    )
    assert.deepEqual(seen, [a.membership.id, second.membership.id])
    assert.notInclude(seen, b.membership.id)
  })

  test('region calendar packages are readable by schools and written only by staff', async ({
    assert,
  }) => {
    const { a } = await createTwoSchools()
    const { province: region } = await testRegions()
    await syncLayerDomains(db.connection())
    const now = new Date()
    const [regionPackage] = (await db
      .table('layer_packages')
      .insert({
        code: 'KALDIK-UJI-2026-2027',
        domain: 'calendar',
        layer: 'province',
        region_id: region.id,
        line: 'all',
        kind: 'official',
        level_scope: 'both',
        name: 'Kalender Jawa Tengah',
        status: 'active',
        applies_from_school_year: '2026/2027',
        applies_to_school_year: '2026/2027',
        evidence: JSON.stringify({ document_title: 'Pedoman uji' }),
        approved_at: now,
        version: 1,
        created_at: now,
        updated_at: now,
      })
      .returning('id')) as { id: number }[]

    const seen = await asSchool(a.school, async () =>
      visibleIds(SchoolContext.current()!.trx!, 'layer_packages', [regionPackage.id])
    )
    assert.deepEqual(seen, [regionPackage.id])

    // Visible, but a changed row must still pass WITH CHECK (school_id of the school).
    const renamedBySchool = await asSchool(a.school, async () =>
      SchoolContext.current()!
        .trx!.from('layer_packages')
        .where('id', regionPackage.id)
        .update({ name: 'Diubah sekolah' })
    )
    assert.equal(renamedBySchool, 0)

    await assert.rejects(
      () =>
        asSchool(a.school, async () => {
          const trx = SchoolContext.current()!.trx!
          await trx.table('calendar_items').insert({
            package_id: regionPackage.id,
            item_key: 'EV-2026-08-18-disusup',
            shape: 'list',
            force: 'mandatory',
            origin: 'official',
            match_key: 'disusupkan',
            kind: 'school_event',
            title: 'Disusupkan',
            starts_on: '2026-08-18',
            ends_on: '2026-08-18',
            created_at: now,
            updated_at: now,
          })
        }),
      /row-level security/
    )

    const renamed = await staffTransaction(async (trx) =>
      trx.from('layer_packages').where('id', regionPackage.id).update({ name: 'Diubah staf' })
    )
    assert.equal(renamed, 1)
  })

  test('staff see every school only inside staffTransaction', async ({ assert }) => {
    const { rowsA, rowsB } = await seedTwoSchools()
    const ids = [...rowsA.exam_sessions, ...rowsB.exam_sessions].sort((x, y) => x - y)

    const seen = await staffTransaction((trx) => visibleIds(trx, 'exam_sessions', ids))
    assert.deepEqual(seen, ids)

    const tenant = db.connection(TENANT_CONNECTION)
    assert.deepEqual(await visibleIds(tenant, 'exam_sessions', ids), [])
    const role = await tenant.rawQuery('SELECT current_user AS name')
    assert.notEqual(role.rows[0].name, 'sigrak_staff')
  })
})

/**
 * Read-only staff (support, D-469): `staffReadTransaction()` passes the
 * school rules for reading only; the database itself refuses writes.
 */
test.group('Tenancy | read-only staff', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  /** Runs one statement as the read-only role, in a transaction that is not READ ONLY. */
  function asReadOnlyRole(sql: string, bindings: (string | number)[] = []) {
    return db.connection(TENANT_CONNECTION).transaction(async (trx) => {
      await trx.rawQuery(`SET LOCAL ROLE ${STAFF_READ_ROLE}`)
      return trx.rawQuery(sql, bindings)
    })
  }

  /** The error message of a refused statement, or '' when it ran. */
  async function refusal(run: Promise<unknown>) {
    try {
      await run
      return ''
    } catch (error) {
      return (error as Error).message
    }
  }

  test('sees every school’s rows in every school table', async ({ assert }) => {
    const { rowsA, rowsB } = await seedTwoSchools()
    for (const table of Object.keys(rowsA) as (keyof SeededRows)[]) {
      const ids = [...rowsA[table], ...rowsB[table]].sort((x, y) => x - y)
      const seen = await staffReadTransaction((trx) => visibleIds(trx, table, ids))
      assert.deepEqual(seen, ids, table)
    }
    const role = await staffReadTransaction((trx) => trx.rawQuery('SELECT current_user AS name'))
    assert.equal(role.rows[0].name, STAFF_READ_ROLE)
    const after = await db.connection(TENANT_CONNECTION).rawQuery('SELECT current_user AS name')
    assert.notEqual(after.rows[0].name, STAFF_READ_ROLE)
  })

  test('cannot write through staffReadTransaction', async ({ assert }) => {
    const { a } = await seedTwoSchools()
    await assert.rejects(
      () =>
        staffReadTransaction((trx) =>
          trx.from('schools').where('id', a.school.id).update({ name: 'Diubah' })
        ),
      /read-only transaction|permission denied/
    )
    await assert.rejects(
      () =>
        staffReadTransaction((trx) =>
          trx.from('school_memberships').where('school_id', a.school.id).delete()
        ),
      /read-only transaction|permission denied/
    )
    const school = await db.from('schools').where('id', a.school.id).firstOrFail()
    assert.notEqual(school.name, 'Diubah')
  })

  test('the role itself has no write grant, with or without RLS', async ({ assert }) => {
    const { a, rowsA } = await seedTwoSchools()
    const writes: [string, (string | number)[]][] = [
      [`UPDATE schools SET name = 'Diubah' WHERE id = ?`, [a.school.id]],
      [
        `UPDATE school_memberships SET status = 'ended' WHERE id = ?`,
        [rowsA.school_memberships[0]],
      ],
      [`DELETE FROM calendar_items WHERE id = ?`, [rowsA.calendar_items[0]]],
      [`DELETE FROM generations WHERE id = ?`, [rowsA.generations[0]]],
      [
        `INSERT INTO app_settings (key, value, created_at, updated_at) VALUES ('x', '1', now(), now())`,
        [],
      ],
      [`UPDATE users SET name = 'Diubah' WHERE id = ?`, [a.user.id]],
      [`UPDATE invitations SET email = 'x@uji.test'`, []],
    ]
    for (const [sql, bindings] of writes) {
      assert.match(await refusal(asReadOnlyRole(sql, bindings)), /permission denied/, sql)
    }
    const memberships = await db.from('school_memberships').where('id', rowsA.school_memberships[0])
    assert.equal(memberships[0].status, 'active')
  })

  test('link hashes and AI keys stay out of reach', async ({ assert }) => {
    for (const table of ['password_reset_tokens', 'email_confirmation_tokens', 'ai_credentials']) {
      assert.match(
        await refusal(asReadOnlyRole(`SELECT count(*) FROM ${table}`)),
        /permission denied/,
        table
      )
    }
  })

  test('the login reaches the role only with SET ROLE; it is not an app member', async ({
    assert,
  }) => {
    const result = await db.connection(TENANT_CONNECTION).rawQuery(
      `SELECT pg_has_role(current_user, ?, 'USAGE') AS usage,
              pg_has_role(current_user, ?, 'SET') AS can_set,
              pg_has_role(?, 'sigrak_app', 'MEMBER') AS app_member`,
      [STAFF_READ_ROLE, STAFF_READ_ROLE, STAFF_READ_ROLE]
    )
    assert.deepEqual(result.rows[0], { usage: false, can_set: true, app_member: false })
  })
})
