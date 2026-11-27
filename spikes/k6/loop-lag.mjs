/*
 * R0-08 probe, preloaded into a Node process with `--import`; changes no app code.
 * Every LOOP_LAG_INTERVAL_MS (default 5000) it appends one JSON line to LOOP_LAG_FILE:
 * event-loop delay (p50/p99/max, ms), CPU used in the interval (% of one core),
 * RSS and heap (MB). Without LOOP_LAG_FILE it does nothing. The delay values
 * include the 10 ms sampling resolution: subtract 10 for the actual lag.
 *
 *   LOOP_LAG_FILE=/tmp/web.jsonl node --import ./spikes/k6/loop-lag.mjs bin/server.js
 */
import { appendFileSync } from 'node:fs'
import { monitorEventLoopDelay } from 'node:perf_hooks'

const file = process.env.LOOP_LAG_FILE
if (file) {
  const interval = Number(process.env.LOOP_LAG_INTERVAL_MS ?? 5000)
  const histogram = monitorEventLoopDelay({ resolution: 10 })
  histogram.enable()
  let lastCpu = process.cpuUsage()
  let lastAt = performance.now()

  const timer = setInterval(() => {
    const now = performance.now()
    const cpu = process.cpuUsage(lastCpu)
    const memory = process.memoryUsage()
    const ms = (ns) => Math.round(ns / 1e4) / 100
    const line = {
      at: new Date().toISOString(),
      pid: process.pid,
      lagP50: ms(histogram.percentile(50)),
      lagP99: ms(histogram.percentile(99)),
      lagMax: ms(histogram.max),
      cpuPct: Math.round(((cpu.user + cpu.system) / 1000 / (now - lastAt)) * 1000) / 10,
      rssMb: Math.round(memory.rss / 1048576),
      heapMb: Math.round(memory.heapUsed / 1048576),
    }
    appendFileSync(file, `${JSON.stringify(line)}\n`)
    histogram.reset()
    lastCpu = process.cpuUsage()
    lastAt = now
  }, interval)
  timer.unref()
}
