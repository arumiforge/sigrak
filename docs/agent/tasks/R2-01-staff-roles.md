# R2-01 — Staff roles, scopes, staff accounts, audit log, Hak akses

- **Phase:** R2
- **Status:** review
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

- [x] Tests (own database `sigrak_test_r201`), lint, typecheck, format check pass
- [x] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r2/r2-01-staff-roles` (from `r2/r2-00-split`). Full suite 393 tests (356 before + 37 new), lint, typecheck, `prettier --check .` and `node ace build` pass.

### Built

- **Migration** `1764500000001_create_staff_role_assignments_table`: `staff_role_assignments` (staff user, role, `region_ids bigint[]`, `school_ids bigint[]`, `levels text[]`, `fields text[]`, created by, unique per staff and role); existing `staff_users.role` rows moved over with an empty scope, then the column dropped; `staff_users.disabled_at`; `staff_password_tokens` (hashed set-password link, 7 days); `staff_activity_logs.subject_type` widened to every R2 subject (`staff`, `integration`, `ai_model`, `job`, `announcement`, `event`, `story`, `legal_document`, `help_request`, `support_session`, `problem`, `good_practice`, `forum_meeting`, `curriculum_version`) plus indexes on `created_at` and `action`, so wave 2 needs no migration for logging.
- **`app/staff/`** (`#staff/*`):
  - `roles.ts`: the 12 roles, `ROLE_SCOPES` (which scope parts each role uses; area `none` / `optional` / `required`), `HIGH_ROLES` (owner, admin), `SCOPE_LEVELS`, `SCOPE_FIELDS`.
  - `abilities.ts`: the one catalogue, grouped (see keys below).
  - `powers.ts`: role → abilities from §3 with D-340, D-341, D-439, D-477.
  - `access.ts`: `staffCan`, `abilitiesOf`, `grantsFor`, `schoolScopeOf` + `applySchoolScope(query, scope, alias)` for lists, `withinScope(staff, ability, schoolId)`, `withinScopeForUser`, `coversLevel`, `coversField`, `regionScopeOf` (for Kabar targets), `authorizeStaff(ctx, ability, schoolId?)`, `authorizeStaffForUser`, `currentStaff`. Roles are loaded once per request by the staff auth middleware; helpers throw if they are not loaded.
  - `staff_accounts.ts`: create (mails the set-password link), resend link, grant, change scope, revoke, disable/enable, `createFirstOwner`; guards and logging (`staff.*` actions) live here.
- `app/accounts/staff_access.ts` removed; schools, users, settings, layer and region access use abilities. School and user lists filter by area; school page and actions check scope (403 otherwise). Staff invitations (create, resend, cancel) are now logged too.
- **Pages** (R1-12 shell and patterns): `/staf` (list + "Tambah staf" dialog with role and scope), `/staf/{id}` (roles with scope summary, "Ubah cakupan" dialog with region/school search, levels and fields, "Cabut", "Tambah peran", disable/enable, "Kirim tautan kata sandi", recent changes), `/log-aktivitas` (filters staff, action, WIB dates; 50 per page), `/hak-akses` (matrix from code from 1024 px, one role at a time below), admin `/kata-sandi-baru/{token}`. Console menu items carry `ability` and are filtered by the shared prop `staffAbilities`; new "Tim" group.
- **First owner**: `node ace staff:create-owner [--name --email]`, or `STAFF_OWNER_NAME` / `STAFF_OWNER_EMAIL` / `STAFF_OWNER_PASSWORD`, or prompts; only while no active owner exists. The demo seeder's console account now holds `owner`.
- **Tests**: `tests/unit/staff_powers.spec.ts` (every role × every ability against a hand-written matrix, separation-of-duty invariants, scope rules); `tests/functional/staff/scope.spec.ts` (region by kabupaten/kecamatan/province, school list, optional vs required area, list filters, cross-scope 403 on page, invite and trial, trial-extension limit); `tests/functional/staff/staff_accounts.spec.ts` (create + link + sign-in, grant/scope/revoke logged, self-change, owner/admin only by an owner, last owner, disable ends the session, link resend, 403 for other roles, first owner, log filters, Hak akses).

### Ability keys (for R2-02…R2-09)

- team: `staff.view`, `staff.manage`, `staff.manage_high`, `staff.reset_2fa`, `audit.view`, `access.view`
- schools: `schools.view`, `schools.manage`, `users.view`, `invitations.manage`, `trials.manage`, `trials.extend`, `regions.review`, `layers.propose`, `layers.approve`
- business (R5): `subscriptions.view`, `subscriptions.manage`, `payments.view`, `payments.record`, `payments.confirm`, `invoices.manage`, `prices.view`, `prices.manage`
- content: `templates.view|prepare|signoff`, `catalogs.view|prepare|signoff`, `embeds.view|prepare|signoff|manage`
- curriculum (R2-08): `curriculum.view`, `curriculum.draft`, `curriculum.signoff`, `curriculum.publish`
- communication (R2-05): `announcements.manage`, `announcements.write`, `announcements.public`, `events.manage`, `stories.manage`, `legal_pages.manage`
- help (R2-06): `help_requests.view`, `help_requests.manage`, `support_sessions.start`, `support_sessions.view`, `supervisor_requests.manage`
- problems (R2-07): `problems.view|record|triage|analyse|deliver|decide`, `good_practices.view|manage`, `forum.view|manage`
- system (R2-03, R2-04): `settings.view|manage`, `integrations.view|manage`, `ai_models.view|manage`, `system_health.view|manage`, `reports.view`

### Team choices (deviations to review)

- Empty scope: `optional` roles (admin, support, validator) reach everywhere; `required` roles (sales, regional lead, marketing) reach nothing until an area is set. Only sales and regional lead may list single schools.
- Owner holds every ability except `payments.record` (D-340) and `support_sessions.start` (support's, matrix row "teachers' documents"); the owner can give themselves Support.
- Only an owner grants/removes owner or admin or changes an account holding one; admin manages the other ten roles.
- Settings page moved from "schools.view to see, trials.manage to change" to `settings.view` / `settings.manage` (owner, admin).
- `layers.approve` now goes to owner, admin, validator and regional lead (the roles regional-layers names); area scopes do not limit layer proposals/approvals yet.
- Staff passwords need 12 characters; new staff set their own via a mailed 7-day link (admin "Kirim tautan kata sandi" doubles as password reset).
- Role labels follow D-472 ("Penyusun konten", "Kurator kurikulum", "Koordinator wilayah"); official subject names were added to the EYD proper-name list; the "hak akses → Peran" term check has a keyed exception for the D-314 page name.
- `tests/unit/translations.spec.ts` ignores `ability: '…'` strings on menu items (they looked like lang keys).

### Open questions

- **Owner:** the "within a limit" trial extension for Penjualan/Koordinator wilayah is a provisional 14 days per action (`TRIAL_EXTEND_MAX_DAYS`). What limit do you want?
- **Owner:** the field (bidang) list is the §2 list plus Pendidikan Pancasila, Seni dan Budaya and PJOK. Is that right?
- **Owner:** keep the page name "Hak akses" (D-314) despite the design-system term "Peran"?
- **Team (R2-05):** curriculum notices only for Kurator kurikulum and maintenance notices only for Teknis need a kind check in R2-05; the keys give both `announcements.write` within scope.
- **Team (R2-09):** at 1280 px the matrix scrolls sideways inside its card (13 columns); consider a sticky first column.
- **Team:** should area scopes also limit layer proposals and approvals (Koordinator wilayah only for their regions)?

