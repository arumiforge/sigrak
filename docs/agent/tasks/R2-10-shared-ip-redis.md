# R2-10 — Schools behind one IP, and two Redis containers

- **Phase:** R2
- **Status:** in-progress
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

- [ ] Tests (own database `sigrak_test_r210`), lint, typecheck, format check pass
- [ ] Server guides updated (Indonesian), no Gotenberg left in `docs/server/`
- [ ] Result filled, open questions listed

## Result
