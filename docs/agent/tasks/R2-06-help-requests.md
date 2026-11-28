# R2-06 — Minta Bantuan, help-request statuses, support sessions

- **Phase:** R2
- **Status:** review
- **Owner:** r2/r2-06-help-requests
- **Depends on:** R2-01
- **Can run in parallel with:** R2-02…R2-05, R2-08

## Goal

Users send Minta Bantuan from the app; staff handle them with the statuses Baru, Diproses, Selesai and the sender is told (D-320). Support opens a school's view read-only under the MoU, with one internal row per session (D-341).

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R2-00-console-plan.md`, the R2-01 Result (abilities and scope helpers)
- Decisions D-036, D-215, D-320, D-341, D-469, D-477; R1-01 Result (`sigrak_staff_readonly`, `staffReadTransaction`), `app/tenancy/`

## Output

- Migration block `17645500xxxxx`: `help_requests` (school, user, category, message, page URL, status, assignee), `help_request_notes` (staff notes and replies), `support_sessions` (staff, school, started_at, ended_at) — RLS so a school reads only its own requests.
- App: "Minta bantuan" in the account menu (form with category and message, attaches the current page), and "Bantuan saya" with status chips and replies.
- Console: list with filters (status, category, region within scope), detail with reply and status change (sender notified in the app; mail optional), assign to self.
- Support session: "Lihat sekolah ini" starts a read-only session on the read-only staff role, a banner shows it, religion and health fields hidden, "Akhiri" closes the row; sessions time out after 2 hours.
- A clear hook `helpRequestToProblem(id)` stub for R2-07 (one action, D-477).
- Tests: RLS/IDOR, statuses and notifications, read-only enforcement (writes fail), hidden fields, session rows.

## Done when

- [x] Tests (own database `sigrak_test_r206`), lint, typecheck, format check pass
- [x] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r2/r2-06-help-requests` (from `r2/r2-00-split`). Full suite 415 tests (393 before + 22 new), lint, both typechecks, `prettier --check .` and `node ace build` pass. Pages checked with Playwright at 360 and 1280 px (no horizontal overflow).

### Built

- **Migration** `1764550000001_create_help_requests_tables`: `help_requests` (public id, school nullable for teachers without a school, user, `membership_role`, `category`, `message` 10–2,000, `page_url` path only, `status` new/in_progress/done, `status_changed_at`, `assignee_staff_id`, `sender_unread_at`), `help_request_notes` (`reply` / `status` / `note`, `emailed`), `support_sessions` (staff, school, `started_at`, `ended_at`; partial unique index: one open session per staff member). RLS: requests follow the generations pattern (school rows, or own rows without a school); notes are readable by the app role only through their request and never when `kind = 'note'`, and only staff write them; support sessions match no row for the app role. Staff and read-only staff policies on all three tables; `help_request_notes` is added to the RLS coverage test's child tables.
- **`app/help/`** (`#help/*`): `catalog.ts` (categories, statuses, limits, `SUPPORT_SESSION_HOURS = 2`), `help_requests.ts` (send, own list, open + mark read, unread count; console scope check `staffReaches`, reply with optional status and mail, internal note, status change, assign to self; every change is logged as `help_request.*`), `support_sessions.ts` (start/end/time-out, read-only school view in `staffReadTransaction`, `withoutSensitiveFields`), `problem_hook.ts` (`helpRequestToProblem` stub + `PROBLEM_HOOK_READY = false`, with the contract for R2-07 written in its comment), `help_reply_mail.ts`, `shared_props.ts`, controllers, validators.
- **App** (`start/routes/help.ts`): `/minta-bantuan` (category + message; the current page arrives as `?halaman=` from the account menu and is cleaned to a same-site path), `/bantuan-saya` (status chips, "Ada kabar baru", reply count), `/bantuan-saya/{uuid}` (message, replies and status changes; opening it clears the unread mark). The account menu has "Minta bantuan" and "Bantuan saya" with a dot and an "n baru" count (shared prop `helpUnread`). Teachers without a school can send requests too.
- **Console**: `/bantuan` (filters for status, category, kabupaten/kota with requests inside the scope, and Petugas saya/kosong; open requests first), `/bantuan/{id}` (timeline, reply with "Status sesudah dibalas" and an optional email, status buttons, internal note, "Ambil permintaan ini", "Lihat sekolah ini"). View is `help_requests.view` and actions are `help_requests.manage`, both limited by area scope. A request without a school only reaches unlimited scopes.
- **Support sessions**: "Lihat sekolah ini" on `/sekolah/{id}` and on a request (`support_sessions.start` within scope) asks for confirmation, then opens a row and goes to `/lihat-sekolah`. That view shows the profile, members, school years, current classes with homeroom teacher and assignment count, and upcoming school events. It is read in a READ ONLY transaction as `sigrak_staff_readonly`, with religion and health keys removed. A banner on every console page (shared prop `supportSession`) has "Buka tampilan sekolah" and "Akhiri sesi". Expired sessions are closed lazily, with `ended_at = started_at + 2 h`, before any session is read or opened. Opening another school closes the open session first. `/sesi-bantuan` is the internal list (`support_sessions.view`). Start and end are logged (`support_session.*`), not page views.
- **Tests**: `tests/functional/help/rls.spec.ts` (IDOR app and SQL, internal notes hidden, no school writes of notes or moves, school-less requests, support sessions invisible, HTTP 404 for other users including a colleague), `help_requests.spec.ts` (send with page, validation and URL cleaning, school-less sender, reply + status + mail + logs + unread/read, status and assign, scope and region filter, view-only and no-access roles), `support_sessions.spec.ts` (one row per session, banner, end, switching schools, 2-hour time-out, database refuses writes in the view and for the role, no religion/health keys in props, who may start and list), `tests/unit/help.spec.ts`.

### Deviations from the task file

- **Notice to the sender:** D-320 says "the sender gets a Kabar". Kabar is R2-05's and is being built in parallel, so the notice is an in-app unread mark on the request, plus an optional mail per reply. It can be switched to a per-user Kabar once R2-05 lands.
- **The status select on a reply** defaults to Diproses for a new request, so replying moves it out of Baru in one step.
- **App URLs show no request number** (ids would leak volume). The console shows "Permintaan {id}".
- **No support-session table view is shown to schools** (D-341).
- **Touched shared files** (line-level): `package.json` (`#help/*`), `start/routes.ts`, `inertia/lib/navigation.ts` (new section "Bantuan"), `app/middleware/inertia_middleware.ts` (2 props), the account menu and both layouts, `icon.tsx` (help, support, school-view), `nav.json`, `validation.json`, `staff.json` (log action labels), the console school page and controller (`openSchool`, `supportSessionHours`), and the tests `guest_access.spec.ts` (sample param), `scope.spec.ts` (new `can` key) and `rls_coverage.spec.ts`.

### Missing ability keys

None. `help_requests.view|manage`, `support_sessions.start|view` and `problems.record` (for the R2-07 button) are all in the catalogue.

### Open questions

- **Owner:** the owner cannot open a school's view (R2-01 left `support_sessions.start` to Support only), but can give themselves the Support role. Keep it that way?
- **Owner:** are the categories right? Akun dan cara masuk; Data sekolah, kelas, dan jadwal; Perangkat ajar dan soal; Kunci AI; Ujian; Pembayaran; Lainnya.
- **Owner:** should the reply mail be sent always, never, or as now (staff tick it per reply)? It carries only a link, never the reply text.
- **Team (R2-05):** should the D-320 "Kabar" to the sender become a per-user Kabar that replaces `sender_unread_at`?
- **Team (R2-07):** fill `helpRequestToProblem` and flip `PROBLEM_HOOK_READY`; the console already passes `can.toProblem` (button not drawn yet). Also consider adding `help_requests.kind` (help/idea) for Kirim Masukan (plane-integration §2.1); it was left out here.
- **Team:** a user who switches school no longer sees requests sent from the other school (RLS follows the active school). Is that fine, or should `Bantuan saya` show all of a user's own requests across schools?
- **Team (R2-09):** the support view shows member emails like the existing console school page; confirm that is acceptable under the MoU.

