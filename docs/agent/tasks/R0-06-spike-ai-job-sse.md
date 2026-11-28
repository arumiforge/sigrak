# R0-06 — Spike: BullMQ AI job with SSE progress

- **Phase:** R0
- **Status:** done (accepted, D-468)
- **Owner:** igi/dazzling-franklin-5i1w8n
- **Depends on:** R0-05
- **Can run in parallel with:** R0-07

## Goal

One AI generation job on the `worker-ai` role with live progress in the browser over Transmit (D-388), using the teacher-key rotation of `docs/final/ai-provider-engine.md`.

## Read first

- `docs/final/ai-provider-engine.md`, `docs/final/content-engine.md` (one job per content type), Fondasi `ai-assistant.md`

## Output

- BullMQ queue + worker process role, Transmit channel per user, a demo page that starts a job and shows steps, cancel, retry
- Japa tests with a fake provider (429, timeout, empty reply → failover)

## Done when

- [x] Progress reaches the page within 1 s of each step; a worker restart does not lose the job

## Result

Built at the root, in the R0-05 layout. Run it with `pnpm dev` plus `node ace queue:work ai` and open `/coba-ai` (README, Local setup step 5).

- **Queue and process role:** BullMQ 6.7 on Redis (`config/queue.ts`, own Redis database 1, D-053). `node ace queue:work ai|exports|default` (`commands/queue_work.ts`) is the `worker-ai` / `worker-exports` / `worker-default` role of D-388; the web process only adds jobs. Jobs have one attempt (retries live in the gateway). One job runs one step and re-dispatches itself; the job id `gen-<public_id>-r<run>-s<step>` keeps at most one job per step and run (D-050). `ai` worker: concurrency 4, lock 15 s, stalled check 5 s. On SIGTERM the worker stops taking jobs, lets running steps finish for 8 s (`shutdownGraceMs`), then aborts them and puts each job back in the queue (`moveToWait`).
- **AI layer** (`app/services/ai`): `AIProvider` contract, `GeminiProvider` (plain HTTP, key in `x-goog-api-key`, error classification of the engine doc; only with `AI_PROVIDER=gemini`), scripted `FakeProvider` (default, no key, no network), `KeySelector` (sticky pin per generation, round robin by Redis `INCR`, cooldowns per key and model in Redis, D-128 daily counter, circuit breaker, backup keys last per D-119), `AIGateway` (4 attempts / 5 min per step; 429 retried once on the same key when the delay is ≤ 20 s, else cooldown and failover; daily 429 cools down until midnight Pacific; 401/403/402/`FAILED_PRECONDITION` mark the key invalid; 404 next model; transient 2 retries with 1 s / 2 s backoff, timeout 1 retry, then failover; bad request, blocked, malformed output never fail over; one `ai_usage_logs` row per attempt). `empty_reply` (Fondasi ai-assistant.md) fails over.
- **Generations** (`app/services/generation`, `app/jobs`): plan per content type (`generateDemo`, three steps), shared `GenerationRunner` with compare-and-set on every state change (step output accepted once, only while the generation is running in the same run), orphaned `running` step after a crash logged as `unknown` and run again, cancel (status set at once by the web, waiting jobs removed, running call aborted through Redis pub/sub), retry (new run, finished steps kept). Concurrency cap 2 per teacher. Double submit: unique (`user_id`, `client_token`).
- **Transmit:** one channel per user, `users/<token>/generations`, token = HMAC of the user id (users have no public id); `transmit.authorize` lets only the owner subscribe; the SSE routes sit on `app.` behind the `web` guard (`start/transmit.ts`, loaded by web and tests only). Redis transport so the worker's broadcasts reach the web process. Each message is a full snapshot with a database-clock version, so out-of-order messages from two processes cannot show an older state. `providers/transmit_provider.ts` wraps the package provider: it crashed every ace command ("Connection is closed") by opening the transport only to close it on shutdown.
- **Demo page** `/coba-ai` (menu "Coba AI"): scenario choice (Lancar, kunci pertama kena batas kuota, AI lambat, AI menjawab kosong, gagal dulu lalu berhasil), live steps with "Langkah 2 dari 3", Hentikan, Coba lagi, plain failure messages, "Lihat detail" with every attempt (key label, outcome, duration), live connection state. Indonesian copy in `resources/lang/id/ai_demo.json`. Checked in Chromium at 1280, 390 and 360 px (no horizontal scroll; the header nav now drops its icons below `sm`).
- **Data:** forward-only migrations for spike subsets of `ai_credentials`, `generations`, `generation_steps`, `ai_usage_logs` (data model names). Beyond the data model: `generations.runs` and `generations.error_meta`; `template_key`/`template_version` have no foreign key yet; `ai_credential_cooldowns` not built (cooldowns live in Redis only). With the fake driver the page creates three stand-in keys for the user ("Kunci contoh A/B/C"); the real *Kunci AI Saya* page is not part of this spike.
- **Tests (Japa, 48 passing; 31 new):** gateway with the fake provider (429 long delay → failover + cooldown, 429 short delay → same key, timeout → same key then failover, empty reply → failover, transient backoff then failover, bad request no failover, key invalid, all keys daily → earliest reset time, attempt budget, pinned key, round robin, backup keys, no keys); generation job end to end on a real in-process BullMQ worker (live broadcast sequence, double submit, failover keeps the new key pinned, timeout and empty reply, failure then retry resumes at the failed step, cancel aborts the running call at once then retry, ownership 404, channel authorization, concurrency cap, crashed worker's job finished by another worker, shutdown mid-call puts the step back in the queue, page props); Gemini classification against recorded bodies (key in header, per-minute vs per-day 429, HTTP error table, blocked, empty reply, invalid JSON).

### Measurements (2026-11-27, cloud container, 4 vCPU; `scripts/ai-job-spike/measure.cjs`)

Web (`node ace serve`) and `worker-ai` as separate processes, Transmit over Redis, Chromium via Playwright, fake provider with 1.2 s per call. Latency = time from the server's state change (`changedAt`, after the database update) to the browser.

| Measure | Result |
|---|---|
| Progress message received by the page (70 messages, 10 generations) | min 3 ms, median 6 ms, p95 12 ms, max 12 ms |
| Same, until the next painted frame after the message | median 31 ms, p95 39 ms, max 43 ms |
| Messages over 1 s | 0 |
| Worker SIGTERM mid-step | step finished inside the grace period, worker exited with 0 after 1.2 s; new worker ready in 0.9 s; generation succeeded 2.1 s after the restart, nothing lost or repeated |
| Worker SIGKILL mid-step | new worker ready in 0.9 s; the job came back after the 15 s lock expired; step finished 17.3 s after the kill, generation succeeded at 18.5 s; attempt log `content:unknown` then `content:success` (the cut-off call is visible as a possible duplicate cost) |

### Open points

- The 429 per-minute vs per-day detection and the exact Gemini status names are still unverified against live responses (no real key in the container); the Gemini path stays behind `AI_PROVIDER=gemini`.
- Not built: scheduled sweeper for stuck steps (BullMQ stalled-job recovery covers worker crashes), circuit-breaker window and doubling, `ai_credential_cooldowns` mirror, notification in *Kabar*.
- Crash recovery time equals the lock duration (15 s); a shorter lock recovers faster but needs a lock renewal that never stalls.

