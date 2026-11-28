# R2-05 — Kabar, Acara, Cerita Sekolah and legal pages

- **Phase:** R2
- **Status:** todo
- **Owner:** —
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

- [ ] Tests (own database `sigrak_test_r205`), lint, typecheck, format check pass
- [ ] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
