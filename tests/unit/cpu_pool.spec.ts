import { test } from '@japa/runner'
import { threadId } from 'node:worker_threads'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import {
  CpuPool,
  CpuPoolClosedError,
  CpuTaskError,
  CpuTaskInterruptedError,
  CpuThreadError,
} from '#services/cpu_pool/pool'

test.group('CPU pool (worker_threads)', (group) => {
  let pool: CpuPool | undefined
  group.each.teardown(async () => {
    await pool?.close(0)
    pool = undefined
  })
  group.each.timeout(10_000)

  test('runs a CPU task off the main thread and returns its result', async ({ assert }) => {
    pool = new CpuPool({ size: 1 })
    const result = await pool.run('checksum', { seed: 'sigrak', rounds: 3 })
    assert.lengthOf(result.digest, 64)
    assert.equal(result.rounds, 3)
    assert.notEqual(result.threadId, threadId)
  })

  test('the event loop stays responsive while a task burns CPU', async ({ assert }) => {
    pool = new CpuPool({ size: 1 })
    await pool.run('spin', { ms: 1 }) // thread warm, so start-up is not measured

    const histogram = monitorEventLoopDelay({ resolution: 10 })
    histogram.enable()
    let ticks = 0
    const ticker = setInterval(() => ticks++, 20)
    const started = performance.now()
    const result = await pool.run('spin', { ms: 600 })
    const elapsed = performance.now() - started
    clearInterval(ticker)
    histogram.disable()

    assert.isAbove(result.loops, 0)
    assert.isAtLeast(elapsed, 590)
    // On the main thread the same work would block the loop for 600 ms.
    const maxLagMs = histogram.max / 1e6
    assert.isBelow(maxLagMs, 150, `max event-loop lag ${maxLagMs.toFixed(1)} ms`)
    assert.isAtLeast(ticks, 15, `timer ticks during the task: ${ticks}`)
  })

  test('tasks beyond the pool size wait their turn; threads run in parallel', async ({
    assert,
  }) => {
    pool = new CpuPool({ size: 2 })
    const runs = [1, 2, 3, 4].map(() => pool!.run('spin', { ms: 150 }))
    assert.deepInclude(pool.stats(), { size: 2, threads: 2, busy: 2, queued: 2 })
    const results = await Promise.all(runs)
    assert.lengthOf(new Set(results.map((result) => result.threadId)), 2)
    assert.deepInclude(pool.stats(), { busy: 0, queued: 0 })
  })

  test('a task error comes back as CpuTaskError; the thread keeps working', async ({ assert }) => {
    pool = new CpuPool({ size: 1 })
    const error = await pool.run('fail', { message: 'rusak' }).catch((caught) => caught)
    assert.instanceOf(error, CpuTaskError)
    assert.equal(error.message, 'rusak')
    const after = await pool.run('checksum', { seed: 'a', rounds: 1 })
    assert.equal(after.rounds, 1)
  })

  test('a crashed thread fails its task and is replaced', async ({ assert }) => {
    pool = new CpuPool({ size: 1 })
    const error = await pool.run('crash', {}).catch((caught) => caught)
    assert.instanceOf(error, CpuThreadError)
    const after = await pool.run('checksum', { seed: 'a', rounds: 1 })
    assert.equal(after.rounds, 1)
    assert.equal(pool.stats().threads, 1)
  })

  test('an abort signal stops a running task and frees its slot', async ({ assert }) => {
    pool = new CpuPool({ size: 1 })
    const controller = new AbortController()
    const running = pool.run('spin', { ms: 5_000 }, { signal: controller.signal })
    const next = pool.run('checksum', { seed: 'b', rounds: 1 })
    setTimeout(() => controller.abort(), 50)

    const error = await running.catch((caught) => caught)
    assert.instanceOf(error, CpuTaskInterruptedError)
    assert.equal(error.reason, 'aborted')
    const result = await next
    assert.equal(result.rounds, 1)
  })

  test('shutdown drains running and waiting tasks within the grace period', async ({ assert }) => {
    pool = new CpuPool({ size: 1 })
    const runs = [pool.run('spin', { ms: 150 }), pool.run('spin', { ms: 150 })]
    const closing = pool.close(5_000)

    const late = await pool.run('spin', { ms: 1 }).catch((caught) => caught)
    assert.instanceOf(late, CpuPoolClosedError)

    const results = await Promise.all(runs)
    assert.lengthOf(results, 2)
    assert.deepEqual(await closing, { drained: true })
    assert.equal(pool.stats().threads, 0)
  })

  test('shutdown cuts off work still running after the grace period', async ({ assert }) => {
    pool = new CpuPool({ size: 1 })
    const running = pool.run('spin', { ms: 10_000 }).catch((caught) => caught)
    const waiting = pool.run('spin', { ms: 10_000 }).catch((caught) => caught)

    const started = performance.now()
    assert.deepEqual(await pool.close(100), { drained: false })
    assert.isBelow(performance.now() - started, 2_000)

    for (const error of [await running, await waiting]) {
      assert.instanceOf(error, CpuTaskInterruptedError)
      assert.equal(error.reason, 'shutdown')
    }
    assert.equal(pool.stats().threads, 0)
  })
})
