# R1-01 — Tenancy core and row-level security

- **Phase:** R1
- **Status:** done
- **Owner:** r1/r1-01-tenancy-rls
- **Depends on:** R0 gate (D-468)
- **Can run in parallel with:** R1-02, R1-03, R1-10

## Goal

Schools are tenants. Every school-owned row is filtered twice: in the app (fail-closed school context) and in PostgreSQL (RLS), with the tenant set by `SET LOCAL` inside each transaction so it works behind PgBouncer in transaction pooling (D-398, D-429).

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- `docs/final/data-model.md`: Conventions, Tenancy and access, Accounts and schools
- Decisions D-398, D-429, D-339…D-343 (roles), D-466 (regions keyed by Kemendagri codes), D-182 (public ids)
- Existing skeleton: `database/migrations/1764200000001…5`, `app/models/{region,school,user,school_membership,staff_user}.ts`, `app/middleware/`, `tests/helpers.ts`
- `P5-03-foundation.md` P5-03a Result (rules only)

## Output

- Migrations (block `17643000xxxxx`, forward-only, D-085): extend the skeleton tables to the data model (`school_memberships` roles and one active principal per school, `supervisor_assignments`, `users.nip`); a non-owner database role for the app; RLS policies on every school-owned table reading `current_setting('app.school_id', true)`; staff bypass only through an explicit role.
- `app/tenancy/`: school context (empty per request and job, `runFor()` for jobs), a transaction helper that runs `SET LOCAL app.school_id` (and user id) first, a model mixin that fills and checks `school_id`, the middleware that picks the active membership.
- Test helpers for two schools and an IDOR assertion; tests that RLS blocks a query even when the app scope is skipped, and that the tenant never leaks between pooled transactions.
- Short section "Tenancy" for R4 notes in this file's Result.

## Done when

- [x] Tests pass with a separate test database (`sigrak_test_r101`); lint and typecheck pass
- [x] A raw query without `SET LOCAL` returns no school rows
- [x] Result filled, open questions listed

## Result

Branch `r1/r1-01-tenancy-rls`. 72 tests pass on `sigrak_test_r101` (24 new in `tests/functional/tenancy/`); `pnpm lint`, `pnpm typecheck`, `pnpm format:check` pass.

**Built**

- Migrations `1764300000001…4`:
  - `…01` roles: `sigrak_app` (NOLOGIN, no BYPASSRLS, not the owner; table and sequence grants plus default privileges for later tables) and `sigrak_staff` (member of `sigrak_app`). Both are created only when missing and never dropped, because roles are cluster-wide. Also SQL functions `app_school_id()` and `app_user_id()`, which read `current_setting('app.school_id' / 'app.user_id', true)` and treat `''` as unset.
  - `…02` checks: `school_memberships` (ended ⇔ `ended_on`, `ended_on >= started_on`) and `users.nip` (18 digits). The one-active-principal partial unique index and `users.nip` were already in the skeleton.
  - `…03` `supervisor_assignments`: `status` ∈ requested/approved/rejected, `started_on` set only when approved, `ended_on` for revocation, `decided_by_staff_id`, `decided_at`, at most one open row per school and user.
  - `…04` RLS on `school_memberships`, `supervisor_assignments`, `exam_sessions`, `exam_participants`, `calendars`, `calendar_events`, `generations`, `generation_steps`, `ai_usage_logs`.
- `app/tenancy/` (import alias `#tenancy/*`):
  - `school_context.ts`: `SchoolContext` on AsyncLocalStorage. It starts empty for every request and job; `run()` fills it, `runFor(schoolId, fn)` is for jobs, `requireSchoolId()` throws when no school is set.
  - `tenant_transaction.ts`: `tenantTransaction(fn, scope?)` opens a transaction on the `tenant` connection and first runs `set_config('app.school_id', …, true)` and the same for `app.user_id` (SET LOCAL semantics). `staffTransaction(fn)` runs `SET LOCAL ROLE sigrak_staff`.
  - `with_school_scope.ts`: mixin `withSchoolScope`. It uses the tenant connection, and the open tenant transaction when there is one (`tenancy_adapter.ts`). It scopes every query to the school in context (no school means no rows) and fills and checks `school_id` on create, update and delete. `withoutSchoolScope()` skips only the app scope; RLS still applies.
  - `active_membership.ts` and `school_context_middleware.ts`: the named middleware `school` picks the membership kept in the session under `tenancy.membership`, else the earliest active one, and runs the request inside it. It raises 403 `E_NO_ACTIVE_MEMBERSHIP` when there is none.
  - `rls.ts`: SQL helpers `schoolRls()`, `childRls()`, `staffPolicy()`, `dropRls()` for later migrations.
  - `database_roles.ts`: role names and `ensureAppLoginRole()`.
- Model `SupervisorAssignment` (the first model that uses the mixin).
- Tests: `tests/tenancy.ts` has `createTwoSchools()`, `createMember()`, `asSchool()` and the IDOR helpers `assertSchoolCannotRead()` (app wall) and `assertRlsHides()` (database wall). The specs cover:
  - `rls.spec.ts`: no rows without SET LOCAL; raw SQL limited to the school; cross-school writes refused; no leak across transactions on one pooled backend (same `pg_backend_pid`, also after a rollback); 20 parallel transactions; region calendars; staff.
  - `school_scope.spec.ts`: context, mixin, IDOR, active membership, middleware.
  - `rls_coverage.spec.ts`: fails when a table with `school_id`, or a listed child table, lacks RLS or either policy.

**Shared files touched (small edits):** `config/database.ts` (new `tenant` connection), `start/env.ts` (`DB_APP_USER`, `DB_APP_PASSWORD`), `.env.example`, `.env.test`, `start/kernel.ts` (named middleware `school`), `package.json` (`#tenancy/*` import), `tests/bootstrap.ts` (setup hook `prepareTenantLogin()` after migrate), `database/schema.ts` (regenerated). R1-03 regenerates `database/schema.ts` too, so expect a merge conflict there; fix it by running the migrations again.

### Tenancy (notes for R4)

- **Two connections.** `pg` logs in as the owner (`DB_USER`), which runs migrations and seeders. `tenant` logs in as `DB_APP_USER`, a member of `sigrak_app`, so RLS always applies to it. Use the tenant connection only through `tenantTransaction()` or `staffTransaction()`. With PgBouncer in transaction mode the tenant lives only inside one transaction (D-429): never `SET` at session level, never set it outside a transaction.
- **School-owned table checklist:** `school_id NOT NULL`, indexed, composite indexes start with it; `for (const sql of schoolRls('table')) this.schema.raw(sql)` in the migration (`childRls` for a child table without `school_id`, and add it to `CHILD_TABLES` in `rls_coverage.spec.ts`); a model with `compose(XSchema, withSchoolScope)`; an IDOR test with `assertSchoolCannotRead` / `assertRlsHides`.
- **Requests:** routes on `app.` add `middleware.school()` after `auth({ guard: 'web' })`; controllers wrap their database work in `tenantTransaction(async () => …)`. **Jobs:** `SchoolContext.runFor(job.schoolId, () => tenantTransaction(…))`. **Console:** `staffTransaction()`, after the staff role and scope checks.
- **Role setup per environment.** The migrating user needs CREATEROLE, or the server setup creates `sigrak_app` and `sigrak_staff` first. The app's login user is created with `ensureAppLoginRole()`: `GRANT sigrak_app TO <login>` (inherit) and `GRANT sigrak_staff TO <login> WITH INHERIT FALSE, SET TRUE`. Tests and CI do this in the runner setup as the superuser `sigrak`, from `DB_APP_USER` and `DB_APP_PASSWORD` (`.env.example`, `.env.test`). CI needs no workflow change.
- **Limits of the app scope:** bulk `query().update()` and `query().delete()` are scoped when `query()` builds them; relation and preload queries are scoped by fetch hooks; raw `db` queries get only the RLS wall.

**Proposed decisions**

1. *Two database logins:* the owner runs migrations; the app runs as a login that is a member of the non-owner role `sigrak_app` (no BYPASSRLS). Staff get past the school policies only with `SET LOCAL ROLE sigrak_staff` in one transaction; the login holds that role without inheritance.
2. *Tenant setting:* `set_config('app.school_id' | 'app.user_id', …, true)` as the first statement of every tenant transaction; the policies read it through `app_school_id()` and `app_user_id()`, and an empty value means no tenant.
3. *Fail-closed app scope:* with no school in context a scoped model returns no rows and cannot create (P5-03a rule kept). A nested tenant transaction for another school is refused.
4. *Own rows before a school is chosen:* a user may read their own `school_memberships` and `supervisor_assignments` rows in any school (policy `user_id = app_user_id()`), so the active membership and a supervisor's school list can be found before a school is chosen.
5. *Region rows:* region calendars (`school_id` NULL) are readable by every school and written only by staff. Child tables follow their parent row's policy.
6. *One active principal:* keep the partial unique index instead of the generated column `active_principal_school_id` in `data-model.md` (same rule; the generated column was a MySQL workaround). Update `data-model.md` with the next sync.
7. *Who adopts the walls when:* the app's default runtime connection stays the owner until each module adopts the tenancy helpers. The R0 spike code (calendar, AI demo, exam login) still uses the owner connection and passes RLS. R1-05 (auth) adds `middleware.school()` to the `app.` routes and moves memberships over, and R1-08 does the same for calendars. Production runs the web and worker roles on the tenant login from R3. After that, consider `FORCE ROW LEVEL SECURITY`.

**Open questions**

1. Should `support` staff, who view a school read-only under D-341, get a separate read-only role (`sigrak_staff_read`, SELECT-only policies) instead of the full `sigrak_staff`? Default now: one staff role, with write access.
2. Supervisors read their approved schools (D-309) with no student-level rows. Should this be an RLS policy on `app_user_id()` plus approved `supervisor_assignments`, or app-only? Proposed: decide with the supervisor portal (D-184). A supervisor's request for a school is written by staff or a later portal action; the current policy only lets the school's own context write the row.
3. Exam login on `ujian.` finds a participant by username without a school. With RLS it needs a narrow `SECURITY DEFINER` lookup or the exam session id in the card. Decide with the exam slice.
4. `ai_credentials` belong to a user, not a school (D-012), and have no RLS yet. Should they get a per-user policy (`user_id = app_user_id()`)? Proposed: with the AI slice.
5. Regions keyed by Kemendagri codes (D-466) are left to R1-04 (regions and school directory).
6. Server setup (R3): create `sigrak_app` and `sigrak_staff` before the first migration if the owner has no CREATEROLE, and add an ace command that wraps `ensureAppLoginRole()` for production logins.


### Follow-up D-469

Branch `r1/r1-12-accounts-followups`. Answers open question 1: support gets a read-only role.

- Migration `1764390000003` creates `sigrak_staff_readonly` (NOLOGIN, no BYPASSRLS, not a member of `sigrak_app`). It may SELECT every table except `STAFF_READ_HIDDEN_TABLES` (migration bookkeeping, password reset and confirmation hashes, `ai_credentials`), has no write grant, and gets a `<table>_staff_read` SELECT policy on every table with RLS. Default privileges give later tables SELECT; a later table with secrets is added to the hidden list and revoked in its own migration.
- `staffPolicy()` (and so `schoolRls()` and `childRls()`) also adds the read policy, creating the role first when missing, so older migrations still run on an empty server. `dropRls()` drops it. `rls_coverage.spec.ts` now requires the three policies.
- `ensureAppLoginRole()` grants the role to the app login `WITH INHERIT FALSE, SET TRUE`.
- `staffReadTransaction(fn)` opens a `READ ONLY` transaction with `SET LOCAL ROLE sigrak_staff_readonly` (SchoolContext `staff: true, readOnly: true`). The console school list and page, user search and region change queue read through it.
- Tests in `rls.spec.ts` ("read-only staff"): every school's rows are visible; writes through the helper fail; the role alone (without READ ONLY) is refused on UPDATE, INSERT and DELETE on RLS and non-RLS tables; the hidden tables are refused; the login holds the role only with SET.
- R3 server setup: create `sigrak_staff_readonly` with the other two roles when the migrating user has no CREATEROLE.
