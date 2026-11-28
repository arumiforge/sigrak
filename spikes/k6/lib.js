/*
 * Shared helpers for the R0-08 and R1-11 k6 scripts. See README.md.
 *
 * The skeleton runs on hostnames (app.<APP_DOMAIN>), so every request
 * carries a Host header and goes to TARGET (the web process or nginx).
 * In production mode cookies are `Secure`; k6's cookie jar will not send
 * them over plain http, so this file keeps the cookies itself.
 */
import http from 'k6/http'
import { check, fail } from 'k6'
import exec from 'k6/execution'

export const TARGET = __ENV.TARGET || 'http://127.0.0.1:3333'
export const APP_HOST = __ENV.APP_HOST || 'app.sigrak.test'
export const PASSWORD = __ENV.LOAD_PASSWORD || 'sigrak-demo-2026'
export const USER_COUNT = Number(__ENV.USER_COUNT || 300)
export const USER_OFFSET = Number(__ENV.USER_OFFSET || 0)

/** Load users from seed-load-users.sql or seed_r1_load.ts: beban001@sd-contoh.test … */
export function userEmail(index) {
  const n = (index % USER_COUNT) + 1
  return `beban${String(n).padStart(3, '0')}@sd-contoh.test`
}

/** R1-11 operators from seed_r1_load.ts, one per load school: operator-beban01@… */
export const OPERATOR_COUNT = Number(__ENV.OPERATOR_COUNT || 20)
export function operatorEmail(index) {
  const n = (index % OPERATOR_COUNT) + 1
  return `operator-beban${String(n).padStart(2, '0')}@sd-contoh.test`
}

/**
 * R1-11 tenant check: USERS_FILE is the JSON that seed_r1_load.ts writes
 * (e-mail → { school, own }). With it, the scripts check that every page shows
 * the signed-in user's own school and nothing of another school. Read in the
 * init context, as k6 requires for open().
 */
export const USERS = __ENV.USERS_FILE ? JSON.parse(open(__ENV.USERS_FILE)) : null

/**
 * Each VU looks like its own client IP. The web process trusts
 * X-Forwarded-For from loopback (AdonisJS default), as it will trust nginx
 * in production, so the per-IP login limit (30 POST /masuk per minute)
 * applies per VU and not to the whole test.
 */
export function clientIp(vu) {
  return `10.${(vu >> 16) & 255}.${(vu >> 8) & 255}.${vu & 255}`
}

export class Client {
  constructor(vu) {
    this.cookies = {}
    this.ip = clientIp(vu)
    this.inertiaVersion = null
    this.email = null
  }

  cookieHeader() {
    return Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
  }

  remember(response) {
    for (const [name, list] of Object.entries(response.cookies || {})) {
      const last = list[list.length - 1]
      if (!last) continue
      if (last.max_age !== undefined && last.max_age <= 0) delete this.cookies[name]
      else this.cookies[name] = last.value
    }
  }

  headers(extra = {}) {
    return {
      'Host': APP_HOST,
      'Cookie': this.cookieHeader(),
      'X-Forwarded-For': this.ip,
      'Accept-Encoding': 'gzip',
      ...extra,
    }
  }

  inertiaHeaders(extra = {}) {
    const xsrf = this.cookies['XSRF-TOKEN']
    return this.headers({
      'X-Inertia': 'true',
      'X-Inertia-Version': this.inertiaVersion || '',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'text/html, application/xhtml+xml',
      ...(xsrf ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrf) } : {}),
      ...extra,
    })
  }

  get(path, params = {}) {
    const response = http.get(`${TARGET}${path}`, {
      redirects: 0,
      ...params,
      headers: this.headers(params.headers),
    })
    this.remember(response)
    return response
  }

  /** First page load in a browser: the HTML with the Inertia page object. */
  page(path, name) {
    const response = this.get(path, { tags: { name } })
    const page = readPage(response)
    if (page) this.inertiaVersion = page.version
    return { response, page }
  }

  /** An Inertia XHR (partial reload or visit), JSON page object back. */
  visit(path, name, extra = {}) {
    const response = http.get(`${TARGET}${path}`, {
      redirects: 0,
      headers: this.inertiaHeaders(extra),
      tags: { name },
    })
    this.remember(response)
    return response
  }

  /** An Inertia form POST with the XSRF header, as the browser sends it. */
  post(path, body, name, extra = {}) {
    const response = http.post(`${TARGET}${path}`, JSON.stringify(body), {
      redirects: 0,
      headers: this.inertiaHeaders({ 'Content-Type': 'application/json', ...extra }),
      tags: { name },
    })
    this.remember(response)
    return response
  }

  /** GET /masuk then POST /masuk; true when the session is signed in. */
  login(email) {
    this.email = email
    const { response: form } = this.page('/masuk', 'GET /masuk')
    check(form, { 'login form 200': (r) => r.status === 200 })
    const response = this.post('/masuk', { email, password: PASSWORD }, 'POST /masuk')
    const ok = check(response, {
      'login redirects to /kalender': (r) =>
        r.status >= 300 && r.status < 400 && (r.headers.Location || '').endsWith('/kalender'),
    })
    return ok
  }
}

/** The Inertia page object embedded in the HTML (`<script data-page>`). */
export function readPage(response) {
  if (typeof response.body !== 'string') return null
  const match = response.body.match(
    /<script data-page="app" type="application\/json">(.*?)<\/script>/s
  )
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

/** Signs a VU in once and keeps the client across iterations. */
const clients = {}
export function signedInClient(emailIndex, email) {
  const vu = exec.vu.idInTest
  if (!clients[vu]) {
    const client = new Client(vu)
    if (!client.login(email ?? userEmail(emailIndex ?? USER_OFFSET + vu - 1))) {
      fail(`VU ${vu} could not sign in`)
    }
    clients[vu] = client
  }
  return clients[vu]
}

/** The Inertia props of an XHR response, or null. */
export function propsOf(response) {
  try {
    return response.json('props')
  } catch {
    return null
  }
}

/**
 * Comma-separated deferred props of a page (all groups), as the browser
 * asks for them after the first render.
 */
export function deferredOf(page) {
  if (!page || !page.deferredProps) return ''
  return Object.values(page.deferredProps).flat().join(',')
}

export function uuid() {
  // RFC 4122 v4 from Math.random; enough for client tokens and Transmit uids in a test.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
