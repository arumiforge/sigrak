import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import type { RawQueryBindings } from '@adonisjs/lucid/types/querybuilder'
import User from '#models/user'
import StaffUser from '#models/staff_user'
import { byEmail } from '#models/email_lookup'
import { createSchool, createStaff, createTeacher, PASSWORD } from '#tests/helpers'
import { signIn } from '#tests/accounts'

/**
 * R1-11: sign-in finds the account on the unique `lower(email)` index.
 * The auth mixin's own `where email = ?` cannot use that index and read
 * the whole users table on every sign-in.
 */
async function planOf(sql: string, bindings: readonly unknown[]) {
  return db.transaction(async (trx) => {
    // On a near-empty test table the planner would pick a scan anyway.
    await trx.rawQuery('SET LOCAL enable_seqscan = off')
    const result = await trx.rawQuery(`EXPLAIN ${sql}`, bindings as RawQueryBindings)
    return (result.rows as { 'QUERY PLAN': string }[]).map((row) => row['QUERY PLAN']).join('\n')
  })
}

test.group('Accounts | sign-in lookup', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('a school user and a staff member are found whatever the capitals', async ({ assert }) => {
    const teacher = await createTeacher(await createSchool('SD Uji Huruf'))
    const staff = await createStaff()

    const found = await User.verifyCredentials(teacher.email.toUpperCase(), PASSWORD)
    assert.equal(found.id, teacher.id)
    const foundStaff = await StaffUser.verifyCredentials(` ${staff.email.toUpperCase()} `, PASSWORD)
    assert.equal(foundStaff.id, staff.id)
    assert.isNull(await User.findForAuth(['email'], 'nobody@uji.test'))
  })

  test('the lookup uses the lower(email) unique index', async ({ assert }) => {
    for (const [model, index] of [
      [User, 'users_email_unique'],
      [StaffUser, 'staff_users_email_unique'],
    ] as const) {
      const { sql, bindings } = byEmail(model, 'Guru@Uji.Test').limit(1).toSQL()
      const plan = await planOf(sql, bindings)
      assert.include(plan, `Index Scan using ${index}`)
    }
  })

  test('sign-in through the form still works', async ({ client }) => {
    const teacher = await createTeacher(await createSchool('SD Uji Masuk'))
    await signIn(client, 'app', teacher.email)
  })
})
