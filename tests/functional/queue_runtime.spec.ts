import { test } from '@japa/runner'
import { createHash } from 'node:crypto'
import { threadId } from 'node:worker_threads'
import { queue, queueSettings } from '#services/queue/queues'
import { queueNames } from '#services/queue/wait_metrics'
import { startWorker, type WorkerHandle } from '#services/queue/worker'
import { eventually, overrideConfig, visit } from '#tests/helpers'

function checksum(seed: string, rounds: number) {
  let digest = seed
  for (let round = 0; round < rounds; round++) {
    digest = createHash('sha256').update(digest).digest('hex')
  }
  return digest
}

async function emptyQueues() {
  for (const name of queueNames) await queue(name).obliterate({ force: true })
}

test.group('Queue runtime: worker-exports, CPU pool, queue wait', (group) => {
  let worker: WorkerHandle | undefined
  let restore: (() => void) | undefined

  group.each.setup(async () => {
    restore = overrideConfig({ 'queue.cpuPool': { size: 1 } })
    await emptyQueues()
    return async () => {
      await worker?.close(0)
      worker = undefined
      restore?.()
      await emptyQueues()
    }
  })

  test('worker-exports runs the sample CPU job in the pool', async ({ assert }) => {
    worker = await startWorker('exports')
    const job = await queue('exports').add('cpu-sample', { seed: 'sigrak', rounds: 2_000 })

    const result = await eventually(async () => {
      const state = await job.getState()
      if (state === 'failed') throw new Error('cpu-sample failed')
      return state === 'completed' ? (await queue('exports').getJob(job.id!))!.returnvalue : false
    })
    assert.equal(result.digest, checksum('sigrak', 2_000))
    assert.notEqual(result.threadId, threadId)
  })

  test('GET /healthz/queues reports queue wait from recorded starts', async ({
    client,
    assert,
  }) => {
    worker = await startWorker('exports')
    const job = await queue('exports').add('cpu-sample', { seed: 'x', rounds: 1 })
    await eventually(async () => (await job.getState()) === 'completed')

    const response = await eventually(async () => {
      const answer = await visit(client, 'app', '/healthz/queues')
      return answer.body().queues?.exports?.recent?.starts >= 1 ? answer : false
    })
    response.assertStatus(200)
    assert.equal(response.header('cache-control'), 'no-store')
    const body = response.body()
    assert.equal(body.status, 'ok')
    assert.equal(body.thresholdMs, queueSettings().waitAlertMs)
    assert.sameMembers(Object.keys(body.queues), ['ai', 'exports', 'default'])
    assert.include(body.queues.exports, { status: 'ok', waiting: 0, oldestWaitMs: null })
    assert.isAtLeast(body.queues.exports.recent.p95Ms, 0)
  })

  test('a job waiting longer than the threshold makes the queue "slow"', async ({
    client,
    assert,
  }) => {
    // No worker for `default`; the job was queued a minute ago.
    await queue('default').add('nothing', {}, { timestamp: Date.now() - 60_000 })

    const response = await visit(client, 'app', '/healthz/queues')
    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.status, 'slow')
    assert.equal(body.queues.default.status, 'slow')
    assert.equal(body.queues.default.waiting, 1)
    assert.isAtLeast(body.queues.default.oldestWaitMs, 59_000)
    assert.equal(body.queues.exports.status, 'ok')
  })

  test('the queue numbers are not served to requests through Cloudflare', async ({ client }) => {
    const hidden = await visit(client, 'app', '/healthz/queues').header(
      'cf-connecting-ip',
      '203.0.113.9'
    )
    hidden.assertStatus(404)

    const health = await visit(client, 'app', '/healthz').header('cf-connecting-ip', '203.0.113.9')
    health.assertStatus(200)
    health.assertBody({ status: 'ok' })
  })

  test('shutdown cuts off CPU work after the grace period and requeues the job', async ({
    assert,
  }) => {
    worker = await startWorker('exports')
    const job = await queue('exports').add('cpu-sample', { seed: 'long', rounds: 100_000_000 })
    await eventually(async () => (await job.getState()) === 'active')

    const started = Date.now()
    await worker.close(200)
    worker = undefined
    assert.isBelow(Date.now() - started, 5_000)
    // The worker's close also closed this process's producers; look the job up again.
    assert.equal(await queue('exports').getJobState(job.id!), 'waiting')
  }).timeout(15_000)
})
