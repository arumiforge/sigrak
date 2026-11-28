# R2-10 — Schools behind one IP, and two Redis containers

- **Phase:** R2
- **Status:** review
- **Owner:** r2/r2-10-shared-ip-redis
- **Depends on:** R2-01; D-479, D-480
- **Can run in parallel with:** R2-02…R2-08 (R2-02 also touches staff sign-in: keep edits there line-level)

## Goal

Apply D-479 (a lab of up to 300 pupils signs in from one public IP without being throttled or blocked, and the app reads the real client IP) and D-480 (separate `redis` state and `redis-cache` connections), with D-478 (Gotenberg removed) reflected in the server guides.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R2-00-console-plan.md`; decisions D-183, D-415, D-417, D-427, D-478, D-479, D-480
- `config/app.ts`, `config/redis.ts`, `config/session.ts`, `config/limiter.ts`, `config/queue.ts`, `config/transmit.ts`, `start/limiter.ts`, `app/accounts/throttles.ts`, `app/services/login_attempts.ts`, the exam site sign-in (`start/routes/` for `ujian.`), any cache use (`app/layers/resolver/`, `app/curriculum/`)
- `docs/server/compose-and-processes.md` and the other `docs/server/` guides that mention nginx, Cloudflare, CrowdSec or Redis (Indonesian prose, commands stay English)

## Output

- `trustProxy` set so `request.ip()` is the real client IP only when the request comes through the nginx hop (configurable list of trusted proxy addresses in env); a test that a forged `X-Forwarded-For` from an untrusted address is ignored.
- Limits per D-479: failures per account and IP (keep), IP-only limits sized for 300 people at once, exam site limits keyed on the exam session or class code; tests that 300 sign-ins from one IP in a minute pass and that brute force on one account is still stopped.
- Redis per D-480: a `cache` connection (`REDIS_CACHE_HOST`/`PORT`/`PASSWORD`/`DB`, falling back to the main Redis in development and CI), caches moved onto it, state (queues, sessions, limiter, Transmit) stays on `main`; `.env.example` and the cloud setup updated.
- `docs/server/`: the two Redis services in the Compose plan (settings: noeviction + AOF vs allkeys-lru + memory cap, no persistence), nginx real-IP and `limit_req`/`limit_conn` values that fit a shared school IP, Cloudflare rate-limit rule guidance, CrowdSec whitelist/tuning for school IPs; Gotenberg removed from any guide.
- k6 script `spikes/k6/shared_ip.js`: 300 pupils sign in from one IP within a minute; result noted in the task Result.

## Done when

- [x] Tests (own database `sigrak_test_r210`), lint, typecheck, format check pass
- [x] Server guides updated (Indonesian), no Gotenberg left in `docs/server/`
- [x] Result filled, open questions listed

## Result

Branch `r2/r2-10-shared-ip-redis` (from `r2/r2-00-split` at fafb75b). Full suite 405 tests (393 before + 12 new), lint, both typechecks, `prettier --check .` and `node ace build` pass. Also run with the cache on a private Redis (`REDIS_CACHE_HOST`, port 6390) and with the cache pointed at a dead port (resolver and calendar tests pass, the process shuts down cleanly).

**Client IP (D-479).** `TRUSTED_PROXIES` (comma-separated addresses/CIDRs, `app/services/trusted_proxies.ts`) sets `http.trustProxy`; empty trusts nobody. The framework default trusted loopback, so anything on the host could forge `X-Forwarded-For`; that default is gone. `X-Forwarded-Proto`/`-Host` follow the same rule, so nginx clears `X-Forwarded-Host` (guide). Tests: a forged header from an untrusted address does not escape the per-account block; with a trusted proxy the forwarded IP keys the limit (the same account from another IP still signs in).

**Limits.** Failed sign-ins per area, account and IP unchanged (5/min, 5-minute block). `POST /masuk` per IP on `app.`/`admin.` 30 → 600/min (`SIGN_IN_PER_IP_PER_MINUTE`, `start/limiter.ts`). `ujian.` sign-in no longer has an IP limit: `app/services/exam_sign_in_limits.ts` keys a brake on the card's open exam session (900/min per session); cards that match no open session are braked per IP (300/min). Guest forms per IP: reset link 5 → 30, new password 10 → 60, sign-up, invitation and confirmation 10 → 120 per minute. Because the reset-link IP limit is looser, reset mails are now also limited per account (3 per 15 minutes, same neutral answer, `app/accounts/password_reset.ts`). Tests: 300 teachers on `app.` and 300 exam cards on `ujian.` from one IP in well under a minute all succeed; the sixth wrong try on one card is refused even with the right password while a neighbour on the same IP signs in; 3 reset mails per account.

**Redis (D-480).** New `cache` connection in `config/redis.ts`: `REDIS_CACHE_HOST`/`PORT`/`PASSWORD`/`DB`; without a host it is database 3 of the main Redis (development, CI, cloud sessions). Key prefix `sigrak:cache:<DB_DATABASE>:` so parallel test databases never share entries. No offline queue, 250 ms command timeout, endless reconnect: a request never waits for it. `app/services/shared_cache.ts` (`SharedCache`: JSON values, TTL, fail-open on any error, `clear()` by namespace with SCAN). The layer resolver now has two levels: a small in-process LRU (500 entries, 60 s, safe because keys hold the layer stamps) and the shared cache (24 h); `clearCache()` is async now (callers in tests updated), `clearLocalCache()` and `cacheStats().sharedHits` added. `node ace cache:clear` empties the shared caches (after a database restore). `providers/redis_cache_provider.ts` drops a not-ready cache connection before the Redis provider's QUIT, which otherwise throws and leaves the process hanging when `redis-cache` is down. State (queues, sessions, limiter, Transmit, AI key state) stays on `main`. `.env.example`, `compose.yaml` (`redis` with explicit `noeviction`, new `redis-cache` on port 6380, allkeys-lru, no persistence), `.claude/cloud/setup.sh` comment and `docs/agent/cloud-environment.md` updated.

**Server guides.** New `docs/server/sekolah-satu-ip.md`: Cloudflare → nginx → app IP chain (fixed `edge` subnet and nginx address per environment, `set_real_ip_from` the Docker gateway, `real_ip_header CF-Connecting-IP`, `X-Forwarded-For $remote_addr` replaced), nginx `limit_req` (`/masuk` 10 r/s burst 300, pages 100 r/s burst 2000, none on SSE and assets) and `limit_conn` 1000 per IP, the Cloudflare rate-limit rule (`POST /masuk`, 150 per 10 s per IP, above the app's limit) and settings that can block a school (Under Attack, Security Level, Bot Fight Mode, country/ASN blocks), CrowdSec scenarios kept and removed (`http-crawl-non_statics`, `http-generic-bf`), school IP whitelist, 1 h ban, how to unban, the k6 check. `compose-and-processes.md`: `redis` and `redis-cache` in the service table, a "Dua Redis" section (settings, memory caps, `vm.overcommit_memory`, `cache:clear` after a restore), memory table. Short links in `README.md`, `runbook-insiden.md`, `jadwal-perawatan.md`, `rekomendasi-tambahan.md`. `docs/server/` had no Gotenberg mention before this task and has none now.

**k6 shared IP** (`spikes/k6/shared_ip.js`, cards from `spikes/k6/seed_exam_cards.ts`; production build, one web process, `TRUSTED_PROXIES=127.0.0.1`, Redis sessions and limiter, own database, cloud session 4 vCPU). Every request from one IP (`203.0.113.10`):

| Run | Sign-ins | Result | POST /masuk p95 (app / ujian) |
|---|---|---|---|
| 300 pupils (`ujian.`) + 300 teachers (`app.`) spread over 60 s | 600 | 600 signed in, 0 refused, 0 failed requests, 1800/1800 checks | 82 ms / 23 ms |
| the same in 10 s (`WINDOW=10`) | 600 | 600 signed in, 0 refused, 0 failed requests | 497 ms / 404 ms |

This tests the app's limits only; nginx and Cloudflare limits are tested on staging once R3 builds them (guide §5).

**Deviations.**
- Policy-profile cache (`app/curriculum/policy/policy_profile_resolver.ts`) stays in process memory: it is built from repository files plus a few curriculum rows, holds promises, has a 10-minute lifetime, and is cleared by every import in the importing process. Only the layer resolutions moved to `redis-cache`. There is no page cache yet.
- D-183's numbers for the guest forms changed (listed above), following D-479.
- `/healthz` does not check `redis-cache` (losing it is not an outage); R2-04 (Kesehatan Sistem) may want to show it.
- The exam sign-in brake costs one extra indexed query per attempt (card → open session).

**Open questions for the owner.**
- Are 600 sign-ins per minute per IP on `app.` and 900 per exam session per minute right, or should a large school with two labs starting together get more? Both are constants, easy to change.
- Should the Cloudflare rule block or use a managed challenge? The guide says block, because a challenge on a POST breaks the form and old lab browsers may fail it.
- CrowdSec school whitelist: who adds IPs (support from Minta Bantuan reports, or only the developer)?

**Open questions for the team.**
- R3: build the `edge` network, fixed nginx address and `TRUSTED_PROXIES` exactly as in the guide; check that `cloudflared` really reaches nginx from the Docker gateway (if the tunnel runs in a container on the `edge` network, `set_real_ip_from` becomes its address instead).
- R2-04: show `redis-cache` reachability and memory use on Kesehatan Sistem; a down cache is a warning, not an outage.
- R2-02 (staff sign-in): the staff route keeps `loginIpThrottle` (now 600/min); nothing in the staff controller changed here.
- When more caches arrive (page caches, the exam add-on), use `SharedCache` on the `cache` connection and never `main`; JSON values only.
- Adonis logs every failed reconnect of the cache connection at level fatal (`Redis connection failure`). That is noisy while `redis-cache` is down; R3 alerting should treat it as a warning for the cache port.

