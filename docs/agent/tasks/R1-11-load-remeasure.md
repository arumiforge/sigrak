# R1-11 — Load re-measure with a real page and RLS

- **Phase:** R1
- **Status:** done
- **Owner:** r1/r1-11-load
- **Depends on:** R1-08
- **Can run in parallel with:** —

## Goal

Repeat the R0-08 measurement with the first real R1 page (calendar on the layer model) behind RLS and `SET LOCAL`, as D-467 requires.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- `docs/drafts/r0-gate.md`, `spikes/k6/README.md`; decisions D-429, D-467

## Output

- Updated k6 scripts for the R1 pages; results appended to `docs/drafts/r0-gate.md` (new section "R1 re-measure") with a comparison table and any regressions.

## Done when

- [x] Tests (own test database `sigrak_test_r111`), lint and typecheck pass; IDOR test for every school-owned resource (no new school-owned resource)
- [x] Pages checked at 360 and 1280 px where the task has UI; all text in `resources/lang/id` (no UI in this task)
- [x] Result filled, open questions listed

## Result

Branch `r1/r1-11-load` (from `r1/r1-11-12-final`). 356 tests pass on `sigrak_test_r111` (`REDIS_QUEUE_DB=7`, `REDIS_AI_DB=8`), 6 of them new; lint, typecheck and format check pass. Full results: `docs/drafts/r0-gate.md`, section "R1 re-measure".

**Measured.** Six runs on a production build with the R0-08 load shapes: A0 (R0-08 run A unchanged), A (R1 page mix: 50 teachers on `/kalender`, `/ekstrakurikuler`, `/kelas-saya/jadwal`, 10 operators on `/jadwal`, `/kelas/:class/jadwal`, `/kalender?kelas=`, 2 sign-ins/s), C (A + 200 SSE streams + AI jobs + SSE probe), D0/D1 (capacity, no think time) and E (30 sign-ins/s). Every light-load threshold of D-467 passes: highest page p95 60 ms (`/jadwal`), p99 96 ms; 0 errors; SSE 200 of 200, delivery p99 12 ms; AI generation p95 3.7 s at concurrency 50. One web process saturates at 249 req/s on the `/kalender` mix (R0-08: 354) and 123 req/s on the R1 mix. That is about 1,350 simultaneously active teachers per replica.

**RLS and `SET LOCAL`.** The R1 pages and the membership lookup run on the app login `sigrak_app_user` (no BYPASSRLS) in tenant transactions. In every run `pg_stat_statements` shows as many `BEGIN` as `COMMIT` as `set_config` calls for that login, no rollbacks and no session `SET`. 46,847 own-school checks under load found no page with another school's data. Sign-in, curriculum reads, the policy-profile school lookup and the AI demo still use the owner connection. A smoke run with the default connection on the app login breaks only the AI demo (the `generations` policy).

**Built**

- `spikes/k6/pages.js` (`R1=1` mode, operators scenario, tenant checks with `USERS_FILE`), `lib.js` (operators, users file, deferred props), `seed_r1_load.ts` (300 directory schools, 20 load schools with classes, saved timetables, calendar and extracurricular changes, 320 users), `proc-sample.mjs` (CPU and memory per process tree), README.
- Fixes, each with a test:
  - `metaFiles` copy the runtime `docs/data` folders into the build. Without them the production build answered 500 on `/jadwal`, `/ekstrakurikuler` and every page that resolves the Profil Jenjang.
  - Sign-in looks accounts up by `lower(email)` on `users` and `staff_users`. Before, it scanned the table: 8 ms at 100,000 users, 0.04 ms now.
  - `/jadwal` converts the year's rows once instead of once per class.
  - `messagesFor` is cached per namespace set.
  - Migration `1764411000001`: index `topics (curriculum_version_id, grade)`. The topic count was the busiest statement under load.

**Shared files touched:** `adonisrc.ts` (metaFiles), `app/models/user.ts`, `app/models/staff_user.ts`, new `app/models/email_lookup.ts`, `app/middleware/translations_middleware.ts`, `app/timetable/slots.ts`, `app/timetable/controllers/timetable_controller.ts`, `tests/unit/translations.spec.ts`, `tests/functional/timetable/slots.spec.ts`, `docs/drafts/r0-gate.md`.

**Deviations**

1. PostgreSQL ran in a private 19.0 cluster on port 3397 with the shared cluster's settings plus `pg_stat_statements`, because the shared cluster does not preload it and a restart would have disturbed other sessions. The test database stays on the shared cluster.
2. Run A adds 10 operator VUs to the 50 teachers, because the timetable pages are operator pages. A0 repeats R0-08 run A exactly for a like-for-like `/kalender` number.
3. Run C uses one `worker-ai` at the decided concurrency of 50 (D-467), not 4; R0-08 run F stands for the "enough slots" comparison.

**Regressions (causes in the report)**

- `/kalender` costs about 1.5 times the skeleton. The deferred reload has five props, with effective days computed each time, and there are four transactions per view.
- The timetable pages take 28–34 ms median, CPU-bound in Node: Lucid hydration of the whole year, rules per class, 12 uncached curriculum queries per request.
- Web heap reaches 259 MB at saturation.
- The worst single event-loop delay is 52 ms.

**Proposed decisions (team)**

1. Cache `SubjectsForGrade` per process like the policy profile (10 min); curriculum data changes only on import.
2. One tenant transaction per request: fold the membership lookup into the page's transaction, or keep the membership in the session with a short recheck.
3. Load-test data comes from `seed_r1_load.ts` from now on; `seed-load-users.sql` stays for the R0-08 shape only.

**Open questions**

1. Owner: accept the R1 re-measure as passing D-467 and the revised scale estimate (about 1,350 active teachers per web replica, about 5,400 on four)? No sizing change is proposed for D-415.
2. Team: who moves the generation service onto tenant transactions before R3 runs production on the app login? Until then the AI demo works only on the owner connection.
3. Team: the timetable read path (plain rows instead of Lucid models, rules once per year, the cache above) is the main lever for capacity and event-loop delay. Should it be a task before R5 builds more timetable pages?
4. Team: effective days per class are recomputed on every `/kalender` reload. Cache them by resolver stamp once the timetable gives each class its lesson days (R1-08 open question 1)?
