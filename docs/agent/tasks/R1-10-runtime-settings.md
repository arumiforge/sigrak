# R1-10 — Runtime settings from R0-08: AI concurrency, queue-wait alert, worker_threads pool

- **Phase:** R1
- **Status:** done
- **Owner:** r1/r1-10-runtime-settings
- **Depends on:** R0 gate (D-468)
- **Can run in parallel with:** R1-01, R1-02, R1-03

## Goal

Apply D-463 and D-467 in code: `worker-ai` concurrency is a per-environment setting, slow queues raise an alert signal, and CPU-heavy export work runs in a `worker_threads` pool so the event loop stays free.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- `docs/drafts/r0-gate.md` (§6 sizing), `docs/agent/tasks/R0-06-spike-ai-job-sse.md`
- Decisions D-415, D-451, D-463, D-467
- `config/queue.ts`, `app/services/queue/`, `start/env.ts`, `.env.example`, `deploy/` if present

## Output

- `QUEUE_AI_CONCURRENCY` (default 50), `QUEUE_EXPORTS_CONCURRENCY` and similar in `start/env.ts`, `.env.example`, `config/queue.ts`; validated ranges.
- Queue-wait metric: time from enqueue to start per queue, exposed on the health endpoint and logged when over a threshold setting (`QUEUE_WAIT_ALERT_MS`); the alert channel itself comes with R3 monitoring.
- `app/services/cpu_pool/`: a small `worker_threads` pool (Piscina or a minimal own pool; pick one and say why), size = container CPU limit − 1 (at least 1, read from cgroup when present), used by a sample CPU job on `worker-exports`; graceful shutdown within the D-451 grace period.
- Proposed `UV_THREADPOOL_SIZE` per role written into `.env.example` comments and `docs/drafts/r0-gate.md` §6 cross-reference (values from D-467).
- Tests: settings parse and clamp; the pool runs a CPU task off the main thread (event-loop lag stays low in a test); shutdown drains.

## Done when

- [x] Tests, lint and typecheck pass (test database `sigrak_test_r110`, Redis DBs 5 and 6)
- [x] Result filled

## Result

Branch `r1/r1-10-runtime-settings`, no new dependency.

- **Settings** (`app/services/queue/settings.ts`, `config/queue.ts`, `start/env.ts`, `.env.example`): `QUEUE_AI_CONCURRENCY` (1–500, default 50), `QUEUE_EXPORTS_CONCURRENCY` (1–32, default 2), `QUEUE_DEFAULT_CONCURRENCY` (1–100, default 4), `QUEUE_WAIT_ALERT_MS` (1 000–3 600 000, default 10 000), `CPU_POOL_SIZE` (1–64, unset = auto). A non-number fails boot (Env schema); a number outside its range is clamped, and the worker logs each clamp at start. Fractions round down.
- **Queue wait** (`app/services/queue/wait_metrics.ts`): each worker measures enqueue (or end of delay) → start, stores the last 500 starts per queue in Redis (queue database, `sigrak:metrics:queue-wait:<queue>`, own connection), and logs `alert: "queue_wait"` at warn level when a start waited longer than `QUEUE_WAIT_ALERT_MS`, at most one line per queue per 30 s with a count of the rest. `GET /healthz/queues` returns per queue: `status` (`ok`/`slow`), `waiting`, `active`, `delayed`, `oldestWaitMs` (live, so a dead worker still shows) and `recent` (starts, p50, p95, max over 5 minutes). `slow` when the oldest waiting job or the p95 is over the threshold. Answered only without a `CF-Connecting-IP` header, so requests through the tunnel get 404 and only monitors inside the server network see it; `/healthz` itself is unchanged.
- **CPU pool** (`app/services/cpu_pool/`): own minimal `worker_threads` pool (fixed size, FIFO queue, abort signal, crashed thread replaced, drain on close), not Piscina: the needed feature set is about 200 lines, and Piscina brings optional native packages we would have to vet under D-422. Size = container CPU limit − 1, at least 1; the limit is read from cgroup v2 `cpu.max` or v1 `cfs_quota_us`/`cfs_period_us`, rounded down, capped by `os.availableParallelism()`. Tasks live in `tasks.ts` (pure functions, no app services). In dev and tests the thread registers the `@poppinss/ts-exec` hook first; a build loads the compiled `thread.js` directly (checked by compiling the pool and running a task).
- **worker-exports**: the pool starts with the worker; sample job `cpu-sample` (`app/jobs/cpu_sample.ts`, registry `app/jobs/export_registry.ts`) hashes in the pool. On shutdown the pool gets the same 8 s grace as the worker (D-451); work still running then is cut off and its job goes back to the queue unchanged.
- **`UV_THREADPOOL_SIZE`**: the D-467 values (web 4, exam 2, worker-ai 4, worker-exports 4, worker-default 4, scheduler 2) are in `.env.example` comments, with the note that they belong in the container environment (libuv can read it before `.env` loads); cross-reference added to `docs/drafts/r0-gate.md` §6.
- **Tests** (73 passing, 25 new): `tests/unit/runtime_settings.spec.ts` (defaults, clamp and report, fractions, cgroup v1/v2 parsing, pool size, wait calculation, alert throttle), `tests/unit/cpu_pool.spec.ts` (result from another thread; event-loop max lag below 150 ms while a 600 ms task runs; queueing and parallel threads; task error; crash and replacement; abort; drain within grace; cut-off after grace), `tests/functional/queue_runtime.spec.ts` (exports worker runs `cpu-sample` in the pool; `/healthz/queues` numbers; a job waiting 60 s marks the queue slow; hidden behind Cloudflare; shutdown requeues cut-off CPU work).

Shared files touched: `app/middleware/healthz_middleware.ts` (the `/healthz/queues` branch), `docs/drafts/r0-gate.md` (one cross-reference line).

### Proposed decisions

- Own `worker_threads` pool instead of Piscina (reason above); revisit if we need per-task resource limits or idle shrinking.
- Queue-wait numbers on `GET /healthz/queues`, internal only (no `CF-Connecting-IP`); `/healthz` stays a bare up/down answer (Fondasi web-baseline §7). R3 points Uptime Kuma (keyword `"status":"ok"`) and the alert channel at it, and nginx may also block the path from the tunnel.
- Out-of-range queue settings are clamped with a logged warning rather than failing boot; non-numbers fail boot.
- Queue-wait alert default 10 s, logged at most once per queue per 30 s.

### Open questions

- Should exports have its own, larger wait threshold (exports may wait longer than AI steps)? Today one `QUEUE_WAIT_ALERT_MS` covers all queues.
- A job put back in the queue after an interrupted shutdown keeps its first enqueue time, so its next start counts the earlier wait too (rare; shows as one high sample).
- The two `worker-ai` processes of D-467 and `UV_THREADPOOL_SIZE` per role are set in the R3 compose file (`deploy/` does not exist yet).

### Follow-up D-469 (R1-13)

- **CPU pool on Piscina 5.3.2** (pinned exactly, published 2026-08-28): `app/services/cpu_pool/pool.ts` keeps the same API, errors, sizing (cgroup CPU − 1), abort, crash replacement and the grace drain (8 s from the worker). Piscina runs `thread.ts` (default export with a reply envelope, so task errors stay `CpuTaskError`); source runs pass `--import @poppinss/ts-exec` to each thread. Piscina has no install script. Its only optional dependency, `@napi-rs/nice` (prebuilt native binaries, used only for `niceIncrement`, which stays 0), is listed under `ignoredOptionalDependencies` in `pnpm-workspace.yaml`, so nothing native is installed and `allowBuilds` is unchanged. Existing pool tests pass unchanged; a compiled build was checked too.
- **Queue-wait threshold per queue:** `QUEUE_WAIT_ALERT_MS` (default 10 000) for `ai` and `default`, new `QUEUE_EXPORTS_WAIT_ALERT_MS` (default 60 000) for `exports`; `config/queue.ts` `waitAlertMs` is now `{ ai, exports, default }`. `/healthz/queues` gives `thresholdMs` per queue (as an object at the top level and in each queue report). Tests cover defaults, clamping, and an exports job waiting 30 s (ok) vs 90 s (slow).
