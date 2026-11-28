import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type User from '#models/user'
import StaffActivityLog from '#models/staff_activity_log'
import { defaultTrialDays } from '#accounts/settings'
import {
  extendedSchoolUntil,
  extendedUserDays,
  trialLength,
  trialOf,
  trialStatus,
} from '#accounts/trial'
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

  test('a school extension gives every teacher the same end, ended trials too (D-469)', ({
    assert,
  }) => {
    const now = DateTime.fromISO('2026-11-28T10:00:00+07:00') as DateTime<true>
    const until = extendedSchoolUntil(null, 7, now)
    assert.equal(until.toISO(), now.plus({ days: 7 }).toISO())

    // Ended a year ago: reopened until the school's end.
    const longAgo = trialStatus(
      {
        startedAt: now.minus({ days: 400 }),
        userDays: null,
        schoolDays: [],
        schoolExtendedUntil: [null, until],
        defaultDays: 7,
      },
      now
    )
    assert.isTrue(longAgo.active)
    assert.equal(longAgo.daysLeft, 7)
    assert.equal(longAgo.source, 'school')
    assert.equal(longAgo.endsAt!.toISO(), until.toISO())

    // A longer trial of the teacher's own is kept.
    const longer = trialStatus(
      {
        startedAt: now.minus({ days: 1 }),
        userDays: 30,
        schoolDays: [],
        schoolExtendedUntil: [until],
        defaultDays: 7,
      },
      now
    )
    assert.equal(longer.source, 'user')
    assert.equal(longer.daysLeft, 29)

    // Adding again counts from the school's current end while it runs.
    assert.equal(extendedSchoolUntil(until, 7, now).toISO(), now.plus({ days: 14 }).toISO())
    // An extension that already ended counts from today again.
    const ended = now.minus({ days: 3 })
    assert.equal(extendedSchoolUntil(ended, 7, now).toISO(), now.plus({ days: 7 }).toISO())
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

  test('extending a school reopens every teacher’s trial from today (D-469)', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Diperpanjang')
    const other = await createSchool('SD Lain')
    const running = await started(await memberUser(school))
    const endedLongAgo = await started(await memberUser(school), 300)
    const own = await started(await memberUser(school))
    own.trialDays = 60
    await own.save()
    const elsewhere = await started(await memberUser(other), 300)
    const before = await trialOf(endedLongAgo)
    assert.isFalse(before.active)

    const admin = await createStaffWithRole('admin')
    const session = await signIn(client, 'admin', admin.email)
    const extend = () =>
      postForm(
        client,
        session,
        `/sekolah/${school.id}/uji-coba`,
        { mode: 'extend', days: 7 },
        `/sekolah/${school.id}`
      )
    const { response } = await extend()
    assert.equal(response.header('location'), `/sekolah/${school.id}`)

    await school.refresh()
    assert.isNull(school.trialDays)
    assert.isNotNull(school.trialExtendedUntil)
    for (const teacher of [running, endedLongAgo]) {
      await teacher.refresh()
      const status = await trialOf(teacher)
      assert.isTrue(status.active, teacher.email)
      assert.equal(status.daysLeft, 7, teacher.email)
      assert.equal(status.source, 'school')
    }
    // A longer own trial is kept.
    await own.refresh()
    const ownStatus = await trialOf(own)
    assert.equal(ownStatus.source, 'user')
    assert.equal(ownStatus.daysLeft, 59)
    // Another school is untouched.
    const elsewhereStatus = await trialOf(elsewhere)
    assert.isFalse(elsewhereStatus.active)

    const log = await StaffActivityLog.query().where('subject_type', 'school').firstOrFail()
    assert.equal(log.staffUserId, admin.id)
    assert.equal(log.action, 'trial.extend')
    assert.deepEqual(log.changes.from, { days: null, extended_until: null })
    assert.isString((log.changes.to as { extended_until: string }).extended_until)

    // Adding again while it runs counts from the school's end.
    await extend()
    await endedLongAgo.refresh()
    const stacked = await trialOf(endedLongAgo)
    assert.equal(stacked.daysLeft, 14)

    const page = await inertiaPage(client, session, `/sekolah/${school.id}`)
    assert.isString(page.inertiaProps.school.trialExtendedUntil)

    // "Ikut bawaan" removes the extension.
    await postForm(
      client,
      session,
      `/sekolah/${school.id}/uji-coba`,
      { mode: 'clear' },
      `/sekolah/${school.id}`
    )
    await school.refresh()
    assert.isNull(school.trialExtendedUntil)
    const cleared = await trialOf(endedLongAgo)
    assert.isFalse(cleared.active)
  })

  test('setting a school length counts from each teacher’s start', async ({ client, assert }) => {
    const school = await createSchool('SD Lama')
    const teacher = await started(await memberUser(school), 10)
    const admin = await createStaffWithRole('admin')
    const session = await signIn(client, 'admin', admin.email)
    await postForm(
      client,
      session,
      `/sekolah/${school.id}/uji-coba`,
      { mode: 'set', days: 14 },
      `/sekolah/${school.id}`
    )
    await school.refresh()
    assert.equal(school.trialDays, 14)
    const status = await trialOf(teacher)
    assert.equal(status.days, 14)
    assert.equal(status.source, 'school')
    assert.equal(status.daysLeft, 4)
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
