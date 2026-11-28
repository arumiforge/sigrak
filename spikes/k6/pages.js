/*
 * Page load and sign-in under light load: R0-08 (skeleton) and R1-11 (the R1
 * pages behind row-level security). See README.md.
 *
 * Scenarios
 * - browse: signed-in teachers, ramp to PAGE_VUS (default 50), THINK_MIN…THINK_MAX
 *   seconds (2…5) between views. Each view opens /kalender as a browser does
 *   (HTML shell, then one partial reload with the deferred props). With R1=1 the
 *   teachers take the R1 pages in turn: /kalender, /ekstrakurikuler,
 *   /kelas-saya/jadwal.
 * - operators (R1=1 only): OPERATOR_VUS (default 10) school operators, same ramp
 *   and think time, in turn: /jadwal, /kelas/:class/jadwal of a random class,
 *   /kalender?kelas=… (effective days of that class).
 * - logins: fresh sign-ins (GET /masuk, POST /masuk, first /kalender) at
 *   LOGIN_RATE per second (default 2), each from its own client IP.
 *
 * With USERS_FILE (written by seed_r1_load.ts) every page is checked for the
 * signed-in user's own school: the school name on /kalender and the school's
 * own extracurricular on /ekstrakurikuler (`tenant` checks).
 *
 *   k6 run spikes/k6/pages.js                                   # R0-08 shape
 *   R1=1 USERS_FILE=/abs/path/load-users.json k6 run spikes/k6/pages.js
 */
import { check, sleep } from 'k6'
import exec from 'k6/execution'
import { Rate } from 'k6/metrics'
import {
  Client,
  deferredOf,
  operatorEmail,
  propsOf,
  signedInClient,
  userEmail,
  USER_COUNT,
  USERS,
} from './lib.js'

const R1 = __ENV.R1 === '1'
const PAGE_VUS = Number(__ENV.PAGE_VUS || 50)
const OPERATOR_VUS = Number(__ENV.OPERATOR_VUS || 10)
const LOGIN_RATE = Number(__ENV.LOGIN_RATE || 2)
const HOLD = __ENV.HOLD || '3m'
// Think time between page views (seconds); THINK_MAX=0 turns this into a capacity test.
const THINK_MIN = Number(__ENV.THINK_MIN ?? 2)
const THINK_MAX = Number(__ENV.THINK_MAX ?? 5)

const tenantOk = new Rate('tenant_own_school')

const stages = (target) => [
  { duration: '1m', target },
  { duration: HOLD, target },
  { duration: '20s', target: 0 },
]

const budget = ['p(95)<300', 'p(99)<800']

export const options = {
  discardResponseBodies: false,
  scenarios: {
    ...(PAGE_VUS > 0
      ? {
          browse: {
            executor: 'ramping-vus',
            exec: 'browse',
            startVUs: 0,
            stages: stages(PAGE_VUS),
            gracefulRampDown: '10s',
          },
        }
      : {}),
    ...(R1 && OPERATOR_VUS > 0
      ? {
          operators: {
            executor: 'ramping-vus',
            exec: 'operator',
            startVUs: 0,
            stages: stages(OPERATOR_VUS),
            gracefulRampDown: '10s',
          },
        }
      : {}),
    ...(LOGIN_RATE > 0
      ? {
          logins: {
            executor: 'constant-arrival-rate',
            exec: 'loginFlow',
            rate: LOGIN_RATE,
            timeUnit: '1s',
            duration: __ENV.LOGIN_DURATION || '4m',
            startTime: __ENV.LOGIN_START || '30s',
            preAllocatedVUs: Math.max(10, LOGIN_RATE * 2),
            maxVUs: Math.max(40, LOGIN_RATE * 8),
          },
        }
      : {}),
  },
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
    'http_req_duration{name:GET /kalender}': budget,
    'http_req_duration{name:GET /kalender entries}': budget,
    'http_req_duration{name:GET /masuk}': ['p(95)<200'],
    'http_req_duration{name:POST /masuk}': ['p(95)<800', 'p(99)<1500'],
    ...(R1
      ? {
          'http_req_duration{name:GET /ekstrakurikuler}': budget,
          'http_req_duration{name:GET /kelas-saya/jadwal}': budget,
          'http_req_duration{name:GET /jadwal}': budget,
          'http_req_duration{name:GET /kelas/:class/jadwal}': budget,
          'http_req_duration{name:GET /kalender?kelas}': budget,
          'http_req_duration{name:GET /kalender?kelas entries}': budget,
          ...(USERS ? { tenant_own_school: ['rate==1'] } : {}),
        }
      : {}),
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

function expected(client) {
  return USERS ? USERS[client.email] : null
}

function openCalendar(client, query = '', name = 'GET /kalender') {
  const { response, page } = client.page(`/kalender${query}`, name)
  check(response, {
    'kalender 200': (r) => r.status === 200,
    'kalender defers entries': () => Boolean(page && page.deferredProps),
  })
  const want = expected(client)
  if (want && page) {
    const ok = Boolean(page.props.school) && page.props.school.name === want.school
    tenantOk.add(ok)
    check(page, { 'tenant: kalender shows own school': () => ok })
  }
  const entries = client.visit(`/kalender${query}`, `${name} entries`, {
    'X-Inertia-Partial-Component': 'school/calendar',
    'X-Inertia-Partial-Data': deferredOf(page) || 'entries',
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
  return page
}

function openExtracurriculars(client) {
  const response = client.visit('/ekstrakurikuler', 'GET /ekstrakurikuler')
  const props = propsOf(response)
  check(response, {
    'ekstrakurikuler 200': (r) => r.status === 200,
    'ekstrakurikuler items': () => Boolean(props) && props.items.length > 0,
  })
  const want = expected(client)
  if (want && props) {
    // Exactly the school's own item, and no other school's.
    const own = props.items.filter((item) => item.own).map((item) => item.label)
    const ok = own.length === 1 && own[0] === want.own
    tenantOk.add(ok)
    check(props, { 'tenant: ekstrakurikuler shows own items only': () => ok })
  }
}

function openMyTimetable(client) {
  const response = client.visit('/kelas-saya/jadwal', 'GET /kelas-saya/jadwal')
  const props = propsOf(response)
  check(response, {
    'kelas-saya/jadwal 200': (r) => r.status === 200,
    'kelas-saya/jadwal lessons listed': () => Boolean(props) && Array.isArray(props.lessons),
  })
}

const turns = {}
function nextTurn() {
  const vu = exec.vu.idInTest
  turns[vu] = (turns[vu] ?? -1) + 1
  return turns[vu]
}

function think() {
  if (THINK_MAX > 0) sleep(THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN))
}

export function browse() {
  const client = signedInClient()
  if (!R1) {
    openCalendar(client)
  } else {
    const turn = nextTurn() % 3
    if (turn === 0) openCalendar(client)
    else if (turn === 1) openExtracurriculars(client)
    else openMyTimetable(client)
  }
  think()
}

const classesOf = {}
export function operator() {
  const vu = exec.vu.idInTest
  const client = signedInClient(null, operatorEmail(vu - 1))
  const turn = nextTurn() % 3
  if (turn === 0 || !classesOf[vu]) {
    const response = client.visit('/jadwal', 'GET /jadwal')
    const props = propsOf(response)
    check(response, {
      'jadwal 200': (r) => r.status === 200,
      'jadwal lists 12 classes': () => Boolean(props) && props.classes.length === 12,
    })
    if (props && props.classes) classesOf[vu] = props.classes.map((row) => row.publicId)
  } else {
    const classes = classesOf[vu]
    const id = classes[Math.floor(Math.random() * classes.length)]
    if (turn === 1) {
      const response = client.visit(`/kelas/${id}/jadwal`, 'GET /kelas/:class/jadwal')
      const props = propsOf(response)
      check(response, {
        'kelas jadwal 200': (r) => r.status === 200,
        'kelas jadwal rows': () => Boolean(props) && props.rows.length > 0,
      })
    } else {
      openCalendar(client, `?kelas=${id}`, 'GET /kalender?kelas')
    }
  }
  think()
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
