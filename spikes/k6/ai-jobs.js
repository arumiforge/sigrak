/*
 * R0-08: starting AI generations on the demo page (/coba-ai) under load.
 * Needs AI_PROVIDER=fake on the web and worker-ai processes: the scripted
 * fake provider answers after 1.2 s per step, no key, no network. Never
 * point this at a setup with AI_PROVIDER=gemini. See README.md.
 *
 * Each VU is its own teacher (load users 101…), opens /coba-ai, starts a
 * three-step "smooth" generation, then polls the page every POLL_SECONDS
 * (a browser would listen over SSE; sse.js covers that) until it ends.
 *
 *   k6 run spikes/k6/ai-jobs.js
 */
import { check, sleep, fail } from 'k6'
import exec from 'k6/execution'
import { Trend, Counter } from 'k6/metrics'
import { signedInClient, uuid } from './lib.js'

const AI_VUS = Number(__ENV.AI_VUS || 10)
const HOLD = __ENV.HOLD || '3m'
const POLL_SECONDS = Number(__ENV.POLL_SECONDS || 2)
const USER_BASE = Number(__ENV.AI_USER_BASE || 100)

const generationSeconds = new Trend('ai_generation_seconds')
const overheadSeconds = new Trend('ai_overhead_seconds')
const outcomes = new Counter('ai_generations')

export const options = {
  scenarios: {
    ai: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: AI_VUS },
        { duration: HOLD, target: AI_VUS },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '60s',
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
    'http_req_duration{name:GET /coba-ai}': ['p(95)<300'],
    'http_req_duration{name:POST /coba-ai}': ['p(95)<500'],
    'ai_generation_seconds': ['p(95)<15'],
    'ai_generations{status:succeeded}': ['count>0'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

function latestGeneration(client) {
  const response = client.visit('/coba-ai', 'GET /coba-ai poll', {
    'X-Inertia-Partial-Component': 'school/ai_demo',
    'X-Inertia-Partial-Data': 'generation',
  })
  try {
    return response.json('props.generation')
  } catch {
    return null
  }
}

export default function () {
  const client = signedInClient(USER_BASE + exec.vu.idInTest - 1)

  const { response, page } = client.page('/coba-ai', 'GET /coba-ai')
  check(response, { 'coba-ai 200': (r) => r.status === 200 })
  if (!page || page.props.driver !== 'fake') {
    fail('the web process must run with AI_PROVIDER=fake')
  }
  const before = page.props.generation ? page.props.generation.id : null

  const started = client.post(
    '/coba-ai',
    { clientToken: uuid(), scenario: 'smooth' },
    'POST /coba-ai'
  )
  check(started, {
    'start redirects to /coba-ai': (r) => r.status >= 300 && r.status < 400,
  })

  const deadline = Date.now() + 120_000
  let generation = null
  while (Date.now() < deadline) {
    sleep(POLL_SECONDS)
    generation = latestGeneration(client)
    if (
      generation &&
      generation.id !== before &&
      ['succeeded', 'failed', 'cancelled'].includes(generation.status)
    ) {
      break
    }
  }

  const done = generation && generation.id !== before && generation.finishedAt
  check(generation, { 'generation succeeded': (g) => Boolean(done) && g.status === 'succeeded' })
  if (done) {
    outcomes.add(1, { status: generation.status })
    const created = Date.parse(generation.createdAt)
    generationSeconds.add((Date.parse(generation.finishedAt) - created) / 1000)
    // Time not spent inside AI calls: queue wait between steps plus the
    // runner's own work (database updates, snapshots, re-dispatch).
    const aiMs = (generation.attempts || []).reduce((sum, a) => sum + (a.latencyMs || 0), 0)
    overheadSeconds.add(Math.max(0, Date.parse(generation.finishedAt) - created - aiMs) / 1000)
  } else {
    outcomes.add(1, { status: generation ? generation.status : 'unknown' })
  }
  sleep(3 + Math.random() * 3)
}
