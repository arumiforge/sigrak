# R1-02 — Indonesian copy base and translation checks

- **Phase:** R1
- **Status:** done
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

- [x] Tests, lint and typecheck pass (test database `sigrak_test_r102` if needed)
- [x] Existing pages (login, calendar, AI demo, errors) read from the lang files
- [x] Result filled

## Result

Branch `r1/r1-02-lang-id` (from the R1 split commit). Fondasi was not attached; copy follows `docs/final/design-system.md` and the "Semua halaman" and "Beranda & akun" rows of the paraphrase sheet.

- **Lang files** (`resources/lang/id/`): `common.json` (actions, status, labels, semesters, paper sizes, empty states, `terms.homeroom_teacher.{sd,mi}`), new `nav.json` (menus, moved out of `common.nav`), `errors.json` (error pages plus general, load, save, offline, page expired, session expired, import), `validation.json` (renamed from `validator.json`; VineJS messages for the common rules in SIGRAK's voice, field names) and `auth.json` (adds inactive account, other account, sign-out confirm, new-password labels). One AI demo value changed: "Gagal dulu, …" → "Belum berhasil, lalu berhasil saat dicoba lagi".
- **Sharing:** `common`, `nav` and `errors` go to every page (`SHARED_NAMESPACES` in `app/middleware/translations_middleware.ts`); `validation` is server-only and is filtered out even if a route asks for it. The VineJS messages provider reads `validation.*` (`detect_user_locale_middleware.ts`). The error page no longer sets its own namespace list.
- **Formats:** `app/services/i18n/format.ts`, one import-free module shared with the browser through `inertia/lib/format.ts`: `formatShortDate` (`25/11/2026`), `formatTime` (`14.30`, WIB), `formatDateTime`, `toJakartaDate`, `formatNumber` (`1.234.567,89`), `formatCurrency` (`Rp1.234.567`), and read-back `parseNumber` / `parseShortDate` for imports (D-150). The AI demo page now uses them for its clock and durations. The long-date calendar helpers in `inertia/lib/dates.ts` are unchanged.
- **Level terms (D-383):** `app/services/i18n/level_terms.ts` (`levelTermParams(t, source)`) and `inertia/lib/level_terms.ts` (`useLevelTerms(source)`) return `{ homeroom_teacher, homeroom_teacher_lower }` as message parameters. `source` is the level code (`'sd' | 'mi'`, stub) or a profile object `{ homeroomTeacherTerm }`; R1-03 passes the resolver's profile.
- **Checks:** `tests/unit/translations.spec.ts`: files parse and keys are English identifiers; values are finished copy (no empty, `...`, `&`, stacked `!`, emoji, `{{ }}`, unbalanced braces); banned words (design system) and old terms from the *Istilah* list (Download, Generate, Template, Password, Edit, Gagal, Instansi, …) never appear, with a per-key allow-list for later help-search text; every key used in `app/`, `start/` and `inertia/` exists (TypeScript AST: `t()`/`i18n.t()` arguments, key-shaped strings in `inertia/`, template prefixes); no hard-coded text in `inertia/**/*.tsx` (JSX text, text attributes such as `aria-label`/`title`/`placeholder`, `toast()` strings); each check has a self-test. `tests/unit/format.spec.ts` covers formats, parsers and level terms; `tests/functional/translations.spec.ts` checks shared messages on a page and Indonesian validation errors.
- **Shared files touched:** `eslint.config.js` (an `allowed` list for `@adonisjs/no-backend-import-in-frontend` with the two pure helper paths). Not touched: `start/kernel.ts`, `package.json`, `tests/bootstrap.ts`.
- **Verified:** `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, and `pnpm test` (70 tests, database `sigrak_test_r102`) pass; Vite production build passes. Login and calendar screenshots at 360 and 1280 px (Chromium, scale 1) show all text from the lang files, no raw keys, no horizontal scroll.

**Proposed decisions**

1. Money is written `Rp1.234.567` (no space, no decimals, PUEBI); negative `-Rp5.000`. Times use the Indonesian dot `14.30`, with "WIB" added in the copy where it matters.
2. `common`, `nav` and `errors` are shared with every page; `validation` never reaches the browser. There is no separate `terms` or `enums` file for now: standard terms live under `common.terms`, enum labels in their module file.
3. The old-term list in the test is part of the copy rules: Download, Generate, Template, Password, Username, Edit, Reset, Gagal, Instansi, Role, Dashboard, Tutorial, Cloud and the rest from the *Istilah* sheet fail CI in any `lang/id` value. "Kartu login" stays allowed, so "login" alone is not banned.
4. The no-hard-coded-text rule is a Japa test (TypeScript AST) rather than an ESLint rule; the brand name in the browser tab title (`inertia/app.tsx`) stays a literal.
5. Level-term copy uses the parameters `{homeroom_teacher}` (sentence start, labels) and `{homeroom_teacher_lower}` (mid-sentence).

**Open questions**

- Is `Rp1.234.567` (PUEBI) right, or does the owner prefer `Rp 1.234.567`? Fondasi was not attached to check its rule.
- Does the product name stay "SIGRAK" in UI copy until the D-462 wordmark choice? The paraphrase sheet writes "Sigrak".

