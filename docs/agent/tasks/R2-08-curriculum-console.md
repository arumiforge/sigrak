# R2-08 — Curriculum console: compare, publish, roll back, impact

- **Phase:** R2
- **Status:** in-progress
- **Owner:** r2/r2-08-curriculum-console
- **Depends on:** R2-01
- **Can run in parallel with:** R2-02…R2-06

## Goal

Staff compare a draft curriculum version with the active one, publish it after a validator's sign-off, roll it back, and see which schools are affected (D-317). The JP audit on RPMs waits for R5 (no RPM table yet).

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R2-00-console-plan.md`, the R2-01 Result (abilities and scope helpers)
- Decisions D-113, D-229, D-317, D-339 (validator, content, curriculum roles), D-458; R1-03 Result (curriculum tables, `curriculum:import`, `PolicyProfileResolver`)

## Output

- Migration block `17645700xxxxx` if needed: version status (draft, signed_off, active, retired), sign-off record (validator, time, note; a validator never signs off their own import, D-339).
- Console pages: versions list, compare (added/removed/changed CP, TP, topics, JP per subject and grade), sign off, publish (curriculum role), roll back to the previous version, impact report (schools by level and region using that version; RPM counts come in R5).
- All changes logged; publish and rollback in one transaction with resolver cache invalidation.
- Tests: separation of duty, publish/rollback, compare output on fixture versions.

## Done when

- [ ] Tests (own database `sigrak_test_r208`), lint, typecheck, format check pass
- [ ] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
