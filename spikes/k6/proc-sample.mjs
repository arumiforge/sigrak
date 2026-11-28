#!/usr/bin/env node
/*
 * R1-11: CPU and memory per process group, every INTERVAL_MS (default 5000),
 * as JSON lines on stdout. Linux only (/proc), no dependencies. Used instead of
 * `pidstat -C postgres` when other PostgreSQL servers run on the same machine:
 * a group is a root PID with all its descendants (the postmaster and its
 * backends), or every process with a given command name.
 *
 *   node spikes/k6/proc-sample.mjs pg=pid:1234 web=pid:2345 redis=comm:redis-server k6=comm:k6 > samples.jsonl
 *
 * Per group and interval: cpu (% of one core), rss (MB, summed; shared memory
 * such as shared_buffers counts once per process) and the process count.
 */
import { readdirSync, readFileSync } from 'node:fs'

const interval = Number(process.env.INTERVAL_MS ?? 5000)
const ticks = 100 // USER_HZ on Linux
const pageMb = 4096 / 1024 / 1024

const groups = process.argv.slice(2).map((arg) => {
  const [name, spec] = arg.split('=')
  const [kind, value] = spec.split(':')
  return { name, kind, value }
})

function snapshot() {
  const procs = new Map()
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, 'utf8')
      const close = stat.lastIndexOf(')')
      const comm = stat.slice(stat.indexOf('(') + 1, close)
      const fields = stat.slice(close + 2).split(' ')
      procs.set(Number(entry), {
        comm,
        ppid: Number(fields[1]),
        cpu: Number(fields[11]) + Number(fields[12]),
        rss: Number(fields[21]) * pageMb,
      })
    } catch {
      // The process ended while reading.
    }
  }
  return procs
}

function members(procs, group) {
  if (group.kind === 'comm') {
    return [...procs].filter(([, p]) => p.comm === group.value).map(([pid]) => pid)
  }
  const root = Number(group.value)
  const found = new Set(procs.has(root) ? [root] : [])
  let grew = true
  while (grew) {
    grew = false
    for (const [pid, p] of procs) {
      if (!found.has(pid) && found.has(p.ppid)) {
        found.add(pid)
        grew = true
      }
    }
  }
  return [...found]
}

let last = snapshot()
let lastAt = performance.now()
setInterval(() => {
  const now = snapshot()
  const at = performance.now()
  const seconds = (at - lastAt) / 1000
  const line = { at: new Date().toISOString() }
  for (const group of groups) {
    const pids = members(now, group)
    let cpu = 0
    let rss = 0
    for (const pid of pids) {
      const p = now.get(pid)
      const before = last.get(pid)
      cpu += p.cpu - (before && before.comm === p.comm ? before.cpu : 0)
      rss += p.rss
    }
    line[group.name] = {
      cpu: Math.round((cpu / ticks / seconds) * 1000) / 10,
      rss: Math.round(rss),
      n: pids.length,
    }
  }
  process.stdout.write(`${JSON.stringify(line)}\n`)
  last = now
  lastAt = at
}, interval)
