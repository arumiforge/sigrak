# R1-02 — Indonesian copy base and translation checks

- **Phase:** R1
- **Status:** in-progress
- **Owner:** r1/r1-02-lang-id
- **Depends on:** R0 gate (D-468)
- **Can run in parallel with:** R1-01, R1-03, R1-10

## Goal

All UI text comes from `resources/lang/id`, written fresh from the design system and the owner's paraphrase sheet, with English keys and checks that keep it plain and complete.

## Read first

- `CLAUDE.md` (language policy), `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- `docs/final/design-system.md` (UI writing, words to avoid, status labels; D-445 values)
- `docs/sources/` paraphrase sheet `Parafrase_Teks_UI_Sigrak.xlsx` (find it with `find docs/sources -iname '*parafrase*'`)
- Decisions D-150, D-165, D-382, D-383, D-149
- Existing i18n: `config/i18n.ts`, `app/middleware/translations_middleware.ts`, `resources/lang/`
- Fondasi `bahasa-indonesia-plain` skill only if attached (`docs/agent/fondasi-check.md` §1); otherwise follow the design system

## Output

- Shared files `resources/lang/id/{common,validation,errors,nav,auth}.json` (keys in English, Indonesian values); module files stay with their tasks.
- Date, number and currency helpers for Indonesian formats (`d/m/Y`, `1.234.567,89`, `Rp`, `Asia/Jakarta`) shared to the frontend.
- Tests: every key used in `inertia/` and `app/` exists in `id`; banned words (for example "absensi", D-382) never appear in values; no hard-coded Indonesian strings in `.tsx` outside lang files (a lint rule or test).
- The level term helper (D-383: "Guru kelas" for SD, "Wali kelas" for MI) as a parameter, read from the profile once R1-03 lands (stub until then).

## Done when

- [ ] Tests, lint and typecheck pass (test database `sigrak_test_r102` if needed)
- [ ] Existing pages (login, calendar, AI demo, errors) read from the lang files
- [ ] Result filled

## Result
