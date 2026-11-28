# R2-09 — Console pass: navigation, screenshot set, R2 checks

- **Phase:** R2
- **Status:** review
- **Owner:** r2/r2-09-console-pass
- **Depends on:** R2-01…R2-08
- **Can run in parallel with:** —

## Goal

Pull the R2 console together: grouped console navigation per role, a console home with what needs attention per role, consistent pages, and the screenshot set for the owner (D-475).

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R2-00-console-plan.md`, the R2-01 Result (abilities and scope helpers)
- `docs/final/design-system.md`, D-473, D-474, D-475; Results of R2-01…R2-08; `inertia/lib/navigation.ts`, console layout

## Output

- Console navigation filtered by the signed-in staff member's abilities, grouped (Sekolah, Konten, Bantuan, Kurikulum, Sistem, Tim).
- D-481: rename the "Hak akses" page to "Peran" (`/peran`, lang keys, nav label, the EYD exception added in R2-01 removed); make the trial-extension limit (`TRIAL_EXTEND_MAX_DAYS`, 14) an admin-editable `app_settings` value on the console settings page, logged.
- Console home: counts that need action per role (new help requests, problems to triage, versions waiting for sign-off, failed jobs).
- Carry-overs from the wave 2/3 Results: sticky first column on the Peran matrix; a 2FA column on the Staf list; names for `curriculum_version` (and other new subject types) on Log aktivitas; the teacher bottom-navigation labels that overlap at 360 px (R1-12 shell); Kesehatan sistem shows whether the cache Redis is reachable (warning, not outage) and warns when no mail is configured in production; hide "Coba lagi" for failed `ai` jobs if retrying cannot help.
- Fix inconsistencies found across R2 pages; axe check without serious issues; tap targets 44 px.
- Screenshot set of every console page at 360 and 1280 px, light and dark, in `docs/screenshots/r2/` with a README index (D-475).

## Done when

- [x] Tests (own database `sigrak_test_r209`), lint, typecheck, format check pass
- [x] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r2/r2-09-console-pass` (from `r2/r2-00-split` at 5b97dbe). Full suite 533 tests (525 before + 8 new), lint, both typechecks, `prettier --check .` and `node ace build` pass. No migration, no new dependency (`database/schema.ts` unchanged).

### Built

- **Console menu** (`inertia/lib/navigation.ts`): six groups in this order, filtered by `staffAbilities` as before: Sekolah (Sekolah, Pengguna, Direktori sekolah, Perubahan wilayah, Usulan wilayah, Kalender wilayah), Konten (Kabar, Acara, Cerita Sekolah, Halaman legal), Bantuan (Permintaan bantuan, Sesi bantuan, Bank Masalah, Forum Masalah→Solusi), Kurikulum (Kurikulum, Bank Praktik Baik), Sistem (Pengaturan, Integrasi, Model AI, Kesehatan sistem), Tim (Staf, Log aktivitas, Peran). Old section keys replaced by `nav.sections.console_*`.
- **Console home** (`app/staff/console_home.ts`, `admin/home`): "Perlu ditindaklanjuti" as a deferred prop with counts the viewer's roles act on, each linking to the filtered list: new help requests within the area scope (`help_requests.manage`), problems Baru (`problems.triage`) and Dipilah waiting for analysis (`problems.analyse`), curriculum drafts waiting for sign-off, not counting the viewer's own imports (`curriculum.signoff`), signed-off versions ready to publish (`curriculum.publish`), failed queue jobs (`system_health.view`). A count that cannot be read is left out and logged. Below it, the menu as grouped shortcuts.
- **D-481 Peran:** `/hak-akses` → `/peran` (no redirect: the console is not released), nav label, page title, ability label "Lihat halaman Peran", caption "Hak tiap peran"; the R2-01 EYD exception list in `tests/unit/translations.spec.ts` is empty again. `docs/final/product-concept.md` and `developer-handbook.md` say "Peran" (the PDF is not regenerated).
- **D-481 trial limit:** `app_settings` key `trial.extend_max_days` (default 14, range 1–365) in `app/accounts/settings.ts` (`trialExtendMaxDays`, `setTrialExtendMaxDays`, shared `writeSetting` with the default length); `authorizeTrialChange` and the school/user pages read it; second card on `/pengaturan`, POST `/pengaturan/batas-tambah-hari` (`settings.manage`), logged `setting.updated` {from, to}. `TRIAL_EXTEND_MAX_DAYS` is now `DEFAULT_TRIAL_EXTEND_MAX_DAYS`.
- **Carry-overs:** sticky first column on the Peran matrix (plus a fix: the matrix pushed the page sideways because its screen-reader spans escaped the scroller); 2FA column on Staf ("Aktif", "Belum aktif", "Wajib, belum aktif" in warn colour); Log aktivitas names problems ("BM-0042 …"), curriculum versions ("name (code)"), Kabar, Acara, Cerita Sekolah, Bank Praktik Baik, legal versions, forum dates, the school of a support session, help requests by number only, and keyed subjects (settings, integrations, AI purposes); teacher bottom navigation labels wrap to two lines at 11 px below 640 px instead of overlapping; Kesehatan sistem has a "Layanan pendukung" section (`app/system_health/services.ts`): cache Redis reachable or not with memory use (not reachable is a warning), mail source and whether mail is really sent (`mailDelivery()` in `app/integrations/mail.ts`; env `json` counts as not sending), warning only in production; failed jobs on the `ai` queue show no "Coba lagi" (`NOT_RETRYABLE_QUEUES`, the action refuses them too with a message) and only "Hapus".
- **Consistency and accessibility:** axe (WCAG 2.0/2.1 A and AA plus best practice) on every page of the set: no serious or critical issue left (fixed: definition lists on Kesehatan sistem, keyboard access to the Peran scroller, `aria-hidden-focus` with the account menu open by making it non-modal, empty actions header in `DataTable`, heading order on Kesehatan sistem). Only "region" (moderate, the open menu popover) remains. Tap targets measured at 360 px on 19 console pages: only the Halaman legal public links were under 44 px (fixed).
- **Demo data:** `database/demo/console_demo.ts`, called by the demo seeder in development only: eleven invented colleagues in every role (`@sigrak.test`), help requests and replies, Bank Masalah with an analysis and a forum agenda, Bank Praktik Baik, Kabar, Acara, Cerita Sekolah, a published legal version and an open support session, all through the real functions so Log aktivitas fills too.
- **Screenshots** (D-475): `docs/screenshots/r2/`, 48 pages × 4 = 192 PNGs, 18.2 MB after lossless optimisation, README with one table per area (Sign-in and 2FA, Home, Sekolah, Konten, Bantuan, Kurikulum, Sistem, Tim, App). App pages: Kabar, Minta bantuan, Bantuan saya, the account menu. No page scrolls sideways.
- **Tests:** `tests/functional/staff/console_pass.spec.ts` (home counts per role and deferred, help count by area scope, 2FA column, named log subjects, cache and mail checks); a D-481 test in `scope.spec.ts` (403 for Penjualan, admin change logged, new limit applies); AI retry refusal in `system_health.spec.ts`; `retryable` in the unit test.

### Deviations

- Bank Masalah and the forum sit under Bantuan, Bank Praktik Baik under Kurikulum: the task names six groups and the R2-07 group "Masalah dan solusi" is not one of them.
- No redirect from `/hak-akses`.
- The console home counts problems for every triage/analyse holder without the area limit (Bank Masalah reading is unscoped, R2-07); help requests follow the area scope.
- The AI "Coba lagi" is hidden for the whole `ai` queue (today it only holds generation steps).
- Shared files touched: `data_table.tsx`, `account_menu.tsx`, `bottom_nav.tsx`, `mail.ts`, the demo seeder.

### Open questions

- **Owner:** the role label is "Support" while some copy says "Dukungan" (R2-04, R2-05 Results). Which word should the console use?
- **Owner:** is a non-modal account menu fine (clicks outside close it; the page behind stays usable)?
- **Team:** the console home count queries run on every home visit (deferred); fine at today's volume, cache them if the home gets slow.
- **Team:** the screenshot and axe scripts live outside the repo (Playwright from the image, axe-core 4.10.3 in a scratch folder); a committed `scripts/screenshots/` would make retakes easier.

