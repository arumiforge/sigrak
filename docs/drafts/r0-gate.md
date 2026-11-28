# R0 gate report: results of the R0 spikes and go/no-go for R1

Status: draft for the owner (R0-08, 2026-11-28). The gate is open until the owner decides; nothing here is a decision yet.

## 1. Summary

| Spike | Status | Result in one line |
|---|---|---|
| R0-05 Skeleton (AdonisJS 7 + Inertia React) | review (built, tests pass) | Three hosts, three guards and cookies, CSRF, throttles, security headers, `/kalender` with a deferred prop; 17 Japa tests |
| R0-06 AI job with SSE progress | **pending owner review** | BullMQ `worker-ai` role, key rotation gateway on a fake provider, Transmit over Redis; progress reaches the page in a median 6 ms; no step lost on SIGTERM or SIGKILL. Team decision D-451 records the runtime |
| R0-07 Typst PDF | accepted (D-450) | Typst CLI on `worker-exports`, WASM previews, Gotenberg fallback; server renders 50–120 ms |
| R0-08 Light load (k6) | done, this report | Pages, sign-in, AI job start and 200 held SSE streams all pass their thresholds on one web process; one finding on `worker-ai` concurrency (§3.4) |

Recommendation: **go for R1**, once the owner has reviewed R0-06 and settled the decisions at the end of this report. Nothing measured blocks the stack choice.

### R0-05 — skeleton

AdonisJS 7.7 at the repository root, TypeScript strict, Inertia 3 + React 19 with the React Compiler, Tailwind 4 and shadcn/ui. `app.`, `admin.` and `ujian.` each have their own guard and session cookie; logins are throttled per IP and per account; Shield CSP with nonce, HSTS and CSRF through the XSRF cookie; `/healthz` on every host. `/kalender` shows the school calendar (month grid at once, entries as a deferred prop with skeleton rows) and works at 360 px. Open points stay as listed in the task: spike subsets of the exam tables, row-level security not set up yet, no school switcher, dark-mode status colours, staff TOTP.

### R0-06 — AI job and SSE (pending owner review)

`node ace queue:work ai` is the `worker-ai` role; one job runs one step and queues the next. The gateway rotates teachers' keys with cooldowns, failover and a daily counter; the fake provider covers 429, timeouts and empty replies (48 Japa tests). Progress goes over Transmit with a Redis transport. Measured in the spike: median 6 ms, p95 12 ms from state change to the page; a SIGTERM mid-step finishes the step and loses nothing; a SIGKILL resumes after the 15 s lock (18.5 s end to end). D-451 records the runtime as a team decision; the owner's review of the task is still open.

### R0-07 — Typst (accepted)

Typst passed the D-399 tests; the owner accepted it with three conditions (pinned fonts, LaTeX converted with tex2typst plus fixes, WASM only on preview pages), D-450.

## 2. R0-08 setup

- **Where:** Claude cloud container, 4 vCPU, 15 GB RAM. The app, PostgreSQL 19, Redis and the load generator (k6 2.4) shared the same four cores; no nginx, no Cloudflare, no network in between.
- **App:** production build (`node ace build`, `NODE_ENV=production`), Node 26.13, one `web` process and one `worker-ai` process (three in run F), `AI_PROVIDER=fake` (1.2 s per AI call, no key, no network), Transmit over Redis, sessions and limiter in Redis, `UV_THREADPOOL_SIZE=4` unless noted.
- **Data:** demo seed plus 300 load teachers at the invented demo school (`spikes/k6/seed-load-users.sql`).
- **Probes:** `spikes/k6/loop-lag.mjs` preloaded into each Node process (event-loop delay, CPU, memory every 5 s, no app change); `pidstat` and `vmstat` for PostgreSQL, Redis and k6; `spikes/k6/sse-latency.mjs` for SSE delivery.
- **Scripts:** `spikes/k6/` (README there: how to run, variables, thresholds and why).

| Run | Load | Length |
|---|---|---|
| A | `pages.js`: ramp to 50 teachers browsing `/kalender` (2–5 s think time) + 2 fresh sign-ins per second | 4 min 20 s |
| C (mixed) | A + `sse.js` 200 held SSE streams + `ai-jobs.js` 10 teachers starting generations + `sse-latency.mjs` 10 teachers starting a generation every 10 s; 1 `worker-ai` | 5 min 30 s |
| D (capacity) | `pages.js` with 50 teachers and **no** think time + 1 sign-in per second | 3 min 20 s |
| E | 30 sign-ins per second, `UV_THREADPOOL_SIZE` 4 and 1 | 1 min each |
| F | `ai-jobs.js` + `sse-latency.mjs` with **3** `worker-ai` processes | 4 min |

## 3. Results

### 3.1 Pages and sign-in (runs A, C, D)

Server time as k6 measured it, milliseconds.

| Request | Threshold p95 | A p50 / p95 / p99 | C (mixed) p50 / p95 / p99 | D (saturated) p50 / p95 / p99 |
|---|---|---|---|---|
| `GET /kalender` (HTML shell) | < 300 | 5.1 / 8.3 / 11.8 | 5.1 / 8.8 / 13.9 | 109 / 143 / 159 |
| `GET /kalender` entries (deferred reload) | < 300 | 6.2 / 10.6 / 16.8 | 6.4 / 11.4 / 16.6 | 135 / 174 / 193 |
| `GET /masuk` | < 200 | 2.3 / 4.8 / 8.8 | 2.4 / 5.2 / 9.3 | 30 / 45 / 61 |
| `POST /masuk` (scrypt) | < 800 | 48.5 / 64.5 / 74.8 | 49.5 / 69.6 / 81.7 | 127 / 153 / 168 |
| Requests per second (pages script) | | 31 | 31 | **354** (run average incl. ramp) |
| Error rate / failed checks | < 1 % | 0 % / 0 of 15,622 | 0 % / 0 | 0 % / 0 of 148,174 |

Run D is the capacity of **one web process**: it reached 100 % of one core at about 350 req/s (about 175 page views per second, shell plus deferred reload), still with p99 under 200 ms and no errors. Per request that is about 2.8 ms of CPU. The container still had about half its CPU idle: one Node process is the limit, not the machine.

### 3.2 Sign-in and the thread pool (run E)

| 30 sign-ins per second | `POST /masuk` p50 / p95 / p99 | Sign-ins not started in time (k6 dropped) | Web CPU |
|---|---|---|---|
| `UV_THREADPOOL_SIZE=4` | 50 / 69 / 98 ms | 1 of 1,800 | 157 % of one core (avg), 175 % max |
| `UV_THREADPOOL_SIZE=1` | 727 / 1,380 / 1,520 ms | 288 of 1,800 | 118 % |

scrypt costs about 45 ms of CPU per sign-in and runs on the libuv thread pool, so it never blocks the event loop (lag p99 stayed under 10 ms) but it is the heaviest single operation in the skeleton. With one pool thread one web process manages about 20 sign-ins per second; with four it handled 30 per second with room left.

### 3.3 SSE (runs C and F)

| Measure | Result |
|---|---|
| Streams opened and subscribed (`sse.js`) | 200 of 200, all held 235–294 s to the end of the run, none dropped |
| `POST /__transmit/subscribe` p50 / p95 / p99 | 3.3 / 5.5 / 10.4 ms |
| Delivery latency, state change to message received, run C (973 messages, under the mixed load) | min 1, p50 3, p95 7, p99 10, max 22 ms; 0 over 1 s |
| Same, run F (1,260 messages) | min 1, p50 3, p95 6, p99 8, max 21 ms; 0 over 1 s |
| Web RSS with 200 streams + mixed load (C) vs pages only (A) | 307 MB vs 274 MB (about 0.15 MB per stream, rough) |

### 3.4 AI jobs on the fake provider (runs C and F)

| Measure | C: 1 `worker-ai` (concurrency 4) | F: 3 `worker-ai` (12 slots) |
|---|---|---|
| Offered load | about 1.5 generations/s (ai-jobs + probe) | about 2 generations/s |
| Generations finished | 110 (ai-jobs) + 139 of 180 seen by the probe within the run | 240 (ai-jobs) + 180 of 180 |
| Generation time p50 / p95 (3 steps, 3.6 s of AI time) | 18.0 / 22.6 s — **threshold < 15 s failed** | 3.65 / 3.85 s |
| Time outside AI calls (queue wait + runner) p50 / p95 | 14.4 / 19.0 s | 0.05 / 0.24 s |
| `POST /coba-ai` p95 | 17 ms | 16 ms |
| `worker-ai` CPU | 3 % avg, 5 % max of one core | 3 % each |

Finding: one `worker-ai` process with concurrency 4 (`config/queue.ts`) finishes at most 4 / 1.2 s ≈ 3.3 steps per second, so once more than about 1.1 generations per second arrive, steps wait in the queue. The worker is idle while it waits for the AI (3–5 % CPU); the limit is the concurrency setting, not the machine. More slots (here three processes) removed the wait completely. Real Gemini calls take seconds to tens of seconds, so the slots needed are roughly *starts per second × steps × seconds per call* (Little's law): 1 start/s × 3 steps × 20 s needs about 60 slots.

### 3.5 Processes: CPU, memory, event loop

Event-loop delay from `monitorEventLoopDelay` (10 ms resolution subtracted), per 5-second window; the first window (boot) left out.

| Process (run) | CPU avg / max (% of one core) | RSS max | Loop delay p50 (median window) | Loop delay p99 (median / worst window) | Worst single delay |
|---|---|---|---|---|---|
| web (A, light) | 20 / 27 | 274 MB | 0.1 ms | 1.3 / 3.6 ms | 38 ms |
| web (C, mixed) | 27 / 48 | 307 MB | 0.1 ms | 1.5 / 5.7 ms | 70 ms |
| web (D, saturated) | 99 / 114 | 363 MB | 2.1 ms | 9.7 / 14.4 ms | 40 ms |
| web (E, 30 sign-ins/s) | 157 / 175 | 331 MB | 0.1 ms | 1.9 / 8.2 ms | 33 ms |
| worker-ai (C) | 3 / 5 | 191 MB | 0.1 ms | 1.1 / 2.2 ms | 25 ms |
| PostgreSQL, all backends (A / C / D) | 3 / 6 / 36 | 160–316 MB | | | |
| Redis (A / C / D) | 1 / 1 / 3 | 10 MB | | | |
| k6 (A / C / D) | 6 / 8 / 39 | up to 267 MB | | | |

Boot itself blocks the loop for about 650 ms once (module loading), before the server accepts requests; that matters only for rolling restarts and the readiness check.

## 4. Caveats

- The container is not the production VPS (12 vCPU / 32 GB, D-413) and ran load generator, database, Redis and app on the same four cores. Numbers are a floor for per-process cost, not a forecast of the whole system.
- No nginx, Cloudflare or tunnel: production adds about 30–80 ms of network inside Indonesia plus nginx; SSE through Cloudflare must keep the 30 s Transmit ping under Cloudflare's idle timeout (100 s), and nginx needs buffering off for `/__transmit/events` (D-414, built in R3).
- The skeleton pages are small: `/kalender` reads a few dozen rows. Real R1 pages (content lists, RPM, Bank Soal) will cost more per request; re-measure in R1 with real pages.
- No PgBouncer, no row-level security yet (D-398, D-429): `SET LOCAL` per transaction adds a round trip per transaction. The Lucid pool is the default (max 10 per process); with 4–6 Node replicas that is fine, but the pool size must be set with PgBouncer in R1/R3.
- The AI provider is the fake one with a fixed 1.2 s. Real Gemini latency, 429 behaviour and output sizes are not measured (no real keys in the container, by design).
- All load users share one school; tenancy filters are tested in Japa, not under load.
- Single run per scenario, a few minutes each; no soak test (memory growth over hours is unknown). Heap stayed between 40 and 130 MB in every run.

## 5. Scale estimate (proposal, not measured on the VPS)

One web process handled about 350 req/s at one full core, which is about 175 page views per second. A teacher who opens a page every 30 s on average makes 0.033 views per second, so at 50 % CPU (headroom for spikes and heavier R1 pages) one web replica serves roughly 2,500 teachers active at the same moment, and the four replicas of D-415 roughly 10,000. Assume real R1 pages cost three to five times more than `/kalender`: that leaves about 2,000–3,000 simultaneously active teachers on four replicas, still well above an early SD/MI launch. Morning sign-in peaks are cheap by comparison: 5,000 teachers signing in within 10 minutes is about 8 sign-ins per second, under a third of what one web process handled.

## 6. Numbers for RS-19 (sizing; proposals only)

| Item | Measured | Proposal |
|---|---|---|
| Event-loop lag under load | p99 ≈ 1.5 ms at normal load, ≈ 10 ms per window at 100 % CPU, worst single 70 ms | Alert when web p99 loop delay > 50 ms for 1 min; use it as a scale-out signal next to CPU |
| CPU-heavy hotspots | scrypt on sign-in (≈ 45 ms CPU, thread pool); per-request page render ≈ 2.8 ms; nothing else above a few ms | Keep scrypt (security); watch sign-in rate. The shared `messages` prop filters every translation key on every request (`messagesFor`): cheap now, cache per namespace set once the language files grow |
| `UV_THREADPOOL_SIZE` | 1 thread: about 20 sign-ins/s per process; 4 threads: 30/s with room | `web` 4, `exam` 2 (exam card passwords are encrypted, not hashed, so the exam sign-in does not use scrypt), `worker-ai` 4 (default), `worker-exports` 4 (Typst is a child process, not the pool), `worker-default` 4, `scheduler` 2. Never more than the cores a container may use |
| `--max-old-space-size` | web heap ≤ 133 MB, RSS ≤ 363 MB; worker heap ≤ 68 MB, RSS ≤ 193 MB | web 512 MB, worker-ai 384 MB, others 384 MB as a start; container memory limit about 1.5 × that |
| Replicas per role | one web process ≈ 1 core at ≈ 350 req/s; worker-ai 3–5 % CPU at 12 slots | `web` 4 (2 would carry launch traffic; 4 gives rolling restarts and headroom, D-415), `exam` 1, `worker-ai` 1 process with a **higher concurrency** (start at 50, sized by Little's law once real Gemini latencies are known) or 2 processes for restarts, `worker-exports` 2, `worker-default` 1, `scheduler` exactly 1 |
| `worker-ai` concurrency | 4 slots → queue wait p95 19 s at 1.5 starts/s with a 1.2 s fake call | Make it a setting (env or config per environment) in R1; the current hard-coded 4 is the first bottleneck |
| SSE | 200 streams: no drops, delivery p99 ≤ 10 ms, ≈ 0.15 MB per stream | No limit needed at this scale; check nginx `worker_connections` and Cloudflare's limits in R3; one stream per tab is already the design |
| PostgreSQL | 36 % of one core at the web process's saturation | Fits the ≈ 4 cores of D-415 for many web replicas; re-check with RLS and PgBouncer |

Applied in R1-10 (`docs/agent/tasks/R1-10-runtime-settings.md`): `QUEUE_AI_CONCURRENCY` (default 50) and the other queue settings, `QUEUE_WAIT_ALERT_MS` with `GET /healthz/queues`, the CPU pool, and the `UV_THREADPOOL_SIZE` values above as comments in `.env.example` (set per role in the R3 compose file).

## 7. Go/no-go checklist for R1

| # | Item | Status |
|---|---|---|
| 1 | Stack proven at the root: AdonisJS 7, Inertia React 19, Tailwind 4, shadcn/ui, Lucid on PostgreSQL 19, Redis (R0-05) | Pass (task in review) |
| 2 | Three areas on three hosts with separate guards and cookies, CSRF, throttles, security headers (R0-05) | Pass (Japa) |
| 3 | AI job on `worker-ai`, key rotation, progress over SSE within 1 s, restart-safe (R0-06) | Pass in the spike; **owner review pending** |
| 4 | PDF engine (R0-07) | Pass, accepted (D-450) |
| 5 | Pages under light load: `/kalender` p95 < 300 ms, errors < 1 % (R0-08) | Pass (p95 9–11 ms; 0 errors) |
| 6 | Sign-in under load: p95 < 800 ms at 2/s and at 30/s (R0-08) | Pass (p95 65–70 ms) |
| 7 | 200 SSE streams held, none dropped; delivery p99 < 1 s (R0-08) | Pass (p99 10 ms) |
| 8 | AI generation time p95 < 15 s at the offered load (R0-08) | **Fail with 1 worker at concurrency 4** (p95 22.6 s); pass with 12 slots (3.85 s). Fix is a setting, not a stack change: owner decision 3 |
| 9 | Event-loop lag stays low under load (R0-08) | Pass (p99 ≤ 15 ms per window even at 100 % CPU) |
| 10 | CI runs on GitHub (lint, format, typecheck, tests, build) | Open: workflow written in R0-05, not yet seen green on GitHub |
| 11 | Row-level security and `SET LOCAL` tenant context with PgBouncer (D-398, D-429) | Not built; R1 design constraint, not a gate blocker |
| 12 | Measurements on production-like hardware (VPS, nginx, Cloudflare Tunnel) | Not done; R3, after the server exists |

## 8. Risks

- **AI queue sizing.** The first limit is `worker-ai` concurrency, and real Gemini calls are 10–100 times longer than the fake one. Without a configurable concurrency and a queue-wait metric, teachers will see "Langkah 1 dari 3" for a long time at busy hours while the server idles.
- **Heavier real pages.** The capacity number comes from a tiny page; R1 pages with large lists, JSONB and RLS can cost several times more. Measure again with the first real content page.
- **Sign-in bursts.** Teacher sign-in uses scrypt (about 45 ms of CPU each, measured). The exam site's card check decrypts instead of hashing, so a class signing in together on `ujian.` is cheap; staff and teacher sign-in peaks are the ones to watch.
- **Crash recovery time.** A hard worker crash resumes after the 15 s lock (R0-06); acceptable, but visible to the teacher.
- **Unmeasured infrastructure.** Cloudflare Tunnel, nginx SSE settings and PgBouncer are not in these numbers.

## Owner decisions needed for the gate

Answered 2026-11-28 (D-463, D-467): items 3, 4 and 5 accepted as written; RS-19 runs CPU-heavy work in a `worker_threads` pool (D-463). Still open: 1 (R0-06 review) and then 2 (R1 go), which waits for it.

1. **R0-06:** review the AI job spike (`docs/agent/tasks/R0-06-spike-ai-job-sse.md`, `/coba-ai`) and accept it or ask for changes; D-451 records the runtime as a team decision until then.
2. **R1 go:** approve starting R1 on this stack with the caveats in §4 (record as a decision).
3. **`worker-ai` concurrency:** approve making it a per-environment setting in R1, starting at 50 slots in one process (two processes for restarts), with a queue-wait metric and alert, instead of the fixed 4. This also settles the "concurrency about 20" of D-415.
4. **Sizing proposals for RS-19:** accept §6 (`UV_THREADPOOL_SIZE`, heap limits, replicas per role) as the starting values, or change them.
5. **Re-measure points:** agree that load is measured again (a) with the first real R1 content page and RLS, and (b) on the VPS behind nginx and the tunnel in R3, with these thresholds as the pass line.

## R1 re-measure (R1-11, 2026-11-28)

The first re-measure of D-467: the R1 pages (calendar on the layer model, extracurricular list, timetable) behind row-level security with `SET LOCAL` per transaction, on the same machine type and with the same load shapes as R0-08. Task: `docs/agent/tasks/R1-11-load-remeasure.md`. Scripts and how to run them: `spikes/k6/README.md`.

### Setup and what ran under RLS

- **Where:** Claude cloud container, 4 vCPU, 15 GB, as in R0-08; app, PostgreSQL, Redis and k6 on the same cores. Production build (`node ace build`), Node 26.13, one `web` process, one `worker-ai` in run C at `QUEUE_AI_CONCURRENCY=50` (the R1-10 default from D-467), `UV_THREADPOOL_SIZE=4`, `AI_PROVIDER=fake`.
- **PostgreSQL:** 19.0 in a private cluster on its own port with the shared cluster's settings (128 MB shared buffers, `jit = off`) plus `pg_stat_statements`. The shared cluster does not preload it, and restarting it would have disturbed other sessions. Statistics were reset before each run.
- **Data** (`spikes/k6/seed_r1_load.ts`): 300 schools from the NPSN directory (Kudus, Jepara, Pati). 20 load schools (16 SD, 4 MI, spread over the three regencies), each with year 2026/2027 on the Jawa Tengah frame, 12 classes, 15 teachers (12 homeroom, 3 subject teachers), one operator, three school calendar events, a kept-open joint-leave day, and an own and a hidden extracurricular. In all: 1,776 teaching assignments and 7,278 timetable rows, saved through the real draft generator and save path. The national and Jawa Tengah calendar packages and the extracurricular catalog are active; the SD and MI curricula are imported. 320 load users.
- **Under RLS:** the `tenant` connection, login `sigrak_app_user` (member of `sigrak_app`, `NOBYPASSRLS`, not the owner); every transaction starts with `set_config('app.school_id' | 'app.user_id', …, true)`. This covers the active-membership lookup of the `school` middleware on every app request; `/kalender` (shell and deferred props: years, classes, the layer resolver's reads of packages, items, hides, stamps and choices, calendar snapshots); `/ekstrakurikuler`; and `/jadwal`, `/kelas/:class/jadwal`, `/kelas-saya/jadwal` (years, classes, timetable rows, teaching assignments).
- **Still on the owner connection** (as R1-01 and D-470 allow until R3): the user lookup at sign-in and on each request (`users`, no RLS), the school's level and province for the policy profile (`schools`, `regions`), curriculum reads (`subjects`, `subject_allocations`, `topics`), teacher names, and the whole AI demo (`generations` and its children: RLS tables, bypassed because the owner owns them). `app_region_chain()` runs as its owner by design. A smoke run with the default connection also on the app login: every R1 page and sign-in work, but starting an AI generation fails on the `generations` RLS policy. The generation service must move onto tenant transactions before production switches to the app login in R3.

| Run | Load (shapes as R0-08) | Length |
|---|---|---|
| A0 | R0-08 run A unchanged: 50 teachers on `/kalender` (2–5 s think time) + 2 sign-ins/s; R1 data, RLS, all five deferred props | 4 min 20 s |
| A | R1 mix: 50 teachers taking `/kalender`, `/ekstrakurikuler`, `/kelas-saya/jadwal` in turn + 10 operators taking `/jadwal`, `/kelas/:class/jadwal`, `/kalender?kelas=` in turn (2–5 s) + 2 sign-ins/s | 4 min 20 s |
| C (mixed) | A + 200 held SSE streams + 10 teachers starting AI generations + the SSE latency probe; 1 `worker-ai` | about 5 min |
| D0 / D1 (capacity) | A0 / A with **no** think time + 1 sign-in/s | 3 min 20 s |
| E | 30 sign-ins/s, each followed by `/kalender` | 1 min |

### Comparison with R0-08

Server time as k6 measured it, in ms, p50 / p95 / p99. Thresholds: p95 / p99 < 300 / 800 ms for pages, `GET /masuk` p95 < 200, `POST /masuk` p95 < 800.

| Request | R0-08 A | R1 A0 | R1 A | R0-08 C | R1 C | R0-08 D | R1 D0 | R1 D1 |
|---|---|---|---|---|---|---|---|---|
| `GET /kalender` (shell) | 5.1 / 8.3 / 11.8 | 6.9 / 11.6 / 17.6 | 6.4 / 17.5 / 29.9 | 5.1 / 8.8 / 13.9 | 6.3 / 17.1 / 28.4 | 109 / 143 / 159 | 147 / 187 / 203 | 380 / 527 / 598 |
| `GET /kalender` deferred reload¹ | 6.2 / 10.6 / 16.8 | 10.1 / 17.8 / 23.8 | 9.7 / 24.7 / 38.6 | 6.4 / 11.4 / 16.6 | 9.8 / 24.3 / 36.1 | 135 / 174 / 193 | 222 / 275 / 296 | 535 / 748 / 837 |
| `GET /kalender?kelas=` shell · deferred | | | 6.7 / 17.4 / 24.7 · 10.0 / 26.9 / 36.7 | | 6.8 / 17.5 / 22.2 · 10.2 / 26.9 / 40.0 | | | 374 / 526 / 588 · 557 / 749 / 887 |
| `GET /ekstrakurikuler` | | | 6.1 / 17.5 / 26.1 | | 6.1 / 17.4 / 25.5 | | | 343 / 518 / 571 |
| `GET /jadwal` (operator) | | | 33.6 / 60.4 / 95.6 | | 34.3 / 59.1 / 83.6 | | | 464 / 618 / 702 |
| `GET /kelas/:class/jadwal` (operator) | | | 30.1 / 54.2 / 81.2 | | 30.3 / 51.8 / 63.0 | | | 467 / 622 / 709 |
| `GET /kelas-saya/jadwal` (teacher) | | | 28.3 / 50.9 / 70.7 | | 28.3 / 49.2 / 65.7 | | | 475 / 628 / 718 |
| `GET /masuk` | 2.3 / 4.8 / 8.8 | 2.3 / 4.2 / 7.6 | 2.2 / 6.7 / 10.9 | 2.4 / 5.2 / 9.3 | 2.1 / 8.5 / 14.3 | 30 / 45 / 61 | 17 / 26 / 35 | 28 / 49 / 64 |
| `POST /masuk` (scrypt) | 48.5 / 64.5 / 74.8 | 35.2 / 47.2 / 56.4 | 35.1 / 49.0 / 60.3 | 49.5 / 69.6 / 81.7 | 35.2 / 50.7 / 58.2 | 127 / 153 / 168 | 68 / 96 / 107 | 90 / 121 / 131 |
| Requests per second | 31 | 31 | 26 | 31 | 26 | **354** | **249** | **123** |
| Errors / failed checks | 0 % / 0 | 0 % / 0 of 19,147 | 0 % / 0 of 15,897 | 0 % / 0 | 0 % / 0 of 15,831 | 0 % / 0 | 0 % / 0 of 123,662 | 0 % / 0 of 60,018 |
| Tenant checks (own school only) | | 3,617 of 3,617 | 2,801 of 2,801 | | 2,789 of 2,789 | | 24,650 of 24,650 | 11,190 of 11,190 |

¹ R0-08 asked for `entries` only; R1 asks for every deferred prop of the page in one reload (`entries`, `hidden`, `frame`, `effective`, `changes`), as the browser does for one defer group.

| Other measures | R0-08 | R1-11 |
|---|---|---|
| Sign-ins at 30/s (E): `POST /masuk` p50 / p95 / p99; sign-ins not started in time | 50 / 69 / 98 ms; 1 of 1,800 | 36 / 49 / 85 ms; 0 of 1,800; web CPU 143 % avg, 155 % max |
| SSE (C): streams subscribed and held | 200 of 200 | 200 of 200 |
| `POST /__transmit/subscribe` p50 / p95 / p99 | 3.3 / 5.5 / 10.4 ms | 2.8 / 4.9 / 9.4 ms |
| SSE delivery, state change to message (C) | p50 3, p95 7, p99 10, max 22 ms (973 messages) | p50 2, p95 6, p99 12, max 22 ms (1,260 messages, 180 of 180 generations); 0 over 1 s |
| AI generation time p50 / p95 (C) | 18.0 / 22.6 s at concurrency 4 (failed) | 3.6 / 3.7 s at concurrency 50 (236 generations); queue and runner overhead p95 0.1 s; `POST /coba-ai` p95 24.6 ms |
| Web CPU, % of one core avg / max (A · C · D) | 20 / 27 · 27 / 48 · 99 / 114 | 28 / 42 · 27 / 62 · 105 / 112 (D0), 111 / 117 (D1) |
| Web CPU per request at saturation | 2.8 ms (`/kalender` mix) | 4.2 ms (D0, `/kalender` mix); 9.0 ms (D1, R1 mix) |
| Web RSS max (A · C · D) / heap max | 274 · 307 · 363 MB / ≤ 133 MB | 328 · 400 · 520 MB / 105 · 126 · 259 MB |
| Event-loop delay p99 (median / worst window); worst single delay | A 1.3 / 3.6, C 1.5 / 5.7, D 9.7 / 14.4 ms; 70 ms | A 5.7 / 7.2, C 5.7 / 9.6, D0 5.6 / 10.6, D1 15.3 / 26.1 ms; 52 ms |
| `worker-ai` (C) | 3 / 5 % CPU, RSS 191 MB | 3 / 7 % CPU, RSS 205 MB |
| PostgreSQL CPU avg (A · C · D) | 3 · 6 · 36 % | 7 · 8 · 46 % (D0), 38 % (D1) |
| Redis CPU | 1 · 1 · 3 % | 0–2 % |

PostgreSQL CPU and RSS come from `spikes/k6/proc-sample.mjs` over the private cluster's process tree (RSS is summed per backend, so shared buffers count more than once: 360–780 MB). There were no shared-buffer reads from disk in any run (everything cached), no rollbacks, no deadlocks and no temp files.

### `SET LOCAL` per transaction, no leakage

- In every run `pg_stat_statements` counts, for `sigrak_app_user`, exactly as many `BEGIN` as `COMMIT` as `SELECT set_config($3, $1, $4), set_config($5, $2, $6)` (A0 18,085; A 13,766; C 15,038; D0 123,260; D1 54,543; E 9,000), no `ROLLBACK`, and no session-level `SET`. Every tenant transaction set its school first and nothing set it outside a transaction, so a pooled connection (PgBouncer in transaction mode, D-429) never carries a tenant into the next transaction.
- Under load, 46,847 page checks across the 20 schools compared the school name on `/kalender` and the school's own extracurricular (a unique name per school) with the signed-in user's school: no page showed another school's data. R1-01's test still covers one backend reused across tenants and after a rollback.
- The `set_config` statement costs 0.006 ms of database time per transaction. The cost of RLS is in the extra round trips per request (regression 1), not in the policies.

### Regressions and causes

1. **`/kalender` costs about 1.5 times the skeleton's.** Light-load p95 rose from 8–11 ms to 12–25 ms, and one web process now saturates at 249 instead of 354 req/s (CPU per request 2.8 → 4.2 ms). Causes: the deferred reload carries five props instead of one, and effective days are computed on every reload (`effectiveDays`, `addDays` show in the CPU profile); the layer resolver reads its stamps and the calendar snapshot is read for the change notice on each reload; and every app request runs the membership lookup in its own tenant transaction (`BEGIN`, `set_config`, `SELECT`, `COMMIT`) before the page's own transaction, so one `/kalender` view (shell and reload) makes four transactions. PostgreSQL CPU per request rose from about 1.0 to 1.9 ms.
2. **The timetable pages are the heaviest R1 pages:** 28–34 ms median at light load, about five times `/kalender`, and the reason the R1 mix saturates one web process at 123 req/s (9 ms CPU per request). They are CPU-bound in Node, not in PostgreSQL: `loadYearState` hydrates every row of the year (≈ 360 timetable rows, ≈ 90 assignments) into Lucid models, the rules run per class, and `SubjectsForGrade` makes two uncached curriculum queries per grade (12 per request). Before the fix below, `/jadwal` converted every row of the year once per class (p50 / p95 / p99 40.0 / 64.9 / 86.6 ms before, 33.6 / 60.4 / 95.6 ms after).
3. **Memory:** web heap peaked at 259 MB under saturation (R0-08: 133 MB), RSS at 520 MB. Still inside the proposed 512 MB heap limit (§6); watch it in the R3 soak test.
4. **Event loop:** the timetable pages run synchronous chunks of 20–30 ms, so the p99 per window rose from ≈ 1.5 to ≈ 6 ms at light load and to 15–26 ms at saturation. The worst single delay (52 ms) is at the proposed 50 ms alert line.
5. Not regressions: sign-in is faster than in R0-08 (`POST /masuk` p50 35 vs 49 ms; machine variance, since the lookup fix below matters only with many users), and the AI queue wait is gone because R1-10 made the concurrency a setting (D-467).

### Fixed in R1-11 (with tests)

| Fix | Effect |
|---|---|
| `adonisrc.ts` `metaFiles` copies `docs/data/{profiles,curriculum,regulations,regions,calendar,catalogs,schools}` into the build | The production build answered **500** on `/jadwal`, `/ekstrakurikuler` and every page that resolves the Profil Jenjang, because `docs/data/profiles` was missing. Test: every `docs/data` folder the app reads is in `metaFiles` |
| Sign-in looks accounts up by `lower(email)` (`User`, `StaffUser`) | The auth mixin's `where email = ?` cannot use the unique `lower(email)` index and read the whole table on every sign-in: 8 ms at 100,000 users, 0.04 ms with the index. Tests: index plan, capitals |
| `/jadwal` converts the year's rows once instead of once per class | `classWarnings` share of web CPU 11.9 % → 5.3 % in the saturated operator profile; `/jadwal` p50 −16 % at light load. Test: a clash still counts in both classes |
| `messagesFor` keeps the picked messages per namespace set | It took 2.3 % of web CPU, on every request (the R0-08 §6 note). Test: shared, frozen, same content |
| Index `topics (curriculum_version_id, grade)` | The busiest statement under load (D1: 39,126 calls, 5.5 s of 16.5 s database time) read the whole table each time. Buffers per call 144 → ≈ 50 today, and the table grows with every curriculum version. Test: the plan uses the index |

### Slow and frequent queries (D1)

| Statement | Calls | Mean | Note and suggestion |
|---|---|---|---|
| `topics` count per version and grade (owner) | 39,126 | 0.14 ms | Index added (above). Also cache `SubjectsForGrade` per process like the policy profile (10 min, D-470): the data changes only with a curriculum import |
| `subject_allocations` join `subjects` (owner) | 39,126 | 0.08 ms | Same cache; 43 rows each, 12 calls per timetable page |
| `timetable_slots` of a year (`school_id`, `class_id IN …`) | 6,871 | 0.45 ms | Uses `(school_id, class_id, weekday)`; the cost is row volume (≈ 360 rows), not a missing index. Reading only the columns the rules need would save hydration time in Node |
| `classes` of a year | 19,149 | 0.04 ms | Index `(school_id, academic_year_id, grade)` exists; the seq scans in the statistics are the planner's choice on a 240-row table |
| `academic_years` of a school | 30,515 | 0.02 ms | Read two or three times per request (`chooseYear` and the year list); once per request would do |
| `school_memberships` active membership | 24,202 | 0.02 ms | On every app request, and with its own transaction it is four round trips. Fold it into the page's transaction, or keep it in the session and recheck it every few minutes |
| `calendar_snapshots` of user and year | 6,139 | 0.07 ms | Unique index used |

No other index is missing at this data size. The sequential scans in `pg_stat_user_tables` (`classes`, `academic_years`, `regions`, `layer_stamps`) are all on tables under 400 rows, where an index scan would cost more. Check again with PgHero on the VPS (D-429).

### Larger items, not fixed here

1. Move the generation service (`generations`, `generation_steps`, `ai_usage_logs`, `ai_credentials`) onto tenant transactions before production runs on the app login (R3); today it only works on the owner connection.
2. Timetable read path: one year state per request with plain rows instead of Lucid models, the rule checks once per year instead of once per class, and a cache for `SubjectsForGrade`. Expected to halve the timetable pages' CPU and bring the event-loop delay down.
3. One tenant transaction per request: the membership lookup, the page's reads and the deferred props each open their own, and with PgBouncer each adds round trips.
4. Effective days per class are recomputed on every deferred reload; cache them by the resolver's stamp and the class's lesson days.

### Pass / fail against the D-467 thresholds

| # | Threshold (R0-08) | R1-11 | Result |
|---|---|---|---|
| 1 | Pages p95 < 300 ms, p99 < 800 ms at light load (A, C) | Highest p95 60.4 ms (`/jadwal`), highest p99 95.6 ms | **Pass** |
| 2 | `GET /masuk` p95 < 200 ms | 4.2–8.5 ms | **Pass** |
| 3 | `POST /masuk` p95 < 800 ms, p99 < 1.5 s at 2/s and 30/s | p95 47–51 ms, p99 ≤ 85 ms | **Pass** |
| 4 | Errors < 1 %, checks > 99 % | 0 errors, 0 failed checks in every run | **Pass** |
| 5 | 200 SSE streams held, subscribe p95 < 300 ms, delivery p99 < 1 s | 200 of 200, 4.9 ms, 12 ms | **Pass** |
| 6 | AI generation p95 < 15 s at the offered load | 3.7 s (concurrency 50) | **Pass** (failed in R0-08 at concurrency 4) |
| 7 | Event-loop lag stays low; alert line 50 ms | p99 per window ≤ 26 ms even at saturation; worst single 52 ms | **Pass**, with the margin in regression 4 |
| 8 | Tenant isolation under load (new) | 46,847 of 46,847 own-school checks; `SET LOCAL` in every transaction | **Pass** |
| — | Saturation runs (D0, D1) | Capacity measures, not pass lines; D1 p95 is 518–749 ms because one process is at 100 % CPU | 249 req/s (`/kalender` mix) and 123 req/s (R1 mix) per web process |

**Scale estimate, revised (§5).** In the saturated R1 mix one web process served about 90 page views per second on one core (≈ 12 ms of CPU per view, about twice the skeleton's 5.7 ms). At 50 % CPU and one view per teacher every 30 s, that is about 1,350 simultaneously active teachers per web replica and about 5,400 on the four replicas of D-415. That is above the R0-08 estimate of 2,000–3,000 (which assumed pages three to five times `/kalender`) and well above an early SD/MI launch. The second re-measure of D-467 (VPS, nginx, tunnel, PgBouncer) stays in R3.
