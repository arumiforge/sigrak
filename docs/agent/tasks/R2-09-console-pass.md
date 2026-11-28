# R2-09 — Console pass: navigation, screenshot set, R2 checks

- **Phase:** R2
- **Status:** todo
- **Owner:** —
- **Depends on:** R2-01…R2-08
- **Can run in parallel with:** —

## Goal

Pull the R2 console together: grouped console navigation per role, a console home with what needs attention per role, consistent pages, and the screenshot set for the owner (D-475).

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R2-00-console-plan.md`, the R2-01 Result (abilities and scope helpers)
- `docs/final/design-system.md`, D-473, D-474, D-475; Results of R2-01…R2-08; `inertia/lib/navigation.ts`, console layout

## Output

- Console navigation filtered by the signed-in staff member's abilities, grouped (Sekolah, Konten, Bantuan, Kurikulum, Sistem, Tim).
- Console home: counts that need action per role (new help requests, problems to triage, versions waiting for sign-off, failed jobs).
- Fix inconsistencies found across R2 pages; axe check without serious issues; tap targets 44 px.
- Screenshot set of every console page at 360 and 1280 px, light and dark, in `docs/screenshots/r2/` with a README index (D-475).

## Done when

- [ ] Tests (own database `sigrak_test_r209`), lint, typecheck, format check pass
- [ ] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
