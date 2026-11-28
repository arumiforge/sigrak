# Load scripts (k6): R0-08, R1-11 and R2-10

Light load on the app: sign-in, the R1 pages behind row-level security (`/kalender` on the layer model, `/ekstrakurikuler`, `/jadwal`, `/kelas/:class/jadwal`, `/kelas-saya/jadwal`), starting AI jobs on the fake provider, and Transmit (SSE) connections held open. Results: [`docs/drafts/r0-gate.md`](../../docs/drafts/r0-gate.md) (§3 R0-08, "R1 re-measure" R1-11). Tasks: [`R0-08`](../../docs/agent/tasks/R0-08-spike-load-gate.md), [`R1-11`](../../docs/agent/tasks/R1-11-load-remeasure.md).

| File | What it does |
|---|---|
| `lib.js` | Shared client: Host header per area, cookies kept by hand (production cookies are `Secure`, k6's jar does not send them over http), XSRF header, Inertia headers, one client IP per VU via `X-Forwarded-For` |
| `pages.js` | `browse`: signed-in teachers open `/kalender` (HTML shell, then one partial reload with every deferred prop) with 2–5 s think time, ramp to 50 VUs. With `R1=1` the teachers take `/kalender`, `/ekstrakurikuler` and `/kelas-saya/jadwal` in turn, and `operators` (10 VUs) take `/jadwal`, `/kelas/:class/jadwal` and `/kalender?kelas=…` in turn. `logins`: fresh sign-ins at 2 per second, each followed by `/kalender`. With `USERS_FILE` every page is checked for the user's own school (`tenant_own_school`) |
| `ai-jobs.js` | 10 teachers each start a three-step "smooth" generation on `/coba-ai`, poll until it ends, wait 3–6 s, repeat |
| `sse.js` | 200 teachers each open `GET /__transmit/events`, subscribe to their generations channel and keep the stream open to the end of the run |
| `sse-latency.mjs` | Plain Node probe (k6 cannot read an SSE body while it streams): 10 teachers with an open stream start a generation every 10 s; prints the delay from the server's state change to the message arriving |
| `loop-lag.mjs` | Preloaded into the web and worker processes with `--import`; writes event-loop delay, CPU and memory every 5 s to a JSON-lines file. Changes no app code |
| `seed-load-users.sql` | R0-08: 300 load users `beban001…beban300@sd-contoh.test` (demo password), teachers at the invented demo school |
| `seed_r1_load.ts` | R1-11: 300 schools from the NPSN directory; in 20 of them (16 SD, 4 MI, spread over Kudus, Jepara and Pati) year 2026/2027 on the Jawa Tengah frame, 12 classes, 15 load teachers and one operator (`operator-beban01…20@sd-contoh.test`), assignments, a saved timetable per class (real generator and save path), school calendar events, a kept-open joint-leave day, an own and a hidden extracurricular. Writes the users file for the tenant check. School-owned rows go through the app's services in tenant transactions, so RLS checks every one of them; schools and users are written as the owner |
| `shared_ip.js` | R2-10 (D-479): a lab behind one school IP. 300 exam cards sign in on `ujian.` and 300 load teachers on `app.` within one minute, every request with the same `X-Forwarded-For` (`SCHOOL_IP`); every sign-in must succeed |
| `seed_exam_cards.ts` | R2-10: 300 exam cards `lab-001…lab-300` (password `kartu-lab`) in the demo exam session, whose window it opens |
| `proc-sample.mjs` | CPU and memory per process tree (`pg=pid:<postmaster>`) or command name, every 5 s; used instead of `pidstat -C postgres` when other PostgreSQL servers share the machine |

The scripts never call a real AI provider: `ai-jobs.js`, `sse.js` and `sse-latency.mjs` stop when the page reports a driver other than `fake`. Never run them against production; the load users and the demo seed exist only in local and test databases.

## Run

Needs Node 26, PostgreSQL 19, Redis and k6 (`.claude/cloud/setup.sh` installs them in cloud sessions).

R1-11 (R1 pages behind RLS): steps 2–4 below, but seed with

```bash
node ace migration:run && node ace db:seed && node ace curriculum:import && node ace layers:import-catalog --activate
node --import=@poppinss/ts-exec spikes/k6/seed_r1_load.ts /abs/path/load-users.json
# PostgreSQL with pg_stat_statements (shared_preload_libraries), reset before each run
R1=1 USERS_FILE=/abs/path/load-users.json k6 run spikes/k6/pages.js
```

The pages run on the `tenant` connection (`DB_APP_USER`, a member of `sigrak_app`, no BYPASSRLS) inside `tenantTransaction()`, which sets `app.school_id` and `app.user_id` with `SET LOCAL` per transaction. Sign-in (`users`), the school's level for the policy profile and the AI demo still use the owner connection (R1-01, D-470).

R2-10 (shared school IP): the R0-08 database steps with the load users, then

```bash
node --import=@poppinss/ts-exec spikes/k6/seed_exam_cards.ts
# web process from build/ as in step 2-3, started with TRUSTED_PROXIES=127.0.0.1 (k6 plays nginx)
k6 run spikes/k6/shared_ip.js              # 300 pupils + 300 teachers in 60 s
WINDOW=10 k6 run spikes/k6/shared_ip.js    # the same in 10 s
```

R0-08 (skeleton):

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
| `R1` | unset | `pages.js`; `1` runs the R1 page mix and the operators scenario |
| `OPERATOR_VUS`, `OPERATOR_COUNT` | `10`, `20` | `pages.js`, `lib.js`; operator VUs and seeded operators |
| `USERS_FILE` | unset | `lib.js`; users file of `seed_r1_load.ts` (absolute path) for the tenant check |
| `LOGIN_START` | `30s` | `pages.js`; when the sign-ins start (`0s` for a sign-in-only run with `PAGE_VUS=0`) |
| `PAGE_VUS`, `HOLD` | `50`, `3m` | `pages.js`; browse VUs and how long they hold after the 1-minute ramp |
| `THINK_MIN`, `THINK_MAX` | `2`, `5` | `pages.js`; seconds between page views. `THINK_MAX=0` makes it a capacity test |
| `LOGIN_RATE`, `LOGIN_DURATION` | `2`, `4m` | `pages.js`; fresh sign-ins per second |
| `AI_VUS`, `HOLD`, `POLL_SECONDS`, `AI_USER_BASE` | `10`, `3m`, `2`, `100` | `ai-jobs.js`; teachers `beban101…` |
| `SSE_VUS`, `SSE_RAMP`, `SSE_HOLD` | `200`, `60s`, `240s` | `sse.js`; teachers `beban001…beban200` |
| `PROBE_USERS`, `PROBE_USER_BASE`, `PROBE_EVERY_S`, `PROBE_DURATION_S` | `10`, `230`, `10`, `180` | `sse-latency.mjs`; teachers `beban231…` |
| `SCENARIO`, `LAB`, `WINDOW`, `SCHOOL_IP` | `both`, `300`, `60`, `203.0.113.10` | `shared_ip.js`; `pupils`, `teachers` or both, sign-ins per scenario, seconds they are spread over, the lab's one IP |
| `EXAM_HOST`, `CARD_PASSWORD` | `ujian.` + `APP_HOST`'s domain, `kartu-lab` | `shared_ip.js`; `CARDS` and `CARD_PASSWORD` also set `seed_exam_cards.ts` |
| `LOOP_LAG_FILE`, `LOOP_LAG_INTERVAL_MS` | none, `5000` | `loop-lag.mjs` |

The user ranges do not overlap except on purpose: `sse.js` (1–200) includes the `ai-jobs.js` teachers (101–110), so their streams receive real progress messages during the mixed run.

## Thresholds and why

The container (4 vCPU) runs the load generator, PostgreSQL, Redis and the app together, and there is no network between them. The thresholds are server-side budgets that leave room for what production adds: Cloudflare and the tunnel (about 30–80 ms inside Indonesia), nginx, and phone networks.

| Threshold | Value | Why |
|---|---|---|
| `GET /kalender` and its deferred reload, and every R1 page (`/ekstrakurikuler`, `/jadwal`, `/kelas/:class/jadwal`, `/kelas-saya/jadwal`, `/kalender?kelas`), p95 / p99 | < 300 ms / < 800 ms | A page should be usable within about 1 s on a phone (Fondasi web-baseline). With 200–400 ms of network and rendering on top, 300 ms server time keeps the shell plus the deferred reload inside that budget |
| `GET /masuk`, p95 | < 200 ms | A static Inertia shell with no database work |
| `POST /masuk`, p95 / p99 | < 800 ms / < 1.5 s | scrypt hashing is deliberately slow (about 50 ms of CPU per check) and runs on the libuv thread pool; a sign-in may take longer than a page but must not feel stuck |
| `GET /coba-ai` p95, `POST /coba-ai` p95 | < 300 ms, < 500 ms | Same page budget; starting a job writes several rows and queues a job |
| `ai_generation_seconds` p95 | < 15 s | Three fake steps take 3.6 s of AI time; anything above that is queue wait and runner work. 15 s allows the queue to back up under load but shows when it grows without bound |
| `POST /__transmit/subscribe` p95 | < 300 ms | The page shows "live" only after the subscription |
| `sse_subscribed`, `sse_stream_held_full_time` | > 99 % | No stream may be refused or dropped while held |
| `http_req_failed`, `checks` | < 1 %, > 99 % | Errors under light load are bugs, not capacity |
| `tenant_own_school` | = 100 % | Any page that shows another school's name or items is a tenant leak, not a performance issue |
| SSE delivery (`sse-latency.mjs`) | p99 < 1 s | R0-06 "done when": progress reaches the page within 1 s |
