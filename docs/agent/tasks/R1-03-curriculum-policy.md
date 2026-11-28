# R1-03 — Curriculum tables, import, Profil Jenjang, policy-profile resolver

- **Phase:** R1
- **Status:** in-progress
- **Owner:** r1/r1-03-curriculum
- **Depends on:** R0 gate (D-468); school-owned tables (`school_subjects`) wait for R1-01's tenancy helpers
- **Can run in parallel with:** R1-01, R1-02, R1-10

## Goal

The SIGRAK curriculum data is in the database through an idempotent import, and code reads level rules only through one policy-profile resolver (never `if level == mi`).

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- `docs/data/curriculum/README.md` (format `SIGRAK-SD-2026-R1` / `SIGRAK-MI-2026-R1`), `docs/data/profiles/`
- `docs/final/data-model.md`: Curriculum
- Decisions D-354, D-355, D-356, D-363…D-366, D-378, D-452, D-458, D-464
- `docs/drafts/policy-innovation-layers.md` (resolver), `docs/drafts/regional-layers.md` §5 (the layer resolver runs after this one; keep the seam)
- `P5-03-foundation.md` P5-03c, P5-03k, P5-03l Results (rules only)

## Output

- Migrations (block `17643100xxxxx`): curriculum versions with `effective_on`, `applies_from_school_year`, `supersedes_id`; subjects, allocations (with art branch tracks and `jp_target_set_by`), topics, fokus, TP and links, official CP per element (D-452).
- `app/curriculum/`: `node ace curriculum:import [files] [--strict]`, idempotent by code, reporting mismatches (only `curated` subjects active for teachers, D-365); Profil Jenjang loaded from `docs/data/profiles/`; `PolicyProfileResolver` (school year, level, region), cached per school year; `SubjectsForGrade`.
- Tests: import twice changes nothing; mismatch report; resolver picks the right rule set by school year (CP 046/2025 from 2025/2026, D-458); Seni dan Budaya tracks including Tari/Teater without topics (D-464); KTB JP set by school.

## Done when

- [ ] Import runs on the repository data with the counts reported in Result
- [ ] Tests, lint and typecheck pass (test database `sigrak_test_r103`)
- [ ] Result filled

## Result
