# R0-08 load scripts (k6)

Light load on the R0 skeleton: sign-in, `/kalender`, starting AI jobs on the fake provider, and Transmit (SSE) connections held open. Results and the R1 gate: [`docs/drafts/r0-gate.md`](../../docs/drafts/r0-gate.md). Task: [`R0-08`](../../docs/agent/tasks/R0-08-spike-load-gate.md).

| File | What it does |
|---|---|
| `lib.js` | Shared client: Host header per area, cookies kept by hand (production cookies are `Secure`, k6's jar does not send them over http), XSRF header, Inertia headers, one client IP per VU via `X-Forwarded-For` |
| `pages.js` | `browse`: signed-in teachers open `/kalender` (HTML shell, then the deferred `entries` partial reload) with 2–5 s think time, ramp to 50 VUs. `logins`: fresh sign-ins at 2 per second, each followed by `/kalender` |
| `ai-jobs.js` | 10 teachers each start a three-step "smooth" generation on `/coba-ai`, poll until it ends, wait 3–6 s, repeat |
| `sse.js` | 200 teachers each open `GET /__transmit/events`, subscribe to their generations channel and keep the stream open to the end of the run |
| `sse-latency.mjs` | Plain Node probe (k6 cannot read an SSE body while it streams): 10 teachers with an open stream start a generation every 10 s; prints the delay from the server's state change to the message arriving |
| `loop-lag.mjs` | Preloaded into the web and worker processes with `--import`; writes event-loop delay, CPU and memory every 5 s to a JSON-lines file. Changes no app code |
| `seed-load-users.sql` | 300 load users `beban001…beban300@sd-contoh.test` (demo password), teachers at the invented demo school |

The scripts never call a real AI provider: `ai-jobs.js`, `sse.js` and `sse-latency.mjs` stop when the page reports a driver other than `fake`. Never run them against production; the load users and the demo seed exist only in local and test databases.

## Run

Needs Node 26, PostgreSQL 19, Redis and k6 (`.claude/cloud/setup.sh` installs them in cloud sessions).

```bash
# 1. Database: schema, demo seed, load users
node ace migration:run && node ace db:seed
psql "postgres://sigrak:sigrak@127.0.0.1:5432/sigrak" -v count=300 -f spikes/k6/seed-load-users.sql

# 2. Production build; the .env in build/ is a copy of the local one with NODE_ENV=production
#    (AI_PROVIDER=fake, TRANSMIT_TRANSPORT=redis). build/ is ignored by git.
node ace build
cp pnpm-workspace.yaml build/ && (cd build && pnpm i --prod --frozen-lockfile)
sed 's/^NODE_ENV=.*/NODE_ENV=production/' .env > build/.env

# 3. Web and worker-ai, each with the loop-lag probe
cd build
LOOP_LAG_FILE=/tmp/web.jsonl    node --import ../spikes/k6/loop-lag.mjs bin/server.js &
LOOP_LAG_FILE=/tmp/worker.jsonl node --import ../spikes/k6/loop-lag.mjs ace.js queue:work ai &
cd ..

# 4. Scripts (one at a time, or all together for the mixed run)
k6 run spikes/k6/pages.js
k6 run spikes/k6/ai-jobs.js
k6 run spikes/k6/sse.js
node spikes/k6/sse-latency.mjs
```

For CPU per process outside Node (PostgreSQL, Redis, k6) run `pidstat -u -r -h -C 'postgres|redis-server|node|k6' 5` alongside. Stop the web and worker processes afterwards and delete `build/.env`.

## Environment variables

| Variable | Default | Used by |
|---|---|---|
| `TARGET` | `http://127.0.0.1:3333` | all; the web process (or nginx) |
| `APP_HOST` | `app.sigrak.test` | all; Host header of the `app.` area (`app.<APP_DOMAIN>`) |
| `LOAD_PASSWORD` | `sigrak-demo-2026` | all; password of the load users (the demo seed's) |
| `USER_COUNT` | `300` | `lib.js`; number of seeded load users |
| `PAGE_VUS`, `HOLD` | `50`, `3m` | `pages.js`; browse VUs and how long they hold after the 1-minute ramp |
| `THINK_MIN`, `THINK_MAX` | `2`, `5` | `pages.js`; seconds between page views. `THINK_MAX=0` makes it a capacity test |
| `LOGIN_RATE`, `LOGIN_DURATION` | `2`, `4m` | `pages.js`; fresh sign-ins per second |
| `AI_VUS`, `HOLD`, `POLL_SECONDS`, `AI_USER_BASE` | `10`, `3m`, `2`, `100` | `ai-jobs.js`; teachers `beban101…` |
| `SSE_VUS`, `SSE_RAMP`, `SSE_HOLD` | `200`, `60s`, `240s` | `sse.js`; teachers `beban001…beban200` |
| `PROBE_USERS`, `PROBE_USER_BASE`, `PROBE_EVERY_S`, `PROBE_DURATION_S` | `10`, `230`, `10`, `180` | `sse-latency.mjs`; teachers `beban231…` |
| `LOOP_LAG_FILE`, `LOOP_LAG_INTERVAL_MS` | none, `5000` | `loop-lag.mjs` |

The user ranges do not overlap except on purpose: `sse.js` (1–200) includes the `ai-jobs.js` teachers (101–110), so their streams receive real progress messages during the mixed run.

## Thresholds and why

The container (4 vCPU) runs the load generator, PostgreSQL, Redis and the app together, and there is no network between them. The thresholds are server-side budgets that leave room for what production adds: Cloudflare and the tunnel (about 30–80 ms inside Indonesia), nginx, and phone networks.

| Threshold | Value | Why |
|---|---|---|
| `GET /kalender` and its `entries` reload, p95 / p99 | < 300 ms / < 800 ms | A page should be usable within about 1 s on a phone (Fondasi web-baseline). With 200–400 ms of network and rendering on top, 300 ms server time keeps the shell plus the deferred reload inside that budget |
| `GET /masuk`, p95 | < 200 ms | A static Inertia shell with no database work |
| `POST /masuk`, p95 / p99 | < 800 ms / < 1.5 s | scrypt hashing is deliberately slow (about 50 ms of CPU per check) and runs on the libuv thread pool; a sign-in may take longer than a page but must not feel stuck |
| `GET /coba-ai` p95, `POST /coba-ai` p95 | < 300 ms, < 500 ms | Same page budget; starting a job writes several rows and queues a job |
| `ai_generation_seconds` p95 | < 15 s | Three fake steps take 3.6 s of AI time; anything above that is queue wait and runner work. 15 s allows the queue to back up under load but shows when it grows without bound |
| `POST /__transmit/subscribe` p95 | < 300 ms | The page shows "live" only after the subscription |
| `sse_subscribed`, `sse_stream_held_full_time` | > 99 % | No stream may be refused or dropped while held |
| `http_req_failed`, `checks` | < 1 %, > 99 % | Errors under light load are bugs, not capacity |
| SSE delivery (`sse-latency.mjs`) | p99 < 1 s | R0-06 "done when": progress reaches the page within 1 s |
