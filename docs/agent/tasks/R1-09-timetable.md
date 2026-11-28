# R1-09 — Timetable and draft generator

- **Phase:** R1
- **Status:** todo
- **Owner:** —
- **Depends on:** R1-06
- **Can run in parallel with:** R1-08

## Goal

The operator builds each class's timetable within the allocation, and can generate a draft timetable that never breaks hard limits.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- Decisions D-247…D-251, D-262, D-381; `P5-03-foundation.md` P5-03e and P5-03j Results (rules only)

## Output

- Migrations (block `17643700xxxxx`): `timetable_slots`, `timetable_settings`, `timetable_drafts`.
- Operator Jadwal per class, teacher Kelas Saya > Jadwal, Susun Jadwal draft on the `default` queue (pure seeded generator; CPU-heavy runs may use the R1-10 pool).
- Property tests for hard limits; IDOR tests.

## Done when

- [ ] Tests (own test database `sigrak_test_r109`), lint and typecheck pass; IDOR test for every school-owned resource
- [ ] Pages checked at 360 and 1280 px where the task has UI; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
