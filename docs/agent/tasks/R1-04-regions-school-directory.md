# R1-04 — Regions and school directory (NPSN → region)

- **Phase:** R1
- **Status:** todo
- **Owner:** —
- **Depends on:** R1-01
- **Can run in parallel with:** R1-05

## Goal

Regions form a province → kabupaten/kota → kecamatan tree keyed by Kemendagri codes with the Kemendikdasmen/Dapodik codes alongside; a school's region comes from its NPSN directory entry, and region changes go through staff review (D-456, D-466).

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- `docs/drafts/regional-layers.md` §2, §8; decisions D-169, D-170, D-377, D-456, D-466
- `docs/data/schools/`, `scripts/school-directory/`, `P5-03-foundation.md` P5-03f Result (rules only)

## Output

- Migrations (block `17643200xxxxx`): region tree with both code sets; `school_directory_entries`; region change review rows.
- `app/regions/`: directory import command (idempotent), NPSN lookup filling the school form, region change queue (accept from tomorrow or next school year).
- Seed for Jawa Tengah (Kudus, Jepara, Pati) from the repository data; tests.

## Done when

- [ ] Tests (own test database `sigrak_test_r104`), lint and typecheck pass; IDOR test for every school-owned resource
- [ ] Pages checked at 360 and 1280 px where the task has UI; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
