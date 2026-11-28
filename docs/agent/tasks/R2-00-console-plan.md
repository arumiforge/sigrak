# R2-00 — Staff console plan and split

- **Phase:** R2
- **Status:** in-progress
- **Owner:** r2/r2-00-split
- **Depends on:** R1 (done, D-476)

## Goal

Build the staff console on `admin.` fresh on the phase R stack: the eleven staff roles plus Peneliti with editable scopes and powers fixed in code (D-338, D-339, D-439), staff 2FA (D-343), integration settings and AI models per purpose (D-431, D-315), Kesehatan Sistem (D-316), Kabar, Acara, Cerita Sekolah and legal pages (D-319, D-435, D-477), help requests and support sessions (D-320, D-341), Bank Masalah and Bank Praktik Baik (D-439, D-477), and the curriculum console (D-317).

Not in R2 (D-477): payment claims and confirmation, invoices, the sales pipeline (R5 business slice); pengawas requests for sekolah binaan (R5 with the portal); the product pages of `sigrak.com` (their own task with Codex visuals, D-390).

## Split and order

| Wave | ID | Task | Depends on |
|---|---|---|---|
| 1 | R2-01 | Staff roles, scopes, staff accounts, audit log, Hak akses | — |
| 2 | R2-02 | Staff 2FA with TOTP | R2-01 |
| 2 | R2-03 | Integration settings and AI models per purpose | R2-01 |
| 2 | R2-04 | Kesehatan Sistem page | R2-01 |
| 2 | R2-05 | Kabar, Acara, Cerita Sekolah, legal pages (console editor + app and public pages) | R2-01 |
| 2 | R2-06 | Minta Bantuan, help-request statuses, support sessions | R2-01 |
| 2 | R2-08 | Curriculum console: compare, publish, roll back, impact | R2-01 |
| 2 | R2-10 | Schools behind one IP, two Redis containers (D-479, D-480) | R2-01 |
| 3 | R2-07 | Bank Masalah, Bank Praktik Baik, Forum Masalah→Solusi | R2-01, R2-06 |
| 3 | R2-09 | Console pass: navigation, screenshot set, R2 checks | all above |

## Rules for parallel work (D-442)

- Module code under `app/<module>/`, routes in `start/routes/<module>.ts` (one import line in `start/routes.ts`), lang files `resources/lang/id/<module>.json`.
- R2-01 owns the staff ability catalogue (`app/staff/abilities.ts`) and defines every R2 ability key up front, so wave 2 tasks only use keys and never edit the catalogue (a missing key goes in the task Result for the integrator).
- Console menu: each task adds its items to `inertia/lib/navigation.ts` `consoleItems` with small line-level edits; the integrator resolves order.
- Migration timestamp blocks: R2-01 `17645000xxxxx`, R2-02 `17645100xxxxx`, R2-03 `17645200xxxxx`, R2-04 `17645300xxxxx`, R2-05 `17645400xxxxx`, R2-06 `17645500xxxxx`, R2-07 `17645600xxxxx`, R2-08 `17645700xxxxx`, R2-09 `17645800xxxxx`, R2-10 `17646000xxxxx`, follow-ups `17645900xxxxx`.
- Tests side by side: `DB_DATABASE=sigrak_test_<task>` (for example `sigrak_test_r201`), distinct `REDIS_QUEUE_DB`/`REDIS_AI_DB` and `PORT`; CI keeps `sigrak_test`.
- Every console page names the abilities that may use it; every staff change to school data or settings is logged (`staff_activity_logs`). Student data never shows in the console; religion and health data stay hidden (D-036, D-215, D-341).
- Console pages use the R1-12 shell and patterns (`inertia/components/patterns/`), copy follows EYD V (D-471, D-472), and are checked at 360 and 1280 px.

## Done when

- [ ] R2-01…R2-09 done and merged; CI green
- [ ] Owner reviews the console screenshot set (`docs/screenshots/r2/`, D-475)

## Result

Filled in as waves finish.
