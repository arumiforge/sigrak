// Browser render-time test: Typst WASM in Chromium, desktop and an emulated
// low-end Android phone (CPU throttling through CDP, phone viewport, throttled
// network). This is an emulation on the test machine, not a real device.
// Usage: node browser/bench.mjs [repeats]   -> results/browser-times.json
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { cpus, tmpdir } from 'node:os'
import { extname, join, normalize, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync, brotliCompressSync, constants as zlib } from 'node:zlib'

// Playwright is preinstalled outside this folder (NODE_PATH); not a dependency.
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const repeats = Number(process.argv[2] ?? 3)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.typ': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
}
const gzipCache = new Map()

// Static server for the spike folder, gzip like a production web server.
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(
    /^\/+/,
    ''
  )
  if (path.startsWith('..')) return res.writeHead(403).end()
  try {
    let body = gzipCache.get(path)
    if (!body) {
      body = gzipSync(await readFile(join(root, path)), { level: 9 })
      gzipCache.set(path, body)
    }
    res.writeHead(200, {
      'content-type': types[extname(path)] ?? 'application/octet-stream',
      'content-encoding': 'gzip',
      'cache-control': 'public, max-age=31536000, immutable',
    })
    res.end(body)
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

// Indonesian 4G is often slower than its headline speed; 9 Mbit/s down,
// 150 ms round trip is a cautious phone network.
const phoneNetwork = {
  offline: false,
  latency: 150,
  downloadThroughput: (9e6 / 8) | 0,
  uploadThroughput: (3e6 / 8) | 0,
}
const phone = {
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 13; SM-A045F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
}
const profiles = [
  { name: 'desktop (no throttling)', context: {}, cpu: 1, network: null },
  { name: 'phone, CPU 4x slower', context: phone, cpu: 4, network: phoneNetwork },
  { name: 'phone, CPU 6x slower (low-end)', context: phone, cpu: 6, network: phoneNetwork },
  { name: 'phone, CPU 10x slower (worst case)', context: phone, cpu: 10, network: phoneNetwork },
]

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

async function runOnce(profile) {
  // A persistent profile has a disk cache like a real phone browser; the
  // in-memory cache of a fresh context does not keep the 10 MB WASM file.
  const userDataDir = await mkdtemp(join(tmpdir(), 'typst-bench-'))
  const context = await chromium.launchPersistentContext(userDataDir, profile.context)
  browserVersion = context.browser()?.version() ?? browserVersion
  const page = context.pages()[0] ?? (await context.newPage())
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu })
  if (profile.network) {
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', profile.network)
  }
  page.on('pageerror', (e) => console.error('page error:', e.message))
  // First visit: nothing cached, everything over the (throttled) network.
  let start = Date.now()
  await page.goto(`${base}/browser/index.html`)
  await page.waitForFunction(() => window.benchReady === true, null, { timeout: 120000 })
  const coldPage = Date.now() - start
  const cold = await page.evaluate(() => window.runBench({ runs: 7 }))
  cold.page_to_ready_ms = coldPage + cold.startup_ms.total_until_ready
  // Second visit: files come from the HTTP cache, as on a returning teacher.
  start = Date.now()
  await page.reload()
  await page.waitForFunction(() => window.benchReady === true, null, { timeout: 120000 })
  const warmPage = Date.now() - start
  const warm = await page.evaluate(() => window.runBench({ runs: 7 }))
  warm.page_to_ready_ms = warmPage + warm.startup_ms.total_until_ready
  await context.close()
  await rm(userDataDir, { recursive: true, force: true })
  return { cold, warm }
}

const wasmPath =
  'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm'
const wasm = await readFile(join(root, wasmPath))
const sizes = {
  wasm_raw_mb: +(wasm.length / 1048576).toFixed(1),
  wasm_gzip9_mb: +(gzipSync(wasm, { level: 9 }).length / 1048576).toFixed(1),
  wasm_brotli9_mb: +(
    brotliCompressSync(wasm, { params: { [zlib.BROTLI_PARAM_QUALITY]: 9 } }).length / 1048576
  ).toFixed(1),
}
console.log(sizes)

// Pre-compress the WASM so the first measured visit does not wait for gzip.
gzipCache.set(wasmPath, gzipSync(wasm, { level: 9 }))
let browserVersion = 'unknown'
const out = []
for (const profile of profiles) {
  const runs = []
  for (let i = 0; i < repeats; i++) runs.push(await runOnce(profile))
  const pick = (f) => median(runs.map(f))
  const summary = {
    profile: profile.name,
    cpu_throttling: profile.cpu,
    network: profile.network ? '9 Mbit/s down, 150 ms latency' : 'local, no throttling',
    repeats,
    // From navigation until the compiler can render (page, WASM, fonts, data).
    first_visit_ready_ms: pick((r) => r.cold.page_to_ready_ms),
    returning_visit_ready_ms: pick((r) => r.warm.page_to_ready_ms),
    first_visit_wasm_init_ms: pick((r) => r.cold.startup_ms.wasm_fetch_and_init),
    returning_startup_ms: {
      wasm_init: pick((r) => r.warm.startup_ms.wasm_fetch_and_init),
      fonts: pick((r) => r.warm.startup_ms.fonts_fetch_and_load),
      project_and_latex: pick((r) => r.warm.startup_ms.project_load_and_latex),
    },
    wasm_memory_mb: Math.max(...runs.map((r) => r.warm.wasm_memory_mb)),
  }
  for (const doc of ['rpm', 'lkpd']) {
    summary[doc] = {
      first_render_ms: pick((r) => r.warm.results[doc].first_render_ms),
      paper_switch_ms: pick((r) => r.warm.results[doc].paper_switch_ms),
      edit_render_median_ms: pick((r) => r.warm.results[doc].edit_render_median_ms),
      edit_render_max_ms: Math.max(...runs.map((r) => r.warm.results[doc].edit_render_max_ms)),
    }
  }
  console.log(JSON.stringify(summary))
  out.push(summary)
}
server.close()

await mkdir(join(root, 'results'), { recursive: true })
await writeFile(
  join(root, 'results/browser-times.json'),
  JSON.stringify(
    {
      measured_at: new Date().toISOString(),
      browser: `Chromium ${browserVersion}`,
      host_cpu: cpus()[0]?.model,
      note: 'Emulated phone (CDP CPU throttling + phone viewport + throttled network), not a real device. Times are medians of the repeats.',
      sizes,
      profiles: out,
    },
    null,
    2
  ) + '\n'
)
