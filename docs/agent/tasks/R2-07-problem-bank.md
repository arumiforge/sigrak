# R2-07 — Bank Masalah, Bank Praktik Baik, Forum Masalah→Solusi

- **Phase:** R2
- **Status:** in-progress
- **Owner:** r2/r2-07-problem-bank
- **Depends on:** R2-01, R2-06
- **Can run in parallel with:** R2-09 (start), after wave 2

## Goal

The D-439 problem-to-solution flow in the console: Tim Lapangan records and triages problems (by hand or from a help request, D-477), Tim Kurikulum & Riset adds root cause and regulation checks and keeps Bank Praktik Baik, Tim Produk decides in the fortnightly forum, and the reporter is told when it ships.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R2-00-console-plan.md`, the R2-01 Result (abilities and scope helpers)
- Decisions D-439, D-477, Fondasi F-034 only if attached; R2-06 Result (help requests)

## Output

- Migration block `17645600xxxxx`: `problems` (title, description, source: help request / field note / webinar / other, region, level, reporter, status: baru, dipilah, dianalisis, diputuskan, dikerjakan, rilis, ditutup), `problem_analyses` (root cause, regulations, evidence links, researcher credited), `forum_meetings` and `forum_decisions`, `good_practices` (title, summary, type: praktik, PTK, skripsi, seminar, webinar, authors credited, link).
- Console pages with abilities per team (D-439); "Jadikan masalah" on a help request; duplicate merge; forum agenda builder and decision record (owner decides).
- When a problem moves to rilis, the reporting user (help request) gets an app notice.
- Tests: status flow and who may move it, merge, credit, notice to the reporter.

## Done when

- [x] Tests (own database `sigrak_test_r207`), lint, typecheck, format check pass
- [x] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r2/r2-07-problem-bank` (from `r2/r2-00-split`). Full suite 524 tests (514 before + 10 new), lint, both typechecks, `prettier --check .` and `node ace build` pass. Pages checked with Playwright at 360 and 1280 px (no horizontal overflow).

### Built

- **Migration** `1764560000001_create_problem_bank_tables`: `problems` (title, description, source `help_request`/`field_note`/`webinar`/`other`, `region_id` kabupaten/kota, `level`, status `new`→`triaged`→`analysed`→`decided`→`in_progress`→`released`→`closed`, `merged_into_id`, `release_note`, `recorded_by_staff_id`), `problem_reports` (one row per linked help request, unique per request, `notified_at`), `problem_analyses` (root cause, regulations, `evidence_links text[]`, author, `credited_staff_ids bigint[]` + `credited_names text[]`, at least one credit), `forum_meetings` (date, planned/held, notes), `forum_decisions` (agenda item with position; outcome `go`/`decline`/`defer`, decided by/at), `good_practices` (title, summary, type practice/PTK/skripsi/seminar/webinar, `authors text[]` 1–10, http(s) link, level, year, optional problem). RLS on all six: the app role matches no row; staff and read-only staff policies.
- **`app/problems/`** (`#problems/*`): `catalog.ts` (statuses, sources, `TRANSITIONS` status → ability), `access.ts` (`reachesProblem`, `regenciesInScope`), `problems.ts` (record, edit, move, merge, analysis, `helpRequestToProblem`, reporter notice), `forum.ts` (plan, notes, agenda add/order/remove, decision, close), `good_practices.ts`, validators, three controllers. Every change logged (`problem.*`, `forum_meeting.*`, `good_practice.*`, `help_request.to_problem`, `help_request.problem_released`); labels in `staff.json`.
- **Who moves what:** triage (Tim Lapangan) Baru→Dipilah, close, reopen, edit, merge; analyse (Tim Kurikulum dan Riset) Dipilah→Dianalisis (needs at least one analysis) and back; Diputuskan and the forum's Ditutup only through a forum decision by `problems.decide` (owner), even the owner's status button refuses it; deliver (Tim Produk) Diputuskan→Dikerjakan→Rilis→Ditutup and back one step.
- **Scope:** reading Bank Masalah, Bank Praktik Baik and the forum is open to every role with the `.view` key (no area limit); record and triage follow the area scope (kabupaten/kota named, its province or a kecamatan inside it; a problem without region only for unlimited scopes); analysis follows the level scope. Reporters show school and role only; the help-request link shows only when the viewer reaches that request.
- **"Jadikan masalah"** (R2-06 hook): `app/help/problem_hook.ts` re-exports `helpRequestToProblem`, `PROBLEM_HOOK_READY = true`. New problem (title and description in staff's words, region and level from the school) or link to an open problem; request → Diproses plus a reply "sudah kami catat" (unread mark on Bantuan saya). The console request page shows the linked problem.
- **Notice on Rilis:** every reporter not told yet gets a reply on their help request (fixed text plus the optional staff-written release note), the request goes to Selesai, `notified_at` is set; moving back and releasing again tells nobody twice; a duplicate merged into an already released problem tells its moved reporters at once.
- **Console pages** (menu group "Masalah dan solusi"): `/bank-masalah` (status chips with counts, source and search incl. "BM-0042", "Catat masalah" dialog), `/bank-masalah/{id}` (description, reporters, analyses with credits and add form, forum history, related practices, next-step buttons with release note, edit, merge with confirmation), `/bank-praktik-baik` (cards, filter, add/edit/delete dialog), `/forum`, `/forum/{id}` (agenda builder with up/down/remove, owner decisions, notes, "Tandai forum selesai" only when every item is decided). Lang `resources/lang/id/problems.json`; icons problem, practice, forum, merge, chevron-up.
- **Tests:** `tests/functional/problems/problems.spec.ts` (10): Jadikan masalah + sender notice + no double link, link/closed refusal/engineer 403, full status flow per team with forum decision, release notice once with note, merge (reporters, agenda, late notice, refusals), credits (author default, staff + outside names, bad links, level scope), area scope (record options, 403s, region change refused, finance 403, search), forum agenda (order, only analysed, final decisions, close rule, locked after held), Bank Praktik Baik (authors, link check, view vs manage), RLS. `help_requests.spec.ts` and `tests/unit/help.spec.ts` updated for the live hook; `eyd.spec.ts` knows "Bank Masalah", "Bank Praktik Baik", "Forum Masalah→Solusi" as names.

### Deviations

- Statuses follow this task file (seven), not the ten Plane columns of `docs/drafts/plane-integration.md`; Plane sync, "Kirim ke papan", masking, not-pursued reasons and per-stage notices are not built (only Rilis notifies, as the task says).
- "Reporter" is the help-request sender through `problem_reports`; hand-recorded problems have no reporter rows, only `recorded_by_staff_id`. Notices go as a reply on the help request (the R2-06 in-app notice), not as a Kabar: Kabar has no per-user target.
- `help_requests.kind` (help/idea, Kirim Masukan) is **not** added: it needs its own app form, list chips and copy; left as a follow-up.
- Shared-file edits (line-level): `package.json` (`#problems/*`), `start/routes.ts`, `start/routes/help.ts` (route + `problems` namespace), `app/help/help_requests.ts` (`noticeToSender`), `app/help/controllers/console_help_requests_controller.ts`, `inertia/pages/console/help_request.tsx`, `inertia/lib/navigation.ts`, `icon.tsx`, `nav.json`, `staff.json`, `validation.json`, `tests/unit/eyd.spec.ts`.

### Missing ability keys

None. Possibly later: `problems.sync` (Plane resend) from the Plane draft.

### Open questions

- **Owner:** may scoped Tim Lapangan roles (sales, marketing, regional lead) read every problem in Bank Masalah (current), or only those in their area?
- **Owner:** should "Tidak dilanjutkan" from the forum tell the reporters (with a reason, as in the Plane draft)? Now only Rilis tells them.
- **Owner:** should the forum allow deciding problems that are only Dipilah (urgent cases), or only Dianalisis (current)?
- **Team (R2-09):** add the Bank Masalah pages to the screenshot set; the agenda has no drag-and-drop, only up/down buttons.
- **Team:** add `help_requests.kind` and Kirim Masukan (plane-integration §2.1) as a follow-up task; then problems from ideas get source `idea`.
- **Team:** a researcher list for credits takes staff holding validator, content, curriculum, researcher or owner; confirm that is the right list.

