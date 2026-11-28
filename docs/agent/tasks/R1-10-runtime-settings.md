# R1-10 — Runtime settings from R0-08: AI concurrency, queue-wait alert, worker_threads pool

- **Phase:** R1
- **Status:** in-progress
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

- [ ] Tests, lint and typecheck pass (test database `sigrak_test_r110`, Redis DBs 5 and 6)
- [ ] Result filled

## Result
