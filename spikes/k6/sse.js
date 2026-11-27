/*
 * R0-08: Transmit (SSE) connections held open on the web process.
 * Each VU signs in as its own teacher, reads its channel from /coba-ai,
 * opens GET /__transmit/events and subscribes to the channel, then keeps
 * the stream open for SSE_HOLD. k6 cannot read an SSE body while it
 * streams, so delivery latency is measured by sse-latency.mjs instead.
 * See README.md.
 *
 *   k6 run spikes/k6/sse.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'
import exec from 'k6/execution'
import { Counter, Rate, Gauge } from 'k6/metrics'
import { signedInClient, TARGET, uuid } from './lib.js'

const SSE_VUS = Number(__ENV.SSE_VUS || 200)
const SSE_HOLD = __ENV.SSE_HOLD || '240s'
const RAMP = __ENV.SSE_RAMP || '60s'

const subscribed = new Rate('sse_subscribed')
const streamsOpen = new Counter('sse_streams_opened')
const streamsHeld = new Rate('sse_stream_held_full_time')
const holdSeconds = new Gauge('sse_hold_seconds')

export const options = {
  scenarios: {
    sse: {
      executor: 'ramping-vus',
      startVUs: 0,
      // Each VU runs one long iteration: ramp up the logins, then hold.
      stages: [
        { duration: RAMP, target: SSE_VUS },
        { duration: SSE_HOLD, target: SSE_VUS },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'sse_subscribed': ['rate>0.99'],
    'sse_stream_held_full_time': ['rate>0.99'],
    'http_req_duration{name:POST /__transmit/subscribe}': ['p(95)<300'],
    'http_req_failed{kind:api}': ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

function seconds(value) {
  const match = String(value).match(/^(\d+)(ms|s|m)?$/)
  const n = Number(match ? match[1] : value)
  const unit = match ? match[2] : 's'
  return unit === 'ms' ? n / 1000 : unit === 'm' ? n * 60 : n
}

export default async function () {
  const client = signedInClient()
  const { response, page } = client.page('/coba-ai', 'GET /coba-ai')
  check(response, { 'coba-ai 200': (r) => r.status === 200 })
  const channel = page && page.props.channel
  if (!channel) {
    subscribed.add(false)
    return
  }

  // Hold until the end of the scenario, so every stream is open at the same time.
  const hold = Math.max(
    10,
    seconds(RAMP) + seconds(SSE_HOLD) - exec.instance.currentTestRunDuration / 1000 - 5
  )
  holdSeconds.add(hold)
  const uid = uuid()
  const openedAt = Date.now()
  const stream = http.asyncRequest('GET', `${TARGET}/__transmit/events?uid=${uid}`, null, {
    headers: client.headers({ Accept: 'text/event-stream' }),
    timeout: `${Math.round(hold)}s`,
    tags: { name: 'GET /__transmit/events', kind: 'stream' },
    responseType: 'none',
  })
  streamsOpen.add(1)
  sleep(1)

  const sub = http.post(`${TARGET}/__transmit/subscribe`, JSON.stringify({ uid, channel }), {
    headers: client.inertiaHeaders({ 'Content-Type': 'application/json' }),
    tags: { name: 'POST /__transmit/subscribe', kind: 'api' },
  })
  const ok = check(sub, { 'subscribe 2xx': (r) => r.status >= 200 && r.status < 300 })
  subscribed.add(ok)

  const result = await stream
  // The stream ends with a client timeout (status 0) after `hold`; anything
  // that ends earlier was dropped by the server.
  const heldMs = Date.now() - openedAt
  streamsHeld.add(heldMs >= hold * 1000 - 2000)
  check(result, { 'stream not closed early': () => heldMs >= hold * 1000 - 2000 })
  sleep(3600)
}
