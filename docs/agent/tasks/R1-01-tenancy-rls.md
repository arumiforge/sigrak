# R1-01 — Tenancy core and row-level security

- **Phase:** R1
- **Status:** in-progress
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

- [ ] Tests pass with a separate test database (`sigrak_test_r101`); lint and typecheck pass
- [ ] A raw query without `SET LOCAL` returns no school rows
- [ ] Result filled, open questions listed

## Result
