import { test } from '@japa/runner'
import { clampSetting, settingRanges, type SettingAdjustment } from '#services/queue/settings'
import { cpuLimit, cpuPoolSize } from '#services/cpu_pool/limits'
import { QueueWaitAlert, waitMsOf, type WaitAlert } from '#services/queue/wait_metrics'

const files = (map: Record<string, string>) => (path: string) => map[path]

test.group('Runtime settings: parse and clamp', () => {
  test('unset values use the defaults of D-467', ({ assert }) => {
    assert.equal(clampSetting('QUEUE_AI_CONCURRENCY', undefined), 50)
    assert.equal(clampSetting('QUEUE_EXPORTS_CONCURRENCY', undefined), 2)
    assert.equal(clampSetting('QUEUE_DEFAULT_CONCURRENCY', undefined), 4)
    assert.equal(clampSetting('QUEUE_WAIT_ALERT_MS', undefined), 10_000)
  })

  test('queue-wait alert defaults: exports 60 s, other queues 10 s (D-469)', ({ assert }) => {
    assert.equal(clampSetting('QUEUE_WAIT_ALERT_MS', undefined), 10_000)
    assert.equal(clampSetting('QUEUE_EXPORTS_WAIT_ALERT_MS', undefined), 60_000)
    const adjustments: SettingAdjustment[] = []
    assert.equal(clampSetting('QUEUE_EXPORTS_WAIT_ALERT_MS', 10, adjustments), 1_000)
    assert.equal(clampSetting('QUEUE_EXPORTS_WAIT_ALERT_MS', 9_000_000, adjustments), 3_600_000)
    assert.lengthOf(adjustments, 2)
  })

  test('values inside the range pass unchanged and are not reported', ({ assert }) => {
    const adjustments: SettingAdjustment[] = []
    assert.equal(clampSetting('QUEUE_AI_CONCURRENCY', 80, adjustments), 80)
    assert.equal(clampSetting('QUEUE_WAIT_ALERT_MS', 1_000, adjustments), 1_000)
    assert.deepEqual(adjustments, [])
  })

  test('values outside the range are clamped and reported', ({ assert }) => {
    const adjustments: SettingAdjustment[] = []
    assert.equal(clampSetting('QUEUE_AI_CONCURRENCY', 0, adjustments), 1)
    assert.equal(clampSetting('QUEUE_AI_CONCURRENCY', 100_000, adjustments), 500)
    assert.equal(clampSetting('QUEUE_EXPORTS_CONCURRENCY', -3, adjustments), 1)
    assert.equal(clampSetting('QUEUE_WAIT_ALERT_MS', 5, adjustments), 1_000)
    assert.equal(clampSetting('CPU_POOL_SIZE', 999, adjustments), 64)
    assert.deepEqual(
      adjustments.map(({ name, given, used }) => `${name}:${given}->${used}`),
      [
        'QUEUE_AI_CONCURRENCY:0->1',
        'QUEUE_AI_CONCURRENCY:100000->500',
        'QUEUE_EXPORTS_CONCURRENCY:-3->1',
        'QUEUE_WAIT_ALERT_MS:5->1000',
        'CPU_POOL_SIZE:999->64',
      ]
    )
  })

  test('fractions round down; NaN falls back to the default', ({ assert }) => {
    const adjustments: SettingAdjustment[] = []
    assert.equal(clampSetting('QUEUE_AI_CONCURRENCY', 12.7, adjustments), 12)
    assert.equal(clampSetting('QUEUE_AI_CONCURRENCY', Number.NaN, adjustments), 50)
    assert.lengthOf(adjustments, 1)
  })

  test('every default sits inside its own range', ({ assert }) => {
    for (const [name, range] of Object.entries(settingRanges)) {
      assert.isAtLeast(range.fallback, range.min, name)
      assert.isAtMost(range.fallback, range.max, name)
    }
  })

  test('the booted config carries the parsed settings', async ({ assert }) => {
    const { default: config } = await import('#config/queue')
    assert.isAtLeast(config.workers.ai.concurrency, 1)
    assert.isAtMost(config.workers.ai.concurrency, 500)
    assert.sameMembers(Object.keys(config.waitAlertMs), ['ai', 'exports', 'default'])
    assert.equal(config.waitAlertMs.ai, config.waitAlertMs.default)
    assert.isAtLeast(config.waitAlertMs.exports, 1_000)
  })
})

test.group('CPU pool sizing', () => {
  test('reads a cgroup v2 quota, rounded down, capped by the cores', ({ assert }) => {
    assert.equal(cpuLimit(files({ '/sys/fs/cgroup/cpu.max': '200000 100000\n' }), 12), 2)
    assert.equal(cpuLimit(files({ '/sys/fs/cgroup/cpu.max': '150000 100000' }), 12), 1)
    assert.equal(cpuLimit(files({ '/sys/fs/cgroup/cpu.max': '1600000 100000' }), 12), 12)
    assert.equal(cpuLimit(files({ '/sys/fs/cgroup/cpu.max': '50000 100000' }), 12), 1)
  })

  test('no quota ("max") means the available cores', ({ assert }) => {
    assert.equal(cpuLimit(files({ '/sys/fs/cgroup/cpu.max': 'max 100000' }), 6), 6)
    assert.equal(cpuLimit(files({}), 4), 4)
  })

  test('falls back to cgroup v1', ({ assert }) => {
    const v1 = files({
      '/sys/fs/cgroup/cpu/cpu.cfs_quota_us': '300000',
      '/sys/fs/cgroup/cpu/cpu.cfs_period_us': '100000',
    })
    assert.equal(cpuLimit(v1, 12), 3)
    const unlimited = files({
      '/sys/fs/cgroup/cpu/cpu.cfs_quota_us': '-1',
      '/sys/fs/cgroup/cpu/cpu.cfs_period_us': '100000',
    })
    assert.equal(cpuLimit(unlimited, 8), 8)
  })

  test('auto size is the limit minus one, at least one; a set size stays under the limit', ({
    assert,
  }) => {
    assert.equal(cpuPoolSize('auto', 4), 3)
    assert.equal(cpuPoolSize('auto', 2), 1)
    assert.equal(cpuPoolSize('auto', 1), 1)
    assert.equal(cpuPoolSize(2, 4), 2)
    assert.equal(cpuPoolSize(16, 4), 4)
  })
})

test.group('Queue wait', () => {
  test('wait runs from enqueue, or from the end of a delay, to the start', ({ assert }) => {
    assert.equal(waitMsOf({ timestamp: 1_000, processedOn: 4_000, delay: 0, opts: {} }), 3_000)
    assert.equal(
      waitMsOf({ timestamp: 1_000, processedOn: 4_000, delay: 2_500, opts: { delay: 2_500 } }),
      500
    )
    assert.equal(waitMsOf({ timestamp: 5_000, processedOn: 4_000, delay: 0, opts: {} }), 0)
    assert.equal(waitMsOf({ timestamp: 1_000, delay: 0, opts: {} } as never, 1_250), 250)
  })

  test('the alert fires above the threshold, at most once per interval, with a count', ({
    assert,
  }) => {
    const alerts: WaitAlert[] = []
    const alert = new QueueWaitAlert('ai', 1_000, (entry) => alerts.push(entry), 30_000)
    const job = { id: '1', name: 'generate-demo' }

    assert.isFalse(alert.observe(job, 1_000, 0))
    assert.isTrue(alert.observe(job, 1_500, 10))
    assert.isTrue(alert.observe(job, 2_000, 20))
    assert.isTrue(alert.observe(job, 2_500, 30))
    assert.lengthOf(alerts, 1)
    assert.include(alerts[0], { queue: 'ai', waitMs: 1_500, thresholdMs: 1_000, suppressed: 0 })

    assert.isTrue(alert.observe({ id: '2', name: 'generate-demo' }, 3_000, 30_010))
    assert.lengthOf(alerts, 2)
    assert.include(alerts[1], { jobId: '2', waitMs: 3_000, suppressed: 2 })
  })
})
