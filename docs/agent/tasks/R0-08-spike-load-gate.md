# R0-08 — Spike: light k6 run and gate report

- **Phase:** R0
- **Status:** review
- **Owner:** rs/rs-18-layers-r0-08-gate
- **Depends on:** R0-05, R0-06, R0-07
- **Can run in parallel with:** —

## Goal

Measure the skeleton under light load and bring the R0 results to the owner for the R1 gate.

## Output

- `spikes/k6/` scripts (login, `/kalender`, AI job start, SSE connections), results in `docs/drafts/r0-gate.md` with the go/no-go list for R1

## Done when

- [ ] Owner approves R1 (recorded as a decision)

## Result

Status stays in-progress until the owner approves the gate. Report: [`docs/drafts/r0-gate.md`](../../drafts/r0-gate.md); scripts and how to run them: [`spikes/k6/README.md`](../../../spikes/k6/README.md).

- **Scripts** (`spikes/k6/`): `pages.js` (sign-in with CSRF and the area session cookie, `/kalender` shell plus deferred `entries` reload, 50 VUs with think time, 2 fresh sign-ins per second), `ai-jobs.js` (generations on `/coba-ai` with the fake provider only), `sse.js` (200 Transmit streams held open and subscribed), `sse-latency.mjs` (Node probe for SSE delivery latency), `loop-lag.mjs` (event-loop, CPU and memory probe preloaded with `--import`, no app change), `seed-load-users.sql` (300 load teachers). k6 keeps cookies by hand because production cookies are `Secure`; each VU sends its own `X-Forwarded-For`, which the app trusts from loopback as it will trust nginx. Lint and Prettier cover `spikes/k6` and pass; nothing was excluded.
- **Measured** (2026-11-28, cloud container 4 vCPU, production build, Node 26.13, PostgreSQL 19, one web and one `worker-ai` process): `/kalender` p95 8–9 ms and its deferred reload p95 11 ms at 50 browsing teachers with 200 SSE streams and AI jobs running; sign-in p95 65–70 ms (scrypt ≈ 45 ms CPU, thread pool); 0 errors; one web process saturates one core at ≈ 350 req/s (p99 < 200 ms); 200 of 200 SSE streams held, delivery p50 3 ms, p99 10 ms; event-loop delay p99 ≈ 1.5 ms (≈ 10 ms at 100 % CPU).
- **Finding:** `worker-ai` concurrency 4 (`config/queue.ts`) caps the fake provider at ≈ 1.1 generations per second; above that, queue wait p95 reached 19 s (generation p95 22.6 s, threshold 15 s failed) while the worker used 3–5 % CPU. Three worker processes (12 slots) brought it to 3.85 s. Proposal in the report: make the concurrency a setting and size it by starts × steps × call time.
- **Pending:** owner review of R0-06; owner decisions listed at the end of the report (R1 go, `worker-ai` concurrency, RS-19 sizing proposals, re-measure points).
