import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import redis from '@adonisjs/redis/services/main'
import transmit from '@adonisjs/transmit/services/main'
import db from '@adonisjs/lucid/services/db'
import { v4 as uuidv4 } from 'uuid'
import { hosts } from '#config/hosts'
import { sessionCookieNames } from '#config/session'
import Generation from '#models/generation'
import GenerationStep from '#models/generation_step'
import AiUsageLog from '#models/ai_usage_log'
import { AICancelledError, type AIProvider } from '#services/ai/contracts'
import { FakeProvider, type FakeOutcome } from '#services/ai/fake_provider'
import { aiProviders } from '#services/ai/providers'
import type { ProgressMessage } from '#services/generation/progress'
import { userChannel } from '#services/generation/progress'
import { queue } from '#services/queue/queues'
import { startWorker, type WorkerHandle } from '#services/queue/worker'
import {
  PASSWORD,
  createAiKeys,
  createSchool,
  createTeacher,
  eventually,
  login,
  overrideConfig,
} from '#tests/helpers'

/** Short locks, so a crashed worker's job comes back within a second. */
const fastWorker = { lockDuration: 1_000, stalledInterval: 300, maxStalledCount: 2 }

type Session = { cookie: string; sessionId: string; csrf: string; userId: number }

async function signedInTeacher(client: ApiClient, keys = 3): Promise<Session> {
  const school = await createSchool('SD Uji AI')
  const teacher = await createTeacher(school)
  await createAiKeys(teacher, keys)
  const { sessionId } = await login(client, 'app', { email: teacher.email, password: PASSWORD })
  const page = await client
    .get('/coba-ai')
    .header('host', hosts.app)
    .withCookie(sessionCookieNames.app, sessionId!)
  const csrf = page.cookie('XSRF-TOKEN')?.value as string
  return { cookie: sessionCookieNames.app, sessionId: sessionId!, csrf, userId: teacher.id }
}

function post(
  client: ApiClient,
  session: Session,
  path: string,
  body: Record<string, unknown> = {}
) {
  return client
    .post(path)
    .header('host', hosts.app)
    .header('x-csrf-token', session.csrf)
    .withCookie(session.cookie, session.sessionId)
    .json(body)
    .redirects(0)
}

async function startDemo(client: ApiClient, session: Session, scenario = 'smooth') {
  const clientToken = uuidv4()
  const response = await post(client, session, '/coba-ai', { clientToken, scenario })
  response.assertStatus(302)
  return Generation.findByOrFail({ userId: session.userId, clientToken })
}

function statusOf(generation: Generation, wanted: Generation['status'][], timeoutMs = 10_000) {
  return eventually(
    async () => {
      const fresh = await Generation.findOrFail(generation.id)
      return wanted.includes(fresh.status) ? fresh : undefined
    },
    timeoutMs,
    `generation ${generation.id} to be ${wanted.join(' or ')}`
  )
}

/** Waits until the provider got its first call for a step. */
function callStarted(provider: FakeProvider, stepKey: string) {
  return eventually(
    async () => provider.calls.some((call) => call.stepKey === stepKey),
    10_000,
    `a ${stepKey} call`
  )
}

async function stepStatuses(generation: Generation) {
  const rows = await stepRows(generation)
  return rows.map((step) => step.status)
}

async function stepRows(generation: Generation) {
  return GenerationStep.query().where('generation_id', generation.id).orderBy('position', 'asc')
}

async function logOutcomes(generation: Generation) {
  const logs = await AiUsageLog.query().where('generation_id', generation.id).orderBy('id', 'asc')
  return logs.map((log) => `${log.stepKey}:${log.outcome}`)
}

/**
 * A provider whose "content" step answers after `contentDelayMs` (the
 * first time only); every other call answers at once.
 */
function slowContent(contentDelayMs: number) {
  // One instance for every step, so a test can see when the call started.
  let slowCalls = 0
  return new FakeProvider(({ trace }): FakeOutcome => {
    if (trace.stepKey === 'content' && slowCalls++ === 0) {
      return { kind: 'ok', delayMs: contentDelayMs }
    }
    return { kind: 'ok' }
  }, 10)
}

/**
 * The R0-06 spike end to end: a demo generation started over HTTP runs
 * on a real BullMQ worker (in this process), broadcasts its progress on
 * the user's Transmit channel, and can be cancelled and retried.
 */
test.group('AI generation job', (group) => {
  let worker: WorkerHandle | null = null
  let messages: { channel: string; payload: ProgressMessage }[] = []

  /** The broadcast snapshot sent once the generation reached `status`. */
  function broadcastWith(status: Generation['status']) {
    return eventually(
      async () =>
        messages.map((message) => message.payload.generation).find((g) => g.status === status),
      5_000,
      `a "${status}" broadcast`
    )
  }

  group.setup(async () => {
    await queue('ai').obliterate({ force: true })
    const stop = transmit.on('broadcast', ({ channel, payload }) => {
      messages.push({ channel, payload: payload as unknown as ProgressMessage })
    })
    return () => stop()
  })

  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(async () => {
    await redis.connection('ai').flushdb()
  })
  group.each.setup(() =>
    overrideConfig({
      'ai.fake.callDelayMs': 20,
      'ai.purposes.demo.timeoutMs': 5_000,
      'ai.gateway.transientBackoffMs': [5, 10],
      'ai.gateway.jitterMs': 0,
    })
  )
  group.each.setup(async () => {
    messages = []
    worker = await startWorker('ai', fastWorker)
    return async () => {
      aiProviders.restore()
      await worker?.close(0)
      worker = null
      await queue('ai').obliterate({ force: true })
    }
  })

  test('a started generation runs every step and reports each one live', async ({
    client,
    assert,
  }) => {
    const session = await signedInTeacher(client)
    const generation = await startDemo(client, session)

    await statusOf(generation, ['succeeded'])
    await broadcastWith('succeeded')

    const steps = await stepRows(generation)
    assert.deepEqual(
      steps.map((step) => [step.stepKey, step.status, step.attempts]),
      [
        ['outline', 'succeeded', 1],
        ['content', 'succeeded', 1],
        ['review', 'succeeded', 1],
      ]
    )
    assert.isString(steps[1].output?.text)

    const ours = messages.filter((message) => message.channel === userChannel(session.userId))
    const timeline = ours.map(({ payload }) =>
      [payload.generation.status, ...payload.generation.steps.map((step) => step.status[0])].join(
        ' '
      )
    )
    assert.deepEqual(timeline, [
      'queued p p p',
      'running r p p',
      'running s p p',
      'running s r p',
      'running s s p',
      'running s s r',
      'succeeded s s s',
    ])
    assert.isTrue(ours.every(({ payload }) => payload.generation.id === generation.publicId))

    // Every step used the key pinned by the first one (sticky selection).
    const keys = await AiUsageLog.query().where('generation_id', generation.id)
    assert.lengthOf(new Set(keys.map((log) => log.aiCredentialId)), 1)
  })

  test('a double submit creates one generation', async ({ client, assert }) => {
    const session = await signedInTeacher(client)
    const clientToken = uuidv4()

    await post(client, session, '/coba-ai', { clientToken })
    await post(client, session, '/coba-ai', { clientToken })

    const rows = await Generation.query().where('user_id', session.userId)
    assert.lengthOf(rows, 1)
  })

  test('a rate-limited key fails over and the new key stays pinned', async ({ client, assert }) => {
    const session = await signedInTeacher(client)
    const generation = await startDemo(client, session, 'rate_limited')

    const done = await statusOf(generation, ['succeeded'])

    assert.deepEqual(await logOutcomes(generation), [
      'outline:success',
      'content:rate_limited',
      'content:success',
      'review:success',
    ])
    const logs = await AiUsageLog.query().where('generation_id', generation.id).orderBy('id')
    assert.notEqual(logs[1].aiCredentialId, logs[2].aiCredentialId)
    assert.equal(logs[3].aiCredentialId, logs[2].aiCredentialId)
    assert.equal(done.pinnedCredentialId, logs[2].aiCredentialId)
  })

  test('a timeout and an empty reply recover inside the step', async ({ client, assert }) => {
    overrideConfig({ 'ai.purposes.demo.timeoutMs': 200 })
    const session = await signedInTeacher(client)

    const slow = await startDemo(client, session, 'timeout')
    await statusOf(slow, ['succeeded'])
    assert.includeMembers(await logOutcomes(slow), ['content:timeout', 'content:success'])

    const empty = await startDemo(client, session, 'empty_reply')
    await statusOf(empty, ['succeeded'])
    assert.includeMembers(await logOutcomes(empty), ['content:empty_reply', 'content:success'])
  })

  test('a failed generation shows why, and a retry resumes at the failed step', async ({
    client,
    assert,
  }) => {
    const session = await signedInTeacher(client)
    const generation = await startDemo(client, session, 'fails_then_recovers')

    const failed = await statusOf(generation, ['failed'])
    assert.equal(failed.errorClass, 'transient')
    assert.deepEqual(await stepStatuses(generation), ['succeeded', 'failed', 'pending'])
    const last = await broadcastWith('failed')
    assert.equal(last.status, 'failed')
    assert.equal(last.errorClass, 'transient')

    const retry = await post(client, session, `/coba-ai/${generation.publicId}/coba-lagi`)
    retry.assertStatus(302)
    const done = await statusOf(generation, ['succeeded'])

    assert.equal(done.runs, 2)
    const steps = await stepRows(generation)
    assert.deepEqual(
      steps.map((step) => [step.stepKey, step.status, step.attempts]),
      [
        ['outline', 'succeeded', 1],
        ['content', 'succeeded', 2],
        ['review', 'succeeded', 1],
      ]
    )
  })

  test('cancel stops a running step at once, and a retry finishes the job', async ({
    client,
    assert,
  }) => {
    const provider = slowContent(4_000)
    aiProviders.swap(() => provider)
    const session = await signedInTeacher(client)
    const generation = await startDemo(client, session)
    await callStarted(provider, 'content')

    const started = Date.now()
    const response = await post(client, session, `/coba-ai/${generation.publicId}/batal`)
    response.assertStatus(302)
    const cancelled = await Generation.findOrFail(generation.id)
    assert.equal(cancelled.status, 'cancelled')

    // The worker aborts the call well before its 4 s answer.
    await eventually(async () => {
      const outcomes = await logOutcomes(generation)
      return outcomes.includes('content:cancelled')
    })
    assert.isBelow(Date.now() - started, 2_000)
    assert.deepEqual(await stepStatuses(generation), ['succeeded', 'pending', 'pending'])
    await broadcastWith('cancelled')

    aiProviders.swap(() => FakeProvider.sequence([]))
    await post(client, session, `/coba-ai/${generation.publicId}/coba-lagi`)
    await statusOf(generation, ['succeeded'])
  })

  test('a generation of another user cannot be cancelled or retried', async ({ client }) => {
    const owner = await signedInTeacher(client)
    const generation = await startDemo(client, owner)
    await statusOf(generation, ['succeeded'])

    const other = await signedInTeacher(client)
    const cancel = await post(client, other, `/coba-ai/${generation.publicId}/batal`)
    cancel.assertStatus(404)
    const retry = await post(client, other, `/coba-ai/${generation.publicId}/coba-lagi`)
    retry.assertStatus(404)
  })

  test('only the owner may subscribe to a user channel', async ({ client }) => {
    const owner = await signedInTeacher(client)
    const other = await signedInTeacher(client)

    const subscribe = (session: Session, channel: string) =>
      post(client, session, '/__transmit/subscribe', { uid: uuidv4(), channel })

    const own = await subscribe(owner, userChannel(owner.userId))
    own.assertStatus(204)
    const foreign = await subscribe(other, userChannel(owner.userId))
    foreign.assertStatus(400)
    const unknown = await subscribe(owner, 'users/anything/generations')
    unknown.assertStatus(400)

    const anonymous = await client
      .post('/__transmit/subscribe')
      .header('host', hosts.app)
      .json({ uid: uuidv4(), channel: userChannel(owner.userId) })
      .redirects(0)
    anonymous.assertStatus(302)
  })

  test('a teacher may have two generations running at once', async ({ client, assert }) => {
    aiProviders.swap(() => slowContent(2_000))
    const session = await signedInTeacher(client)
    await startDemo(client, session)
    await startDemo(client, session)

    const third = await post(client, session, '/coba-ai', { clientToken: uuidv4() })
    third.assertStatus(302)
    const rows = await Generation.query().where('user_id', session.userId)
    assert.lengthOf(rows, 2)
  })

  test('a job whose worker died mid-call is finished by another worker', async ({
    client,
    assert,
  }) => {
    // The first worker hangs in "content" and is then closed without
    // releasing its job, like a killed process. Its call stays open until
    // the end of the test.
    const zombie = new AbortController()
    let hanging = false
    const hang: AIProvider = {
      name: 'hang',
      generate: (call) => {
        if (call.trace.stepKey !== 'content') return FakeProvider.sequence([]).generate(call)
        hanging = true
        return new Promise((_, reject) => {
          zombie.signal.addEventListener('abort', () => reject(new AICancelledError()))
        })
      },
    }
    let crashed = true
    aiProviders.swap(() => (crashed ? hang : FakeProvider.sequence([])))
    const session = await signedInTeacher(client)
    const generation = await startDemo(client, session)
    await eventually(async () => hanging, 10_000, 'the hanging call')

    await worker!.worker.close(true)
    crashed = false
    const killedAt = Date.now()
    worker = await startWorker('ai', fastWorker)

    try {
      await statusOf(generation, ['succeeded'], 15_000)
      assert.isBelow(Date.now() - killedAt, 10_000)
      assert.deepEqual(await logOutcomes(generation), [
        'outline:success',
        'content:unknown',
        'content:success',
        'review:success',
      ])
      const content = await GenerationStep.findByOrFail({
        generationId: generation.id,
        stepKey: 'content',
      })
      assert.equal(content.attempts, 2)
    } finally {
      zombie.abort()
    }
  })

  test('a worker shutting down mid-call puts the step back in the queue', async ({
    client,
    assert,
  }) => {
    const provider = slowContent(3_000)
    aiProviders.swap(() => provider)
    const session = await signedInTeacher(client)
    const generation = await startDemo(client, session)
    await callStarted(provider, 'content')

    await worker!.close(0)
    const content = await GenerationStep.findByOrFail({
      generationId: generation.id,
      stepKey: 'content',
    })
    assert.equal(content.status, 'pending')
    const waiting = await queue('ai').getWaitingCount()
    assert.equal(waiting, 1)

    aiProviders.swap(() => FakeProvider.sequence([]))
    worker = await startWorker('ai', fastWorker)
    await statusOf(generation, ['succeeded'])
    assert.deepEqual(await logOutcomes(generation), [
      'outline:success',
      'content:cancelled',
      'content:success',
      'review:success',
    ])
  })

  test('the demo page renders the latest generation and the user channel', async ({
    client,
    assert,
  }) => {
    const session = await signedInTeacher(client)
    const generation = await startDemo(client, session)
    await statusOf(generation, ['succeeded'])

    const page = await client
      .get('/coba-ai')
      .header('host', hosts.app)
      .withCookie(session.cookie, session.sessionId)
      .withInertia()
    page.assertStatus(200)
    page.assertInertiaComponent('school/ai_demo')
    assert.equal(page.inertiaProps.channel, userChannel(session.userId))
    assert.equal(page.inertiaProps.generation.id, generation.publicId)
    assert.equal(page.inertiaProps.generation.status, 'succeeded')
    assert.equal(page.inertiaProps.messages['ai_demo.title'], 'Coba AI')
    const total = await db.from('ai_credentials').where('user_id', session.userId).count('* as n')
    assert.equal(Number(total[0].n), 3)
  })
})
