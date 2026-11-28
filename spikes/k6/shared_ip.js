/*
 * R2-10 (D-479): a lab behind one school IP signs in at the start of a lesson
 * or exam. See README.md.
 *
 * Scenarios, every request from the same client IP (SCHOOL_IP, sent as
 * X-Forwarded-For; run the web process with TRUSTED_PROXIES=127.0.0.1 so the
 * app reads it as nginx would hand it over):
 * - pupils: LAB (300) exam cards lab-001…lab-300 (seed_exam_cards.ts) sign in
 *   on ujian. within WINDOW (60 s): GET /masuk, POST /masuk, then the exam home.
 * - teachers: LAB load teachers beban001…beban300 (seed-load-users.sql) sign
 *   in on app. in the same window: GET /masuk, POST /masuk, then /kalender.
 *
 * Every sign-in must succeed: no throttle message, no 429, no error. A wrong
 * password is never sent, so the per-account limit plays no part.
 *
 *   k6 run spikes/k6/shared_ip.js                    # both scenarios together
 *   SCENARIO=pupils k6 run spikes/k6/shared_ip.js    # only the exam cards
 */
import { check } from 'k6'
import exec from 'k6/execution'
import { Counter } from 'k6/metrics'
import { APP_HOST, Client, PASSWORD, userEmail } from './lib.js'

const EXAM_HOST = __ENV.EXAM_HOST || APP_HOST.replace(/^app\./, 'ujian.')
const SCHOOL_IP = __ENV.SCHOOL_IP || '203.0.113.10'
const LAB = Number(__ENV.LAB || 300)
const WINDOW_S = Number(__ENV.WINDOW || 60)
const CARD_PASSWORD = __ENV.CARD_PASSWORD || 'kartu-lab'
const SCENARIO = __ENV.SCENARIO || 'both'

const signedIn = new Counter('signed_in')
const refused = new Counter('sign_in_refused')

const lab = (fn) => ({
  executor: 'constant-arrival-rate',
  exec: fn,
  // LAB sign-ins spread evenly over the window.
  rate: LAB,
  timeUnit: `${WINDOW_S}s`,
  duration: `${WINDOW_S}s`,
  preAllocatedVUs: 50,
  maxVUs: 300,
})

export const options = {
  discardResponseBodies: false,
  scenarios: {
    ...(SCENARIO !== 'teachers' ? { pupils: lab('pupil') } : {}),
    ...(SCENARIO !== 'pupils' ? { teachers: lab('teacher') } : {}),
  },
  thresholds: {
    'checks': ['rate==1'],
    'http_req_failed': ['rate==0'],
    'sign_in_refused': ['count==0'],
    'http_req_duration{name:POST /masuk ujian}': ['p(95)<800'],
    'http_req_duration{name:POST /masuk app}': ['p(95)<800'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

/** A browser of the lab: its own cookies, the school's one IP. */
function labClient(host) {
  const client = new Client(exec.vu.idInTest)
  client.ip = SCHOOL_IP
  const headers = client.headers.bind(client)
  client.headers = (extra = {}) => headers({ Host: host, ...extra })
  return client
}

function signIn(client, area, body, home) {
  const { response: form } = client.page('/masuk', `GET /masuk ${area}`)
  check(form, { [`${area}: login form 200`]: (r) => r.status === 200 })
  const response = client.post('/masuk', body, `POST /masuk ${area}`)
  const location = response.headers.Location || ''
  const ok = check(response, {
    [`${area}: signed in`]: (r) => r.status >= 300 && r.status < 400 && location.endsWith(home),
  })
  if (ok) {
    signedIn.add(1, { area })
    const page = client.get(home, { tags: { name: `GET ${home} ${area}` } })
    check(page, { [`${area}: home 200`]: (r) => r.status === 200 })
  } else {
    refused.add(1, { area })
  }
}

export function pupil() {
  const n = exec.scenario.iterationInTest
  if (n >= LAB) return
  const username = `lab-${String(n + 1).padStart(3, '0')}`
  signIn(labClient(EXAM_HOST), 'ujian', { username, password: CARD_PASSWORD }, '/')
}

export function teacher() {
  const n = exec.scenario.iterationInTest
  if (n >= LAB) return
  signIn(labClient(APP_HOST), 'app', { email: userEmail(n), password: PASSWORD }, '/kalender')
}
