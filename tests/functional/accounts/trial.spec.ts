import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type User from '#models/user'
import StaffActivityLog from '#models/staff_activity_log'
import { defaultTrialDays } from '#accounts/settings'
import { extendedUserDays, trialLength, trialOf, trialStatus } from '#accounts/trial'
import { createSchool } from '#tests/helpers'
import { createStaffWithRole, inertiaPage, memberUser, postForm, signIn } from '#tests/accounts'

test.group('Accounts | trial rules (D-459)', () => {
  test('the longest set length wins; the default counts only when none is set', ({ assert }) => {
    assert.deepEqual(trialLength({ userDays: null, schoolDays: [], defaultDays: 7 }), {
      days: 7,
      source: 'default',
    })
    assert.deepEqual(trialLength({ userDays: null, schoolDays: [null, 14], defaultDays: 7 }), {
      days: 14,
      source: 'school',
    })
    assert.deepEqual(trialLength({ userDays: 30, schoolDays: [14], defaultDays: 7 }), {
      days: 30,
      source: 'user',
    })
    assert.deepEqual(trialLength({ userDays: 10, schoolDays: [14], defaultDays: 7 }), {
      days: 14,
      source: 'school',
    })
    // A shorter trial can be set on purpose.
    assert.deepEqual(trialLength({ userDays: 3, schoolDays: [], defaultDays: 7 }), {
      days: 3,
      source: 'user',
    })
  })

  test('status, days left, and extension of an ended trial from today', ({ assert }) => {
    const now = DateTime.fromISO('2026-11-28T10:00:00+07:00') as DateTime<true>
    const started = now.minus({ days: 20 })
    const ended = trialStatus(
      { startedAt: started, userDays: null, schoolDays: [], defaultDays: 7 },
      now
    )
    assert.isFalse(ended.active)
    assert.equal(ended.daysLeft, 0)

    const days = extendedUserDays(ended, 7, now)
    const reopened = trialStatus(
      { startedAt: started, userDays: days, schoolDays: [], defaultDays: 7 },
      now
    )
    assert.isTrue(reopened.active)
    assert.equal(reopened.daysLeft, 7)

    const running = trialStatus(
      { startedAt: now.minus({ days: 2 }), userDays: null, schoolDays: [], defaultDays: 7 },
      now
    )
    assert.equal(running.daysLeft, 5)
    assert.equal(extendedUserDays(running, 7, now), 14)
  })
})

test.group('Accounts | trial changes from the console', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  async function started(user: User, daysAgo = 1) {
    user.trialStartedAt = DateTime.now().minus({ days: daysAgo })
    await user.save()
    return user
  }

  test('extending a school’s trial applies to all its teachers', async ({ client, assert }) => {
    const school = await createSchool('SD Diperpanjang')
    const other = await createSchool('SD Lain')
    const first = await started(await memberUser(school))
    const second = await started(await memberUser(school))
    second.trialDays = 5
    await second.save()
    const elsewhere = await started(await memberUser(other))

    const admin = await createStaffWithRole('admin')
    const session = await signIn(client, 'admin', admin.email)
    const { response } = await postForm(
      client,
      session,
      `/sekolah/${school.id}/uji-coba`,
      { mode: 'extend', days: 7 },
      `/sekolah/${school.id}`
    )
    assert.equal(response.header('location'), `/sekolah/${school.id}`)

    await school.refresh()
    assert.equal(school.trialDays, 14)
    for (const teacher of [first, second]) {
      await teacher.refresh()
      const status = await trialOf(teacher)
      assert.equal(status.days, 14, teacher.email)
      assert.equal(status.source, 'school')
    }
    const elsewhereStatus = await trialOf(elsewhere)
    assert.equal(elsewhereStatus.days, 7)

    const log = await StaffActivityLog.query().where('subject_type', 'school').firstOrFail()
    assert.equal(log.staffUserId, admin.id)
    assert.equal(log.action, 'trial.extend')
    assert.deepEqual(log.changes, { from: null, to: 14 })

    const page = await inertiaPage(client, session, `/sekolah/${school.id}`)
    assert.equal(page.inertiaProps.school.trialDays, 14)
  })

  test('one person’s ended trial is extended from today', async ({ client, assert }) => {
    const school = await createSchool('SD Uji')
    const teacher = await started(await memberUser(school), 30)
    const before = await trialOf(teacher)
    assert.isFalse(before.active)

    const admin = await createStaffWithRole('admin')
    const session = await signIn(client, 'admin', admin.email)
    await postForm(
      client,
      session,
      `/pengguna/${teacher.id}/uji-coba`,
      { mode: 'extend', days: 7 },
      `/pengguna?q=${teacher.email}`
    )

    await teacher.refresh()
    const status = await trialOf(teacher)
    assert.isTrue(status.active)
    assert.equal(status.daysLeft, 7)
    assert.equal(status.source, 'user')

    const page = await inertiaPage(client, session, `/pengguna?q=${teacher.email}`)
    assert.isTrue(page.inertiaProps.users[0].trial.active)
  })

  test('the default length is a setting; only an admin changes it', async ({ client, assert }) => {
    const support = await createStaffWithRole('support')
    const supportSession = await signIn(client, 'admin', support.email)
    const refused = await postForm(client, supportSession, '/pengaturan', { days: 14 })
    assert.equal(refused.response.status(), 403)
    assert.equal(await defaultTrialDays(), 7)

    const school = await createSchool('SD Uji')
    const teacher = await started(await memberUser(school))
    const admin = await createStaffWithRole('admin')
    const session = await signIn(client, 'admin', admin.email)
    await postForm(client, session, '/pengaturan', { days: 14 })

    assert.equal(await defaultTrialDays(), 14)
    const after = await trialOf(teacher)
    assert.equal(after.days, 14)
    const log = await db.from('staff_activity_logs').where('subject_type', 'setting').firstOrFail()
    assert.deepEqual(log.changes, { from: 7, to: 14 })
  })

  test('support may read trials but not change them', async ({ client, assert }) => {
    const school = await createSchool('SD Uji')
    const support = await createStaffWithRole('support')
    const session = await signIn(client, 'admin', support.email)

    const page = await inertiaPage(client, session, `/sekolah/${school.id}`)
    page.assertStatus(200)
    assert.isFalse(page.inertiaProps.can.manageTrials)

    const { response } = await postForm(
      client,
      session,
      `/sekolah/${school.id}/uji-coba`,
      { mode: 'set', days: 30 },
      `/sekolah/${school.id}`
    )
    assert.equal(response.status(), 403)
    await school.refresh()
    assert.isNull(school.trialDays)
  })
})
