# R2-01 — Staff roles, scopes, staff accounts, audit log, Hak akses

- **Phase:** R2
- **Status:** in-progress
- **Owner:** r2/r2-01-staff-roles
- **Depends on:** R1 (D-476)
- **Can run in parallel with:** —

## Goal

Replace the three-role staff model of R1-05 with the twelve roles (D-339 plus Peneliti, D-439), several roles per person each with its own scope (D-338), powers fixed in code, and the console pages to manage staff, scopes and the audit log.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R2-00-console-plan.md`
- `docs/drafts/internal-roles.md` (§2 catalogue, §3 matrix, §5 scopes); decisions D-314, D-338, D-339, D-341, D-439, D-469, D-477
- Existing code: `app/accounts/staff_access.ts`, `app/accounts/console.ts`, `app/models/staff_user.ts`, `start/routes/console.ts`, `app/tenancy/` (staff transactions), `inertia/layouts/` console layout, `inertia/lib/navigation.ts`

## Output

- Migrations (block `17645000xxxxx`): `staff_role_assignments` (staff user, role, scope as region ids / school ids / levels / fields, created by, timestamps); move existing `staff_users.role` into it and drop the column; `staff_users.disabled_at`. Roles: `owner`, `admin`, `validator`, `content`, `curriculum`, `support`, `marketing`, `sales`, `regional_lead`, `finance`, `engineer`, `researcher` (Peneliti).
- `app/staff/`: `abilities.ts` (the one catalogue of ability keys for all of R2, including keys used by R2-02…R2-09: settings, AI models, system health, kabar, events, stories, legal pages, help requests, support sessions, problems, good practice, forum, curriculum console, staff, audit), `powers.ts` (role → abilities from §3, D-340/D-477 aside), scope checks (`withinScope(staff, school)` for region/school list; level and field helpers), `authorizeStaff(ctx, ability, school?)`; replace `app/accounts/staff_access.ts` callers.
- Console pages (admin.): Staf (list, invite/create staff, roles and scopes per assignment, disable/enable; owner-only roles stay owner-only), Log aktivitas (filter by staff, action, date), Hak akses (read-only matrix, D-314). Console lists of schools and users respect scope (support and sales see only their area).
- Every role and scope change logged; a staff member cannot change their own roles; the last owner cannot be removed.
- Seeder/ace command to create the first owner account from env or prompt (no personal data in the repo).
- Japa tests: every role × ability from the matrix, scope filters, IDOR across scopes, self-change and last-owner guards.

## Done when

- [ ] Tests (own database `sigrak_test_r201`), lint, typecheck, format check pass
- [ ] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
