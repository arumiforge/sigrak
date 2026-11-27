#!/usr/bin/env node
/*
 * R0-06 measurements: how fast AI progress reaches the page, and what a
 * worker restart does to a running generation.
 *
 * Needs: the web process on http://127.0.0.1:3333 (`node ace serve`),
 * PostgreSQL and Redis with the demo seed (`node ace db:seed`),
 * AI_PROVIDER=fake, and Playwright with Chromium (not a dependency of the
 * app; install it globally or with `npx playwright install chromium`).
 * This script starts and stops `node ace queue:work ai` itself, so no
 * other worker may run.
 *
 *   node scripts/ai-job-spike/measure.cjs [runs]
 */
const { spawn } = require('node:child_process')
const path = require('node:path')
const { chromium } = require('playwright')

const ROOT = path.resolve(__dirname, '../..')
const BASE = 'http://app.sigrak.test:3333'
const RUNS = Number(process.argv[2] ?? 5)
const EMAIL = 'guru@sd-contoh.test'
const PASSWORD = 'sigrak-demo-2026'

const workers = new Set()
process.on('exit', () => workers.forEach((child) => child.kill('SIGKILL')))

function startWorker() {
  const child = spawn(process.execPath, ['ace', 'queue:work', 'ai'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  workers.add(child)
  child.once('exit', () => workers.delete(child))
  return new Promise((resolve, reject) => {
    const onData = (chunk) => {
      if (String(chunk).includes('ready')) resolve(child)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', (chunk) => process.stderr.write(chunk))
    child.once('exit', (code) => reject(new Error(`worker exited early (${code})`)))
  })
}

function stopWorker(child, signal) {
  return new Promise((resolve) => {
    const started = Date.now()
    child.removeAllListeners('exit')
    child.once('exit', (code, sig) => resolve({ code, signal: sig, ms: Date.now() - started }))
    child.kill(signal)
  })
}

/** Records every SSE message with the time the page received it. */
function recordServerSentEvents() {
  window.__sse = []
  const Original = window.EventSource
  window.EventSource = class extends Original {
    constructor(url, options) {
      super(url, options)
      this.addEventListener('message', (event) => {
        const receivedAt = Date.now()
        const data = JSON.parse(event.data)
        const entry = { receivedAt, paintedAt: null, payload: data.payload }
        window.__sse.push(entry)
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            entry.paintedAt = Date.now()
          })
        )
      })
    }
  }
}

async function startGeneration(page, scenario) {
  const previous = await page.getAttribute('[data-testid=generation]', 'data-id').catch(() => null)
  await page.check(`input[name=scenario][value=${scenario}]`)
  await page.click('[data-testid=start-generation]')
  await page.waitForFunction(
    (before) => {
      const element = document.querySelector('[data-testid=generation]')
      return element && element.getAttribute('data-id') !== before
    },
    previous,
    { timeout: 10_000 }
  )
  return page.getAttribute('[data-testid=generation]', 'data-id')
}

async function waitForStatus(page, id, statuses, timeout = 120_000) {
  await page.waitForFunction(
    ({ id: wanted, statuses: allowed }) => {
      const element = document.querySelector('[data-testid=generation]')
      return (
        element?.getAttribute('data-id') === wanted &&
        allowed.includes(element.getAttribute('data-status'))
      )
    },
    { id, statuses },
    { timeout }
  )
}

async function waitForStep(page, key, status, timeout = 30_000) {
  await page.waitForSelector(`[data-testid=step-${key}][data-status=${status}]`, { timeout })
}

function summary(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  return {
    count: sorted.length,
    min: sorted[0],
    median: pick(0.5),
    p95: pick(0.95),
    max: sorted[sorted.length - 1],
  }
}

async function main() {
  const { execSync } = require('node:child_process')
  if (execSync('pgrep -f "[a]ce queue:work" || true').toString().trim()) {
    throw new Error('Another `ace queue:work` process is running; stop it first.')
  }
  let worker = await startWorker()
  const browser = await chromium.launch({
    args: ['--host-resolver-rules=MAP *.sigrak.test 127.0.0.1'],
  })
  const page = await browser.newPage()
  await page.addInitScript(recordServerSentEvents)

  await page.goto(`${BASE}/masuk`)
  await page.fill('input[name=email]', EMAIL)
  await page.fill('input[name=password]', PASSWORD)
  await Promise.all([page.waitForURL('**/kalender'), page.click('button[type=submit]')])
  await page.goto(`${BASE}/coba-ai`)
  await page.waitForSelector('[data-testid=live-status][data-status=live]')

  // 1. Latency of every progress message, smooth runs.
  const ids = []
  for (let run = 0; run < RUNS; run++) {
    const id = await startGeneration(page, 'smooth')
    await waitForStatus(page, id, ['succeeded'])
    ids.push(id)
  }
  const messages = await page.evaluate(() => window.__sse)
  const ours = messages.filter((m) => ids.includes(m.payload?.generation?.id))
  const received = ours.map((m) => m.receivedAt - m.payload.changedAt)
  const painted = ours.filter((m) => m.paintedAt).map((m) => m.paintedAt - m.payload.changedAt)
  const stepChanges = ours.filter((m) => m.payload.generation.steps.some((s) => s.status !== 'pending'))

  console.log('\n== Progress latency (server state change -> page), smooth scenario')
  console.log('messages:', ours.length, 'for', ids.length, 'generations')
  console.log('received (ms):', summary(received))
  console.log('painted  (ms):', summary(painted))
  console.log('step messages over 1000 ms:', received.filter((ms) => ms > 1000).length)
  console.log('messages with a step change:', stepChanges.length)

  // 2. Graceful restart (SIGTERM) in the middle of a step.
  {
    const id = await startGeneration(page, 'smooth')
    await waitForStep(page, 'content', 'running')
    const stop = await stopWorker(worker, 'SIGTERM')
    const contentAfterStop = await page.getAttribute('[data-testid=step-content]', 'data-status')
    const restartAt = Date.now()
    worker = await startWorker()
    const readyMs = Date.now() - restartAt
    await waitForStatus(page, id, ['succeeded', 'failed'])
    const status = await page.getAttribute('[data-testid=generation]', 'data-status')
    console.log('\n== Worker restart, SIGTERM mid-step')
    console.log('worker exit:', stop, '| step "content" when the worker had stopped:', contentAfterStop)
    console.log('new worker ready after (ms):', readyMs)
    console.log('generation:', status, '| total after restart (ms):', Date.now() - restartAt)
  }

  // 3. Crash (SIGKILL) in the middle of a step.
  {
    const id = await startGeneration(page, 'smooth')
    await waitForStep(page, 'content', 'running')
    const killedAt = Date.now()
    await stopWorker(worker, 'SIGKILL')
    worker = await startWorker()
    const readyMs = Date.now() - killedAt
    await waitForStep(page, 'content', 'succeeded', 120_000)
    const resumedMs = Date.now() - killedAt
    await waitForStatus(page, id, ['succeeded', 'failed'])
    const status = await page.getAttribute('[data-testid=generation]', 'data-status')
    const attempts = await page.evaluate(
      (wanted) =>
        window.__sse
          .filter((m) => m.payload?.generation?.id === wanted)
          .at(-1)
          ?.payload.generation.attempts.map((a) => `${a.stepKey}:${a.outcome}`),
      id
    )
    console.log('\n== Worker crash, SIGKILL mid-step')
    console.log('new worker ready after (ms):', readyMs)
    console.log('step "content" finished after the kill (ms):', resumedMs)
    console.log('generation:', status, '| total after kill (ms):', Date.now() - killedAt)
    console.log('attempt log:', attempts?.join(', '))
  }

  await browser.close()
  await stopWorker(worker, 'SIGTERM')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
