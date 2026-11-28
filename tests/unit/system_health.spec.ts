import { test } from '@japa/runner'
import type { QueueName } from '#config/queue'
import { readLastBackup } from '#system_health/backup'
import { collectDisk, type StatFsResult } from '#system_health/disk'
import {
  REASON_MAX_LENGTH,
  listFailedJobs,
  summarizeReason,
  type FailedJobLike,
  type FailedJobSource,
} from '#system_health/failed_jobs'
import { collectQueues, type QueueProbe } from '#system_health/queues'

/**
 * Kesehatan sistem collectors (R2-04) against fakes: queue sizes and
 * the oldest wait, the failed-job list, free disk and the backup
 * marker. The database and Redis parts run in
 * tests/functional/system_health.spec.ts.
 */

const NOW = Date.parse('2026-11-28T03:00:00Z')
const thresholds: Record<QueueName, number> = { ai: 10_000, exports: 60_000, default: 10_000 }

function fakeQueue(
  counts: Record<string, number>,
  oldest?: { timestamp: number; delay?: number }
): QueueProbe {
  return {
    getJobCounts: async (...types: string[]) =>
      Object.fromEntries(types.map((type) => [type, counts[type] ?? 0])),
    getJobs: async () => (oldest ? [{ delay: 0, opts: {}, ...oldest }] : []),
  } as unknown as QueueProbe
}

function failedJob(id: string, finishedOn: number, reason = 'Boom'): FailedJobLike {
  return {
    id,
    name: `job-${id}`,
    failedReason: reason,
    attemptsMade: 1,
    timestamp: finishedOn - 1000,
    finishedOn,
  } as FailedJobLike
}

test.group('System health | queues', () => {
  test('counts per queue, prioritised jobs count as waiting', async ({ assert }) => {
    const queues = {
      ai: fakeQueue({ wait: 2, prioritized: 3, active: 4, delayed: 1, failed: 7 }),
      exports: fakeQueue({}),
      default: fakeQueue({ failed: 1 }),
    }
    const summary = await collectQueues({ open: (name) => queues[name], thresholds, now: NOW })

    assert.deepEqual(
      summary.map((queue) => queue.name),
      ['ai', 'exports', 'default']
    )
    assert.deepInclude(summary[0], {
      waiting: 5,
      active: 4,
      delayed: 1,
      failed: 7,
      oldestWaitMs: null,
      status: 'ok',
      thresholdMs: 10_000,
    })
    assert.equal(summary[1].thresholdMs, 60_000)
    assert.equal(summary[2].failed, 1)
  })

  test('the oldest ready job sets the wait; over the threshold the queue is slow', async ({
    assert,
  }) => {
    const queues = {
      ai: fakeQueue({ wait: 1 }, { timestamp: NOW - 30_000 }),
      exports: fakeQueue({ wait: 1 }, { timestamp: NOW - 30_000 }),
      // Delayed 25 s, so it has been ready for 5 s only.
      default: fakeQueue({ wait: 1 }, { timestamp: NOW - 30_000, delay: 25_000 }),
    }
    const [ai, exportsQueue, defaultQueue] = await collectQueues({
      open: (name) => queues[name],
      thresholds,
      now: NOW,
    })
    assert.equal(ai.oldestWaitMs, 30_000)
    assert.equal(ai.status, 'slow')
    assert.equal(exportsQueue.status, 'ok')
    assert.equal(defaultQueue.oldestWaitMs, 5_000)
    assert.equal(defaultQueue.status, 'ok')
  })
})

test.group('System health | failed jobs', () => {
  test('newest failure first across queues, at most the given number per queue', async ({
    assert,
  }) => {
    const asked: [string, number, number][] = []
    const lists: Record<QueueName, FailedJobLike[]> = {
      ai: [failedJob('a1', NOW - 5_000), failedJob('a2', NOW - 50_000)],
      exports: [],
      default: [failedJob('d1', NOW - 1_000)],
    }
    const open = (name: QueueName) =>
      ({
        getFailed: async (start: number, end: number) => {
          asked.push([name, start, end])
          return lists[name]
        },
        getJob: async () => undefined,
      }) as unknown as FailedJobSource

    const jobs = await listFailedJobs({ open, perQueue: 10 })
    assert.deepEqual(
      jobs.map((job) => `${job.queue}:${job.id}`),
      ['default:d1', 'ai:a1', 'ai:a2']
    )
    assert.deepEqual(asked, [
      ['ai', 0, 9],
      ['exports', 0, 9],
      ['default', 0, 9],
    ])
    assert.deepEqual(jobs[0], {
      queue: 'default',
      id: 'd1',
      name: 'job-d1',
      reason: 'Boom',
      attempts: 1,
      queuedAt: new Date(NOW - 2_000).toISOString(),
      failedAt: new Date(NOW - 1_000).toISOString(),
      retryable: true,
    })
    // Generation steps on `ai` are only removed, never retried here.
    assert.isFalse(jobs[1].retryable)
  })

  test('a reason keeps its first line, masks e-mail addresses and is shortened', ({ assert }) => {
    assert.equal(
      summarizeReason('Mail to budi.s@sekolah.sch.id refused\n    at send (mail.ts:10)'),
      'Mail to [email] refused'
    )
    assert.equal(summarizeReason(undefined), '')
    const long = summarizeReason('x'.repeat(500))
    assert.lengthOf(long, REASON_MAX_LENGTH)
    assert.isTrue(long.endsWith('…'))
  })
})

test.group('System health | disk', () => {
  const stats = (free: number): StatFsResult => ({ bsize: 4096, blocks: 1000, bavail: free })

  test('free space, share and tone', async ({ assert }) => {
    const ok = await collectDisk('/data', async () => stats(500))
    assert.deepEqual(ok, {
      path: '/data',
      totalBytes: 4_096_000,
      freeBytes: 2_048_000,
      freePercent: 50,
      status: 'ok',
    })
    const statusAt = async (free: number) => {
      const summary = await collectDisk('/data', async () => stats(free))
      return summary.status
    }
    assert.equal(await statusAt(149), 'low')
    assert.equal(await statusAt(49), 'critical')
    assert.equal(await statusAt(150), 'ok')
  })

  test('a folder that does not exist yet is measured at its nearest parent', async ({ assert }) => {
    const tried: string[] = []
    const summary = await collectDisk('/data/sigrak/storage', async (path) => {
      tried.push(path)
      if (path !== '/data') {
        throw Object.assign(new Error('missing'), { code: 'ENOENT' })
      }
      return stats(900)
    })
    assert.deepEqual(tried, ['/data/sigrak/storage', '/data/sigrak', '/data'])
    assert.equal(summary.path, '/data')
    assert.equal(summary.freePercent, 90)
  })

  test('other errors are not hidden', async ({ assert }) => {
    await assert.rejects(
      () =>
        collectDisk('/data', async () => {
          throw Object.assign(new Error('denied'), { code: 'EACCES' })
        }),
      'denied'
    )
  })

  test('the real volume of the app can be measured', async ({ assert }) => {
    const summary = await collectDisk(process.cwd())
    assert.isAbove(summary.totalBytes, 0)
    assert.isAtLeast(summary.freePercent, 0)
  })
})

test.group('System health | last backup', () => {
  const missing = async () => {
    throw Object.assign(new Error('missing'), { code: 'ENOENT' })
  }
  const file = (text: string) => async () => text
  const mtime = new Date('2026-11-20T01:02:03Z')
  const stat = async () => ({ mtime })

  test('no marker yet means no backup ("belum ada")', async ({ assert }) => {
    assert.deepEqual(await readLastBackup('/x', { readFile: missing, stat }), {
      lastBackupAt: null,
    })
  })

  test('reads finishedAt, finished_at or a bare time', async ({ assert }) => {
    const at = '2026-11-28T01:30:00.000Z'
    for (const text of [
      JSON.stringify({ finishedAt: at, kind: 'restic' }),
      JSON.stringify({ finished_at: '2026-11-28T08:30:00+07:00' }),
      `${at}\n`,
      JSON.stringify(at),
    ]) {
      const result = await readLastBackup('/x', { readFile: file(text), stat })
      assert.equal(result.lastBackupAt, at, text)
    }
  })

  test('an unreadable marker falls back to the file time', async ({ assert }) => {
    for (const text of ['', 'selesai', '{"finishedAt":"kemarin"}', '[]']) {
      const result = await readLastBackup('/x', { readFile: file(text), stat })
      assert.equal(result.lastBackupAt, mtime.toISOString(), text)
    }
  })

  test('a marker that cannot be read is an error, not "belum ada"', async ({ assert }) => {
    const denied = async () => {
      throw Object.assign(new Error('denied'), { code: 'EACCES' })
    }
    await assert.rejects(() => readLastBackup('/x', { readFile: denied, stat }), 'denied')
  })
})
