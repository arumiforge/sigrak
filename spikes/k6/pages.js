/*
 * R0-08: page load and sign-in under light load. See README.md.
 *
 * Scenarios
 * - browse: signed-in teachers open /kalender as a browser does (HTML shell,
 *   then the deferred `entries` partial reload), with think time.
 *   Ramps to PAGE_VUS (default 50), THINK_MIN…THINK_MAX seconds (2…5) between views.
 * - logins: fresh sign-ins (GET /masuk, POST /masuk, first /kalender) at
 *   LOGIN_RATE per second (default 2), each from its own client IP.
 *
 *   k6 run spikes/k6/pages.js
 */
import { check, sleep } from 'k6'
import exec from 'k6/execution'
import { Client, signedInClient, userEmail, USER_COUNT } from './lib.js'

const PAGE_VUS = Number(__ENV.PAGE_VUS || 50)
const LOGIN_RATE = Number(__ENV.LOGIN_RATE || 2)
const HOLD = __ENV.HOLD || '3m'
// Think time between page views (seconds); THINK_MAX=0 turns this into a capacity test.
const THINK_MIN = Number(__ENV.THINK_MIN ?? 2)
const THINK_MAX = Number(__ENV.THINK_MAX ?? 5)

export const options = {
  discardResponseBodies: false,
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      exec: 'browse',
      startVUs: 0,
      stages: [
        { duration: '1m', target: PAGE_VUS },
        { duration: HOLD, target: PAGE_VUS },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
    logins: {
      executor: 'constant-arrival-rate',
      exec: 'loginFlow',
      rate: LOGIN_RATE,
      timeUnit: '1s',
      duration: __ENV.LOGIN_DURATION || '4m',
      startTime: '30s',
      preAllocatedVUs: 10,
      maxVUs: 40,
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
    'http_req_duration{name:GET /kalender}': ['p(95)<300', 'p(99)<800'],
    'http_req_duration{name:GET /kalender entries}': ['p(95)<300', 'p(99)<800'],
    'http_req_duration{name:GET /masuk}': ['p(95)<200'],
    'http_req_duration{name:POST /masuk}': ['p(95)<800', 'p(99)<1500'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

function openCalendar(client) {
  const { response, page } = client.page('/kalender', 'GET /kalender')
  check(response, {
    'kalender 200': (r) => r.status === 200,
    'kalender defers entries': () => Boolean(page && page.deferredProps),
  })
  const entries = client.visit('/kalender', 'GET /kalender entries', {
    'X-Inertia-Partial-Component': 'school/calendar',
    'X-Inertia-Partial-Data': 'entries',
  })
  check(entries, {
    'entries 200': (r) => r.status === 200,
    'entries present': (r) => {
      try {
        return Array.isArray(r.json('props.entries'))
      } catch {
        return false
      }
    },
  })
}

export function browse() {
  const client = signedInClient()
  openCalendar(client)
  if (THINK_MAX > 0) sleep(THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN))
}

export function loginFlow() {
  // A new client and IP per sign-in; spread over the load users from the top end
  // so the browse VUs' sessions are not the ones being replaced.
  const n = exec.scenario.iterationInTest
  const client = new Client(1000 + n)
  if (client.login(userEmail(USER_COUNT - 1 - (n % 100)))) {
    openCalendar(client)
  }
}
