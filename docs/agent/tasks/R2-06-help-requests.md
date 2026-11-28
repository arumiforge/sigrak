# R2-06 — Minta Bantuan, help-request statuses, support sessions

- **Phase:** R2
- **Status:** in-progress
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

- [ ] Tests (own database `sigrak_test_r206`), lint, typecheck, format check pass
- [ ] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
