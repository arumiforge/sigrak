#!/usr/bin/env node
/*
 * R0-08: SSE delivery latency, run next to the k6 scripts (k6 cannot read
 * an SSE body while it streams). Plain Node, no dependencies.
 *
 * Signs in PROBE_USERS teachers (load users from PROBE_USER_BASE + 1), opens
 * one Transmit stream per teacher, subscribes to their generations channel,
 * then starts a "smooth" fake-provider generation per teacher every
 * PROBE_EVERY_S seconds for PROBE_DURATION_S seconds. For every progress
 * message it records now - changedAt (server time of the state change, after
 * the database update; same machine, same clock). Prints one JSON summary.
 *
 *   node spikes/k6/sse-latency.mjs
 *
 * Env: TARGET (http://127.0.0.1:3333), APP_HOST (app.sigrak.test),
 * LOAD_PASSWORD, PROBE_USERS (10), PROBE_USER_BASE (230), PROBE_EVERY_S (10),
 * PROBE_DURATION_S (180). Needs AI_PROVIDER=fake.
 */
import http from 'node:http'
import { randomUUID } from 'node:crypto'

const target = new URL(process.env.TARGET ?? 'http://127.0.0.1:3333')
const host = process.env.APP_HOST ?? 'app.sigrak.test'
const password = process.env.LOAD_PASSWORD ?? 'sigrak-demo-2026'
const users = Number(process.env.PROBE_USERS ?? 10)
const base = Number(process.env.PROBE_USER_BASE ?? 230)
const everyS = Number(process.env.PROBE_EVERY_S ?? 10)
const durationS = Number(process.env.PROBE_DURATION_S ?? 180)
const agent = new http.Agent({ keepAlive: true, maxSockets: 64 })

function request(method, path, { headers = {}, body, stream = false } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: target.hostname,
        port: target.port,
        method,
        path,
        headers: { Host: host, ...headers },
        agent: stream ? false : agent,
      },
      (res) => {
        if (stream) return resolve(res)
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString(),
          })
        )
      }
    )
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

class Session {
  constructor(n) {
    this.ip = `10.250.${n >> 8}.${n & 255}`
    this.cookies = new Map()
  }
  remember(res) {
    for (const line of [].concat(res.headers['set-cookie'] ?? [])) {
      const [pair] = line.split(';')
      const i = pair.indexOf('=')
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1))
    }
  }
  headers(extra = {}) {
    const cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    const xsrf = this.cookies.get('XSRF-TOKEN')
    return {
      'Cookie': cookie,
      'X-Forwarded-For': this.ip,
      ...(xsrf ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } : {}),
      ...extra,
    }
  }
  async get(path) {
    const res = await request('GET', path, { headers: this.headers() })
    this.remember(res)
    return res
  }
  async post(path, data) {
    const res = await request('POST', path, {
      headers: this.headers({
        'Content-Type': 'application/json',
        'X-Inertia': 'true',
        'X-Inertia-Version': this.version ?? '',
        'X-Requested-With': 'XMLHttpRequest',
      }),
      body: JSON.stringify(data),
    })
    this.remember(res)
    return res
  }
  page(res) {
    const match = res.body.match(
      /<script data-page="app" type="application\/json">(.*?)<\/script>/s
    )
    const page = match ? JSON.parse(match[1]) : null
    if (page) this.version = page.version
    return page
  }
}

const latencies = []
let messages = 0
let started = 0
let finished = 0

async function probe(n) {
  const s = new Session(n)
  s.page(await s.get('/masuk'))
  const email = `beban${String(n).padStart(3, '0')}@sd-contoh.test`
  const login = await s.post('/masuk', { email, password })
  if (login.status !== 302 && login.status !== 303)
    throw new Error(`login ${email}: ${login.status}`)
  const page = s.page(await s.get('/coba-ai'))
  if (page?.props?.driver !== 'fake')
    throw new Error('the web process must run with AI_PROVIDER=fake')

  const uid = randomUUID()
  const res = await request('GET', `/__transmit/events?uid=${uid}`, {
    headers: s.headers({ Accept: 'text/event-stream' }),
    stream: true,
  })
  let buffer = ''
  res.setEncoding('utf8')
  res.on('data', (chunk) => {
    const receivedAt = Date.now()
    buffer += chunk
    let end
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const data = event
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('\n')
      if (!data) continue
      try {
        const payload = JSON.parse(data).payload
        if (payload?.type === 'generation') {
          messages++
          latencies.push(receivedAt - payload.changedAt)
          if (['succeeded', 'failed', 'cancelled'].includes(payload.generation.status)) finished++
        }
      } catch {}
    }
  })
  await new Promise((r) => setTimeout(r, 300))
  const sub = await s.post('/__transmit/subscribe', { uid, channel: page.props.channel })
  if (sub.status >= 300) throw new Error(`subscribe: ${sub.status}`)

  const until = Date.now() + durationS * 1000
  await new Promise((r) => setTimeout(r, Math.random() * everyS * 1000))
  while (Date.now() < until) {
    const r = await s.post('/coba-ai', { clientToken: randomUUID(), scenario: 'smooth' })
    if (r.status === 302 || r.status === 303) started++
    await new Promise((r) => setTimeout(r, everyS * 1000))
  }
  await new Promise((r) => setTimeout(r, 8000))
  res.destroy()
}

const pct = (sorted, p) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
    : null

await Promise.all(Array.from({ length: users }, (_, i) => probe(base + i + 1)))
const sorted = [...latencies].sort((a, b) => a - b)
console.log(
  JSON.stringify({
    probeUsers: users,
    generationsStarted: started,
    generationsFinishedSeen: finished,
    messages,
    latencyMs: {
      min: sorted[0] ?? null,
      p50: pct(sorted, 50),
      p95: pct(sorted, 95),
      p99: pct(sorted, 99),
      max: sorted.at(-1) ?? null,
    },
    over1s: sorted.filter((v) => v > 1000).length,
  })
)
agent.destroy()
