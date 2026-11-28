import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { Worker, type Job } from 'bullmq'
import { DateTime } from 'luxon'
import type { QueueName } from '#config/queue'
import { sessionCookieNames } from '#config/session'
import type School from '#models/school'
import StaffActivityLog from '#models/staff_activity_log'
import type { StaffRole } from '#models/staff_user'
import { queue, queueSettings } from '#services/queue/queues'
import { queueNames } from '#services/queue/wait_metrics'
import { collectDailyActivity } from '#system_health/daily_activity'
import { listFailedJobs } from '#system_health/failed_jobs'
import { collectQueues } from '#system_health/queues'
import { createSchool, createTeacher, overrideConfig, visit } from '#tests/helpers'
import { createStaffWithRole, inertiaPage, postForm, signIn, type Session } from '#tests/accounts'

/**
 * Kesehatan sistem (R2-04, D-316): who may open the page and act, the
 * deferred sections, generations and AI errors per WIB day from the
 * database, and retrying or removing a failed job in Redis (the test
 * queue database only), with its log row.
 */

const PAGE = '/kesehatan-sistem'

async function jobLogCount() {
  const logs = await StaffActivityLog.query().whereLike('action', 'job.%')
  return logs.length
}

async function emptyQueues() {
  for (const name of queueNames) await queue(name).obliterate({ force: true })
}

/** A job on `name` that failed with `reason`, without running a worker loop. */
async function failedJobOn(name: QueueName, reason: string): Promise<Job> {
  const added = await queue(name).add('uji-gagal', { secret: 'isi pekerjaan' })
  const settings = queueSettings()
  const worker = new Worker(name, null, {
    connection: settings.connection,
    prefix: settings.prefix,
    autorun: false,
  })
  try {
    const token = randomUUID()
    const job = (await worker.getNextJob(token)) as Job
    if (job.id !== added.id) throw new Error('Another job was waiting')
    await job.moveToFailed(new Error(reason), token)
  } finally {
    await worker.close()
  }
  return (await queue(name).getJob(added.id!))!
}

async function signInAs(client: Parameters<typeof visit>[0], role: StaffRole) {
  const staff = await createStaffWithRole(role)
  return { staff, session: await signIn(client, 'admin', staff.email) }
}

function get(client: Parameters<typeof visit>[0], session: Session, path: string) {
  return visit(client, 'admin', path, {
    name: sessionCookieNames.admin,
    sessionId: session.sessionId,
  })
}

async function generation(
  school: School | null,
  userId: number,
  createdAt: string,
  status: 'succeeded' | 'failed' | 'running'
) {
  const [row] = await db
    .table('generations')
    .insert({
      public_id: randomUUID(),
      user_id: userId,
      school_id: school?.id ?? null,
      template_key: 'uji',
      template_version: 1,
      client_token: randomUUID(),
      specification: JSON.stringify({}),
      status,
      started_at: status === 'running' ? createdAt : null,
      finished_at: status === 'running' ? null : createdAt,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .returning('id')
  return Number(row.id ?? row)
}

async function aiAttempt(
  school: School | null,
  userId: number,
  createdAt: string,
  outcome: string
) {
  await db.table('ai_usage_logs').insert({
    user_id: userId,
    school_id: school?.id ?? null,
    attempt: 1,
    purpose: 'uji',
    model: 'uji-model',
    outcome,
    created_at: createdAt,
  })
}

test.group('System health | page and abilities', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(async () => {
    await emptyQueues()
    return emptyQueues
  })

  test('engineer and owner may act, admin may only look, others get 403', async ({
    client,
    assert,
  }) => {
    for (const [role, canManage] of [
      ['engineer', true],
      ['owner', true],
      ['admin', false],
    ] as const) {
      const { session } = await signInAs(client, role)
      const page = await inertiaPage(client, session, PAGE)
      page.assertStatus(200)
      assert.equal(page.inertiaComponent, 'console/system_health', role)
      assert.equal(page.inertiaProps.canManage, canManage, role)
      assert.equal(page.inertiaProps.refreshSeconds, 30)
      // The sections are deferred: not in the first response.
      assert.notProperty(page.inertiaProps, 'queues')
      assert.notProperty(page.inertiaProps, 'activity')
    }
    for (const role of ['support', 'finance', 'content', 'researcher'] as const) {
      const { session } = await signInAs(client, role)
      const response = await get(client, session, PAGE)
      response.assertStatus(403)
    }
  })

  test('the deferred sections arrive on the partial reload', async ({ client, assert }) => {
    const restore = overrideConfig({
      'system_health.backupMarkerPath': '/nonexistent/sigrak-uji/last-backup.json',
    })
    try {
      await failedJobOn('default', 'Kirim surel ke budi@uji.test ditolak')
      const { session } = await signInAs(client, 'admin')
      const response = await get(client, session, PAGE)
        .withInertia()
        .withInertiaPartialReload('console/system_health', [
          'queues',
          'failedJobs',
          'disk',
          'backup',
          'activity',
        ])
      response.assertStatus(200)
      const props = response.inertiaProps as Record<string, any>

      assert.sameMembers(
        props.queues.map((item: { name: string }) => item.name),
        ['ai', 'exports', 'default']
      )
      const defaultQueue = props.queues.find((item: { name: string }) => item.name === 'default')
      assert.equal(defaultQueue.failed, 1)
      assert.lengthOf(props.failedJobs, 1)
      assert.include(props.failedJobs[0], {
        queue: 'default',
        name: 'uji-gagal',
        reason: 'Kirim surel ke [email] ditolak',
      })
      assert.notProperty(props.failedJobs[0], 'data')
      assert.notInclude(JSON.stringify(props.failedJobs), 'isi pekerjaan')
      assert.isAbove(props.disk.totalBytes, 0)
      assert.deepEqual(props.backup, { lastBackupAt: null })
      assert.lengthOf(props.activity.days, 14)
    } finally {
      restore()
    }
  })
})

test.group('System health | generations and AI errors per day', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('counts per WIB day across schools, zeros for quiet days', async ({ assert }) => {
    const north = await createSchool('SD Uji Utara')
    const south = await createSchool('SD Uji Selatan')
    const teacher = await createTeacher(north)
    const other = await createTeacher(south)

    // 2026-11-27 17:30 UTC is 2026-11-28 00:30 WIB.
    await generation(north, teacher.id, '2026-11-27T17:30:00Z', 'succeeded')
    await generation(south, other.id, '2026-11-28T02:00:00Z', 'failed')
    await generation(null, teacher.id, '2026-11-28T03:00:00Z', 'running')
    // 2026-11-27 16:59 UTC is still 2026-11-27 WIB.
    await generation(north, teacher.id, '2026-11-27T16:59:00Z', 'succeeded')
    // Outside the window.
    await generation(north, teacher.id, '2026-11-20T03:00:00Z', 'failed')

    await aiAttempt(north, teacher.id, '2026-11-28T01:00:00Z', 'success')
    await aiAttempt(north, teacher.id, '2026-11-28T01:00:01Z', 'rate_limited')
    await aiAttempt(south, other.id, '2026-11-28T01:00:02Z', 'rate_limited')
    await aiAttempt(null, other.id, '2026-11-26T01:00:00Z', 'timeout')
    await aiAttempt(north, teacher.id, '2026-11-19T01:00:00Z', 'key_invalid')

    const activity = await collectDailyActivity({
      days: 3,
      now: DateTime.fromISO('2026-11-28T10:00:00', { zone: 'Asia/Jakarta' }),
    })

    assert.deepEqual(activity.days, [
      {
        day: '2026-11-26',
        generations: 0,
        succeeded: 0,
        failed: 0,
        aiAttempts: 1,
        aiErrors: 1,
      },
      {
        day: '2026-11-27',
        generations: 1,
        succeeded: 1,
        failed: 0,
        aiAttempts: 0,
        aiErrors: 0,
      },
      {
        day: '2026-11-28',
        generations: 3,
        succeeded: 1,
        failed: 1,
        aiAttempts: 3,
        aiErrors: 2,
      },
    ])
    assert.deepEqual(activity.aiErrorKinds, [
      { outcome: 'rate_limited', count: 2 },
      { outcome: 'timeout', count: 1 },
    ])
  })
})

test.group('System health | failed jobs: retry and remove', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(async () => {
    await emptyQueues()
    return emptyQueues
  })

  test('an engineer retries a failed job; the change is logged', async ({ client, assert }) => {
    const job = await failedJobOn('exports', 'Kehabisan memori')
    const { staff, session } = await signInAs(client, 'engineer')

    const { response, session: next } = await postForm(
      client,
      session,
      `${PAGE}/pekerjaan/exports/${job.id}/coba-lagi`,
      {},
      PAGE
    )
    response.assertStatus(302)
    assert.equal(response.header('location'), PAGE)

    assert.equal(await (await queue('exports').getJob(job.id!))!.getState(), 'waiting')
    assert.lengthOf(await listFailedJobs(), 0)
    const [queues] = await collectQueues({ names: ['exports'] })
    assert.include(queues, { waiting: 1, failed: 0 })

    const log = await StaffActivityLog.query().where('action', 'job.retry').firstOrFail()
    assert.equal(log.staffUserId, staff.id)
    assert.equal(log.subjectType, 'job')
    assert.equal(log.subjectId, `exports:${job.id}`)
    assert.deepEqual(log.changes, {
      queue: 'exports',
      job_name: 'uji-gagal',
      reason: 'Kehabisan memori',
    })

    const page = await inertiaPage(client, next, PAGE)
    assert.match(page.body().flash?.success ?? '', /uji-gagal/)
  })

  test('a failed AI job is not retried from the console; it can be removed', async ({
    client,
    assert,
  }) => {
    const job = await failedJobOn('ai', 'Model tidak tersedia')
    const { session } = await signInAs(client, 'engineer')

    const { response, session: next } = await postForm(
      client,
      session,
      `${PAGE}/pekerjaan/ai/${job.id}/coba-lagi`,
      {},
      PAGE
    )
    response.assertStatus(302)
    assert.equal(await (await queue('ai').getJob(job.id!))!.getState(), 'failed')
    assert.equal(await jobLogCount(), 0)
    const page = await inertiaPage(client, next, PAGE)
    assert.match(page.body().flash?.error ?? '', /guru/)

    const [listed] = await listFailedJobs({ names: ['ai'] })
    assert.isFalse(listed.retryable)
  })

  test('an owner removes a failed job; the change is logged', async ({ client, assert }) => {
    const job = await failedJobOn('default', 'Boom')
    const { staff, session } = await signInAs(client, 'owner')

    const { response } = await postForm(
      client,
      session,
      `${PAGE}/pekerjaan/default/${job.id}/hapus`,
      {},
      PAGE
    )
    response.assertStatus(302)
    assert.isUndefined(await queue('default').getJob(job.id!))

    const log = await StaffActivityLog.query().where('action', 'job.remove').firstOrFail()
    assert.equal(log.staffUserId, staff.id)
    assert.equal(log.subjectId, `default:${job.id}`)
  })

  test('admin may not act; nothing changes and nothing is logged', async ({ client, assert }) => {
    const job = await failedJobOn('ai', 'Boom')
    const { session } = await signInAs(client, 'admin')

    for (const action of ['coba-lagi', 'hapus']) {
      const { response } = await postForm(
        client,
        session,
        `${PAGE}/pekerjaan/ai/${job.id}/${action}`,
        {},
        PAGE
      )
      response.assertStatus(403)
    }
    assert.equal(await (await queue('ai').getJob(job.id!))!.getState(), 'failed')
    assert.equal(await jobLogCount(), 0)
  })

  test('a job that is not failed (or gone) is refused with a message, not logged', async ({
    client,
    assert,
  }) => {
    const waiting = await queue('default').add('uji-menunggu', {})
    const { session } = await signInAs(client, 'engineer')

    for (const id of [waiting.id!, '999999']) {
      const { response, session: next } = await postForm(
        client,
        session,
        `${PAGE}/pekerjaan/default/${id}/coba-lagi`,
        {},
        PAGE
      )
      response.assertStatus(302)
      const page = await inertiaPage(client, next, PAGE)
      assert.match(page.body().flash?.error ?? '', /sudah tidak ada/)
    }
    assert.equal(await (await queue('default').getJob(waiting.id!))!.getState(), 'waiting')
    assert.equal(await jobLogCount(), 0)
  })

  test('an unknown queue is not a route', async ({ client }) => {
    const { session } = await signInAs(client, 'engineer')
    const { response } = await postForm(
      client,
      session,
      `${PAGE}/pekerjaan/lain/1/coba-lagi`,
      {},
      PAGE
    )
    response.assertStatus(404)
  })
})
