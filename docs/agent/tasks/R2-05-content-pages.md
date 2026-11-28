# R2-05 — Kabar, Acara, Cerita Sekolah and legal pages

- **Phase:** R2
- **Status:** review
- **Owner:** r2/r2-05-content-pages
- **Depends on:** R2-01
- **Can run in parallel with:** R2-02…R2-04, R2-06, R2-08

## Goal

Staff write Kabar, Acara, Cerita Sekolah and the legal pages in the console (D-435). A Kabar is shown in the app with D-319 targets, on sigrak.com, or both (D-477). Legal pages carry a version and a "berlaku sejak" date.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R2-00-console-plan.md`, the R2-01 Result (abilities and scope helpers)
- Decisions D-149, D-319, D-389, D-435, D-471, D-472, D-477; `docs/final/product-concept.md` (Kabar), `docs/final/design-system.md`; the region tables from R1-04

## Output

- Migration block `17645400xxxxx`: `announcements` (Kabar: title, body, audience flags app/public, targets: kabupaten, kecamatan, level, roles, start/end), `announcement_reads` (per user), `events` (Acara: date, place or online link, registration link), `stories` (Cerita Sekolah: school name with its consent note, photos later), `legal_documents` (key, version, effective date, body; old versions kept).
- Safe rich text: Markdown stored, rendered with an allowlist sanitiser; draft/published states; preview.
- Console pages with abilities (marketing, support, curriculum, engineer Kabar within scope per §3; admin/owner all).
- App: Kabar list and unread badge in the shell header for the targeted users.
- Public (server-rendered, `sigrak.com` host): `/kabar`, `/kabar/{slug}`, `/acara`, `/cerita-sekolah`, `/syarat-penggunaan`, `/kebijakan-privasi`, `/perlindungan-data-murid` with version and date, using a simple public layout (the full marketing site is a later task).
- Tests: targeting rules, date windows, public vs app visibility, sanitiser, legal versioning.

## Done when

- [x] Tests (own database `sigrak_test_r205`), lint, typecheck, format check pass
- [x] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r2/r2-05-content-pages` (from `r2/r2-00-split`). Full suite 427 tests (393 before + 34 new), lint, both typechecks, `prettier --check .` and `node ace build` pass.

### Built

- **Migrations** `1764540000001…3`: `announcements` (title, slug, summary, Markdown body, `kind` general/event/curriculum/maintenance, draft/published, `show_in_app` / `show_public` with at least one, target arrays `target_region_ids` / `target_school_ids` / `target_levels` / `target_roles`, `starts_at` / `ends_at`, published and staff columns), `announcement_reads` (per user), `events` (date and time, place or online link required, registration link), `stories` (school name, required consent note and date; photos later), `legal_documents` (key, version, title, `effective_on`, change note, body; one draft per page; a trigger refuses any update or delete of a published row). No school_id anywhere, so no RLS.
- **`app/publishing/`** (`#publishing/*`): `markdown.ts` (own small renderer: escapes everything first, then an allowlist sanitiser of 14 tags, links only http(s)/mailto/same-site; shared with the editor preview through `inertia/lib/markdown.ts`), `announcement_rules.ts` (kinds per role, target fit per assignment), `announcement_feed.ts` (who sees what in the app and on sigrak.com, unread count, mark read), `announcements.ts`, `posts.ts` (Acara and Cerita Sekolah), `legal.ts` (draft, publish, discard, current and upcoming version), controllers, validators. Every change is logged (`announcement.*`, `event.*`, `story.*`, `legal_document.*`).
- **Kabar rules:** `announcements.manage` everything; `announcements.write` only app Kabar whose kind the role may write and whose targets lie inside one granting assignment's scope (area roles never target all schools; level-scoped curators must target their levels); `announcements.public` for sigrak.com (public Kabar have no targets). Kurator kurikulum: curriculum only; Teknis: maintenance only; other writers: general and event. Console list, edit and actions show and allow only Kabar the staff member may hold; the target search only offers places inside the scope.
- **Targeting (app):** a Kabar reaches a user when one of their places (active membership: role, school, level, kabupaten, kecamatan, province; approved pengawas assignment as role `supervisor`) matches every target; a teacher without a school only gets Kabar without region, school or level targets that include teachers. Window: from `starts_at` (or publish) until `ends_at`; it applies on sigrak.com too.
- **Console pages** (R1-12 shell and patterns, menu group "Komunikasi"): `/kabar`, `/kabar/baru`, `/kabar/{id}`, `/acara…`, `/cerita-sekolah…`, `/halaman-legal`, `/halaman-legal/versi/{id}`. Markdown editor with Tulis/Pratinjau tabs on phones and side by side from 1024 px; publish, save, take back, remove draft with confirmations.
- **App:** `/kabar`, `/kabar/{slug}` (opening marks read), "Tandai semua sudah dibaca"; bell with unread badge in the app header (shared prop `kabarUnread`, one count query per app page).
- **Public (bare domain, `publicHost` in `config/hosts.ts`):** Edge views in `resources/views/public/` with a simple layout: `/kabar`, `/kabar/{slug}`, `/acara`, `/acara/{slug}`, `/cerita-sekolah`, `/cerita-sekolah/{slug}`, `/syarat-penggunaan`, `/kebijakan-privasi`, `/perlindungan-data-murid` (version, "berlaku sejak", next version note, older versions at `?versi=N`). No session, no cookie, `Cache-Control: public, max-age=300`; `app/middleware/shield_middleware.ts` runs Shield without CSRF on that host only (Shield's CSRF needs a session). `inertia/css/app.css` is a second Vite entry for these pages.
- **Legal bodies:** short placeholder drafts in `publishing.legal.placeholders.*`, each opening with "Draf, perlu ditinjau ahli hukum" and "[Akan dilengkapi.]" sections; no binding terms (D-435).
- **Tests:** `tests/unit/publishing_markdown.spec.ts` (renderer, XSS cases, sanitiser, slugs), `tests/functional/publishing/announcements.spec.ts` (targets, pengawas, lone teacher, windows, public vs app, unread, role/kind/scope rules, editor flow and log, scope-limited list and search), `tests/functional/publishing/pages.spec.ts` (public pages and their cookies/headers, events, stories, legal versioning and the trigger, access).
- Pages checked with Playwright at 360 and 1280 px (console, app, public): no horizontal scroll.

### Deviations

- Kabar targets also take named schools (`target_school_ids`), so Penjualan ("own schools", internal-roles §3) can write to the schools in its scope.
- Markdown renderer written in-house (no new dependency): a fixed small subset, escape-first plus allowlist.
- Acara and Cerita Sekolah also get public detail pages (`/acara/{slug}`, `/cerita-sekolah/{slug}`).
- Shared-file edits: `config/hosts.ts` (`publicHost`), `start/kernel.ts` (Shield wrapper), `inertia_middleware.ts` (`kabarUnread`, `share` is now async), `app_layout.tsx` (bell), `icon.tsx` (news, event, story, legal, notification, external), `navigation.ts`, `nav.json`, `validation.json` (field labels), `vite.config.ts`, `eslint.config.js` (markdown allowed in the browser), `schema_rules.ts`, `package.json` (`#publishing/*`), `tests/unit/eyd.spec.ts` ("Cerita Sekolah" and "Kabar" as feature names).

### Missing ability keys

None. The console menu item for Kabar uses `announcements.write` (owner and admin hold it too).

### Open questions

- **Owner:** may Dukungan, Pemasaran, Penjualan and Koordinator wilayah write only general and event Kabar (current choice), or also curriculum or maintenance notices?
- **Owner:** should an ended Kabar disappear from sigrak.com/kabar (current) or stay in the public archive?
- **Owner:** the legal pages need real text and a lawyer's review before launch; who writes them, and should schools accept a version in the app (an acceptance record per version is not built)?
- **Team (R2-09):** the public layout is a placeholder for the marketing-site task; the bottom navigation labels overlap at 360 px on the teacher's app shell (seen on screenshots, existing R1-12 shell, not changed here).
- **Team:** the Better Stack status link in the public footer waits for the status page URL (D-426).

