import { test } from '@japa/runner'
import type { ApiClient, ApiResponse } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import { DateTime } from 'luxon'
import { hosts, type Area } from '#config/hosts'
import { sessionCookieNames } from '#config/session'
import User from '#models/user'
import ExamSession from '#models/exam_session'
import ExamParticipant from '#models/exam_participant'
import { PASSWORD, createSchool, createTeacher, overrideConfig, visit } from '#tests/helpers'

/**
 * Schools behind one public IP (D-479): the app reads the client IP
 * only through a trusted proxy, a lab of 300 signs in from one IP
 * within a minute, and guessing one account's password is still
 * stopped.
 */

const LAB = 300

function cookieValue(response: ApiResponse, name: string) {
  const value = response.cookie(name)?.value
  return typeof value === 'string' ? value : undefined
}

/** GET /masuk, then POST /masuk, both carrying the given X-Forwarded-For. */
async function signIn(
  client: ApiClient,
  area: Area,
  credentials: Record<string, string>,
  forwardedFor?: string
) {
  const cookieName = sessionCookieNames[area]
  const page = client.get('/masuk').header('host', hosts[area]).redirects(0)
  if (forwardedFor) page.header('x-forwarded-for', forwardedFor)
  const form = await page
  const sessionId = cookieValue(form, cookieName)
  const csrfToken = cookieValue(form, 'XSRF-TOKEN')
  if (!sessionId || !csrfToken) throw new Error(`No session or CSRF cookie from ${hosts[area]}`)

  const post = client
    .post('/masuk')
    .header('host', hosts[area])
    .header('x-csrf-token', csrfToken)
    .withCookie(cookieName, sessionId)
    .form(credentials)
    .redirects(0)
  if (forwardedFor) post.header('x-forwarded-for', forwardedFor)
  const response = await post
  return { response, sessionId: cookieValue(response, cookieName) ?? sessionId }
}

/** Runs `work` for 0…count-1, `batch` at a time. */
async function inBatches(count: number, batch: number, work: (index: number) => Promise<void>) {
  for (let start = 0; start < count; start += batch) {
    const end = Math.min(count, start + batch)
    await Promise.all(Array.from({ length: end - start }, (_, i) => work(start + i)))
  }
}

async function throttled(client: ApiClient, area: Area, sessionId: string, field: string) {
  const form = await visit(client, area, '/masuk', {
    name: sessionCookieNames[area],
    sessionId,
  }).withInertia()
  return /Terlalu banyak percobaan masuk/.test(form.inertiaProps.errors?.[field] ?? '')
}

test.group('Shared IP | the client IP comes only from a trusted proxy', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('a forged X-Forwarded-For from an untrusted address is ignored', async ({
    client,
    assert,
  }) => {
    // The test client connects from loopback, which TRUSTED_PROXIES does not list.
    const teacher = await createTeacher(await createSchool('SD Uji'))
    for (let attempt = 0; attempt < 5; attempt++) {
      await signIn(
        client,
        'app',
        { email: teacher.email, password: 'salah-sekali' },
        `198.51.100.${attempt + 1}`
      )
    }

    // A new forged IP does not escape the block: the app still sees loopback.
    const { response, sessionId } = await signIn(
      client,
      'app',
      { email: teacher.email, password: PASSWORD },
      '198.51.100.99'
    )
    assert.equal(response.header('location'), '/masuk')
    assert.isTrue(await throttled(client, 'app', sessionId, 'email'))
  })

  test('behind a trusted proxy the forwarded client IP is used', async ({
    client,
    assert,
    cleanup,
  }) => {
    cleanup(
      overrideConfig({
        'app.http.trustProxy': (address: string) =>
          ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address),
      })
    )
    const teacher = await createTeacher(await createSchool('SD Uji'))
    for (let attempt = 0; attempt < 5; attempt++) {
      await signIn(client, 'app', { email: teacher.email, password: 'salah' }, '198.51.100.7')
    }
    const blocked = await signIn(
      client,
      'app',
      { email: teacher.email, password: PASSWORD },
      '198.51.100.7'
    )
    assert.equal(blocked.response.header('location'), '/masuk')

    // The same account from another school's IP is not blocked (per account and IP).
    const other = await signIn(
      client,
      'app',
      { email: teacher.email, password: PASSWORD },
      '203.0.113.20'
    )
    assert.equal(other.response.header('location'), '/kalender')
  })
})

test.group('Shared IP | a lab of 300 signs in from one IP', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.timeout(120_000)

  test('300 teachers sign in on app. from one IP within a minute', async ({ client, assert }) => {
    const users = await User.createMany(
      Array.from({ length: LAB }, (_, i) => ({
        name: `Guru Lab ${i + 1}`,
        email: `guru-lab-${i + 1}@uji.test`,
        password: PASSWORD,
        nip: null,
      }))
    )
    const started = Date.now()
    const locations: (string | undefined)[] = []
    await inBatches(LAB, 30, async (index) => {
      // Every sign-in carries its own session cookie; the client keeps no jar.
      const { response } = await signIn(client, 'app', {
        email: users[index].email,
        password: PASSWORD,
      })
      locations[index] = response.header('location')
    })
    assert.isBelow(Date.now() - started, 60_000)
    assert.lengthOf(
      locations.filter((location) => location === '/kalender'),
      LAB
    )
  })

  test('300 pupils sign in on ujian. with exam cards from one IP within a minute', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Uji')
    const session = await ExamSession.create({
      schoolId: school.id,
      title: 'Simulasi Lab',
      opensAt: DateTime.now().minus({ hours: 1 }),
      closesAt: DateTime.now().plus({ hours: 2 }),
      status: 'open',
    })
    const password = ExamParticipant.encryptPassword(PASSWORD)
    await ExamParticipant.createMany(
      Array.from({ length: LAB }, (_, i) => ({
        examSessionId: session.id,
        username: `lab-${String(i + 1).padStart(3, '0')}`,
        password,
        status: 'not_started' as const,
      }))
    )
    const started = Date.now()
    const locations: (string | undefined)[] = []
    await inBatches(LAB, 30, async (index) => {
      const { response } = await signIn(client, 'exam', {
        username: `lab-${String(index + 1).padStart(3, '0')}`,
        password: PASSWORD,
      })
      locations[index] = response.header('location')
    })
    assert.isBelow(Date.now() - started, 60_000)
    assert.lengthOf(
      locations.filter((location) => location === '/'),
      LAB
    )
  })
})

test.group('Shared IP | guessing one password is still stopped', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('the sixth failed try on one exam card is refused, even with the right password', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Uji')
    const session = await ExamSession.create({
      schoolId: school.id,
      title: 'Simulasi Uji',
      opensAt: DateTime.now().minus({ hours: 1 }),
      closesAt: DateTime.now().plus({ hours: 2 }),
      status: 'open',
    })
    const card = await ExamParticipant.create({
      examSessionId: session.id,
      username: 'kartu-uji-01',
      password: ExamParticipant.encryptPassword(PASSWORD),
      status: 'not_started',
    })
    for (let attempt = 0; attempt < 5; attempt++) {
      await signIn(client, 'exam', { username: card.username, password: 'tebak' })
    }
    const { response, sessionId } = await signIn(client, 'exam', {
      username: card.username,
      password: PASSWORD,
    })
    assert.equal(response.header('location'), '/masuk')
    assert.isTrue(await throttled(client, 'exam', sessionId, 'username'))

    // Another pupil of the same lab (same IP) still signs in.
    const neighbour = await ExamParticipant.create({
      examSessionId: session.id,
      username: 'kartu-uji-02',
      password: ExamParticipant.encryptPassword(PASSWORD),
      status: 'not_started',
    })
    const ok = await signIn(client, 'exam', { username: neighbour.username, password: PASSWORD })
    assert.equal(ok.response.header('location'), '/')
  })
})
