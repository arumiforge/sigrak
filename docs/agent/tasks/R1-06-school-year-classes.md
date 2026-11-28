# R1-06 — Academic year, classes, teaching assignments, copy classes

- **Phase:** R1
- **Status:** in-progress
- **Owner:** r1/r1-06-school-year
- **Depends on:** R1-03, R1-05
- **Can run in parallel with:** R1-08 (after its layer part), R1-09

## Goal

The operator sets up the school year, classes and teaching assignments, with defaults from the curriculum and copying classes into a new year.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- `docs/final/data-model.md` (school year); decisions D-032, D-240…D-246, D-383, D-464 (art branch per class)
- `P5-03-foundation.md` P5-03d and P5-03h Results (rules only)

## Output

- Migrations (block `17643400xxxxx`): `academic_years`, `classes` (with the chosen Seni dan Budaya branch), `teaching_assignments`.
- Operator pages Tahun Ajaran and Kelas (`/tahun-ajaran`, `/kelas`), copy classes one grade up, default assignments from `SubjectsForGrade`.
- Tests as listed in the old P5-03d/h Results, rewritten for Japa.

## Done when

- [ ] Tests (own test database `sigrak_test_r106`), lint and typecheck pass; IDOR test for every school-owned resource
- [ ] Pages checked at 360 and 1280 px where the task has UI; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
