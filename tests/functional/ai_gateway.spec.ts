import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import redis from '@adonisjs/redis/services/main'
import { DateTime } from 'luxon'
import AiCredential from '#models/ai_credential'
import AiUsageLog from '#models/ai_usage_log'
import { AIGateway, AIGatewayError } from '#services/ai/ai_gateway'
import { FakeProvider, type FakeOutcome } from '#services/ai/fake_provider'
import { keyHealth } from '#services/ai/key_selector'
import { createAiKeys, createSchool, createTeacher, overrideConfig } from '#tests/helpers'

const MODEL = 'fake-flash'

const request = {
  purpose: 'demo',
  system: 'Uji',
  parts: ['Data uji'],
  responseSchema: { type: 'object' },
}

const rateLimited = (retryAfterMs?: number): FakeOutcome => ({
  kind: 'error',
  errorClass: 'rate_limited',
  httpStatus: 429,
  retryAfterMs,
})

async function setup(keyCount = 3, backup: string[] = []) {
  const school = await createSchool('SD Uji AI')
  const teacher = await createTeacher(school)
  const keys = await createAiKeys(teacher, keyCount, backup)
  return { teacher, keys, call: { request, userId: teacher.id, schoolId: school.id } }
}

async function outcomeNames(userId: number) {
  const rows = await outcomes(userId)
  return rows.map(([, outcome]) => outcome)
}

async function outcomes(userId: number) {
  const logs = await AiUsageLog.query().where('user_id', userId).orderBy('id', 'asc')
  return logs.map((log) => [log.aiCredentialId, log.outcome] as const)
}

/**
 * The AI gateway with the fake provider: key rotation, failover and the
 * error table of ai-provider-engine.md (R0-06).
 */
test.group('AI gateway', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(async () => {
    await redis.connection('ai').flushdb()
  })
  group.each.setup(() =>
    overrideConfig({
      'ai.purposes.demo.timeoutMs': 100,
      'ai.gateway.transientBackoffMs': [5, 10],
      'ai.gateway.jitterMs': 0,
    })
  )

  test('a 429 without a short delay fails over and cools the key down', async ({ assert }) => {
    const { keys, call } = await setup()
    const provider = FakeProvider.sequence([rateLimited(30_000)])

    const result = await new AIGateway(provider).run(call)

    assert.equal(provider.calls[0].credentialId, keys[0].id)
    assert.notEqual(result.credentialId, keys[0].id)
    assert.equal(result.attempts, 2)
    const until = await keyHealth.cooldownUntil(keys[0].id, MODEL)
    assert.isNotNull(until)
    assert.isAbove(until!.diffNow().as('seconds'), 25)
    assert.deepEqual(await outcomes(call.userId), [
      [keys[0].id, 'rate_limited'],
      [result.credentialId, 'success'],
    ])
  })

  test('a 429 with a short suggested delay is retried once on the same key', async ({ assert }) => {
    const { keys, call } = await setup()
    const provider = FakeProvider.sequence([rateLimited(20)])

    const result = await new AIGateway(provider).run(call)

    assert.deepEqual(
      provider.calls.map((entry) => entry.credentialId),
      [keys[0].id, keys[0].id]
    )
    assert.equal(result.credentialId, keys[0].id)
    assert.isNull(await keyHealth.cooldownUntil(keys[0].id, MODEL))
  })

  test('a timeout is retried once on the same key, then fails over', async ({ assert }) => {
    const { keys, call } = await setup()
    const provider = FakeProvider.sequence([{ kind: 'hang' }, { kind: 'hang' }])

    const result = await new AIGateway(provider).run(call)

    assert.deepEqual(provider.calls.map((entry) => entry.credentialId).slice(0, 2), [
      keys[0].id,
      keys[0].id,
    ])
    assert.notEqual(result.credentialId, keys[0].id)
    assert.deepEqual(await outcomeNames(call.userId), ['timeout', 'timeout', 'success'])
    const first = await AiCredential.findOrFail(keys[0].id)
    assert.equal(first.consecutiveFailures, 2)
  })

  test('an empty reply fails over to the next key', async ({ assert }) => {
    const { keys, call } = await setup()
    const provider = FakeProvider.sequence([{ kind: 'empty' }])

    const result = await new AIGateway(provider).run(call)

    assert.equal(provider.calls[0].credentialId, keys[0].id)
    assert.notEqual(result.credentialId, keys[0].id)
    assert.deepEqual(await outcomeNames(call.userId), ['empty_reply', 'success'])
  })

  test('transient errors back off on the same key, then fail over', async ({ assert }) => {
    const { keys, call } = await setup()
    const transient: FakeOutcome = { kind: 'error', errorClass: 'transient', httpStatus: 503 }
    const provider = FakeProvider.sequence([transient, transient, transient])

    const result = await new AIGateway(provider).run(call)

    assert.deepEqual(provider.calls.map((entry) => entry.credentialId).slice(0, 3), [
      keys[0].id,
      keys[0].id,
      keys[0].id,
    ])
    assert.notEqual(result.credentialId, keys[0].id)
    assert.equal(result.attempts, 4)
  })

  test('a bad request is not retried on another key', async ({ assert }) => {
    const { call } = await setup()
    const provider = FakeProvider.sequence([
      { kind: 'error', errorClass: 'bad_request', httpStatus: 400 },
    ])

    const error = await new AIGateway(provider).run(call).catch((caught) => caught)

    assert.instanceOf(error, AIGatewayError)
    assert.equal(error.failure, 'bad_request')
    assert.lengthOf(provider.calls, 1)
  })

  test('a rejected key is marked invalid and skipped', async ({ assert }) => {
    const { keys, call } = await setup()
    const provider = FakeProvider.sequence([
      { kind: 'error', errorClass: 'key_invalid', httpStatus: 403 },
    ])

    const result = await new AIGateway(provider).run(call)

    assert.notEqual(result.credentialId, keys[0].id)
    const first = await AiCredential.findOrFail(keys[0].id)
    assert.equal(first.status, 'invalid')
    assert.equal(first.invalidReason, 'key_invalid')
  })

  test('when every key hits its daily quota, the failure names the reset time', async ({
    assert,
  }) => {
    const { call } = await setup()
    const daily: FakeOutcome = {
      kind: 'error',
      errorClass: 'rate_limited_daily',
      httpStatus: 429,
    }
    const provider = FakeProvider.sequence([daily, daily, daily])

    const error = await new AIGateway(provider).run(call).catch((caught) => caught)

    assert.instanceOf(error, AIGatewayError)
    assert.equal(error.failure, 'no_usable_key')
    assert.equal(error.attempts, 3)
    // The cooldown is read back from the key's TTL, so allow a second.
    assert.closeTo(
      error.availableAt.toMillis(),
      DateTime.now().setZone('America/Los_Angeles').plus({ days: 1 }).startOf('day').toMillis(),
      1_000
    )
  })

  test('the attempt budget ends a step that keeps failing', async ({ assert }) => {
    const { call } = await setup()
    const provider = new FakeProvider(() => ({
      kind: 'error',
      errorClass: 'transient',
      httpStatus: 503,
    }))

    const error = await new AIGateway(provider).run(call).catch((caught) => caught)

    assert.equal(error.failure, 'transient')
    assert.lengthOf(provider.calls, 4)
  })

  test('the pinned key of a generation is used first', async ({ assert }) => {
    const { keys, call } = await setup()
    const provider = FakeProvider.sequence([])

    const result = await new AIGateway(provider).run({
      ...call,
      pinnedCredentialId: keys[2].id,
    })

    assert.equal(result.credentialId, keys[2].id)
  })

  test('round robin spreads new generations over the keys', async ({ assert }) => {
    const { keys, call } = await setup()
    const used: number[] = []
    for (let index = 0; index < 4; index++) {
      const result = await new AIGateway(FakeProvider.sequence([])).run(call)
      used.push(result.credentialId)
    }
    assert.deepEqual(used, [keys[0].id, keys[1].id, keys[2].id, keys[0].id])
  })

  test('backup keys are used only when no normal key is usable', async ({ assert }) => {
    const { keys, call } = await setup(2, ['A'])
    const provider = FakeProvider.sequence([rateLimited(30_000)])

    const result = await new AIGateway(provider).run(call)

    assert.equal(provider.calls[0].credentialId, keys[1].id)
    assert.equal(result.credentialId, keys[0].id)
  })

  test('a user without keys gets no_keys', async ({ assert }) => {
    const { call } = await setup(0)

    const error = await new AIGateway(FakeProvider.sequence([])).run(call).catch((caught) => caught)

    assert.equal(error.failure, 'no_keys')
  })
})
