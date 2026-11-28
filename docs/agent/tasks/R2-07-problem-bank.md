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

- [ ] Tests (own database `sigrak_test_r207`), lint, typecheck, format check pass
- [ ] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
