# R1-03 — Curriculum tables, import, Profil Jenjang, policy-profile resolver

- **Phase:** R1
- **Status:** review
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

- [x] Import runs on the repository data with the counts reported in Result
- [x] Tests, lint and typecheck pass (test database `sigrak_test_r103`)
- [x] Result filled

## Result

Branch `r1/r1-03-curriculum` (from `r1/r1-00-gate-split`).

**Built (global tables only).**

- Migrations `1764310000001`…`1764310000009`: `curriculum_versions` (`kind` ∈ structure/cp/topics, `status`, `effective_on`, `applies_from_school_year`, `supersedes_id`, `meta.files`), `subjects` (adds `aliases`, `offered_grades`, `delivery`, `sort_order`), `subject_allocations` (structure rows and SIGRAK semester targets; `art_branch`, `status`, `jp_target_set_by`, `jp_per_year`, `basis`, `meta`; `UNIQUE NULLS NOT DISTINCT (version, subject, grade, learning_type, art_branch)`), `learning_outcome_elements` (CP elements per CP set, `linked_version_code` for PAI), `learning_outcomes` (adds `element_code`, `art_branch`), `topics` (adds `art_branch`), `learning_objectives`, `focus_items`, `focus_item_objectives`. All fixed sets have `CHECK`s mirrored in `app/curriculum/types.ts`.
- `node ace curriculum:import [files…] [--strict] [--verbose]` (`commands/curriculum_import.ts`, `app/curriculum/import/`): default file order in `app/curriculum/data_files.ts`; one transaction per file; rows matched by code (allocations by the unique row key) with `INSERT … ON CONFLICT DO UPDATE … WHERE (old) IS DISTINCT FROM (new)`, so unchanged rows keep `updated_at`; rows missing from a file are kept and reported; fokus–TP links synced only for fokus that list `objective_codes`; a new version is `draft` and an existing version keeps its name and status; the Profil Jenjang dates are copied onto every version after the files; the legacy format and the crosswalk are refused. Mismatch kinds: `phase_grade`, `phase_grades`, `semester_jp_short`/`semester_jp_over` (skipped for `jp_target_set_by: school`), `topic_without_allocation`, `topic_past_semester`, `weekly_distribution_weeks`/`_jp`, `fokus_jp`, `fokus_link_outside_topic`, `topic_element_unknown`, `cp_element_unknown`/`_phase`, `allocation_differs_from_structure`, `allocation_not_in_structure`, `local_content_cap`, `code_prefix`, `jp_per_week_*`, `semester_split_fraction`, `profile_dates_conflict`. Notes: `allocation_without_topics` (Tari/Teater, D-464), `no_cp_in_phase`, `region_defaults_not_imported`, and others.
- `app/curriculum/policy/level_profiles.ts` (reads `docs/data/profiles/*.json`), `PolicyProfileResolver` (school year, level, province; per-domain lines joined by `supersedes`; cached per school year), `SubjectsForGrade.forLevel()` (national list: structure subjects with D-410 transition status, SIGRAK optional and local content, Seni dan Budaya tracks with `hasTopics`), `CurriculumVersion.curatedSubjectCodes()` (D-364).
- Tests `tests/functional/curriculum/` (14 tests): import twice changes nothing (with counts), version status and dates, SB tracks (24 short rows, 12 Tari/Teater notes), KTB set by school, structure split, changed row and kept rows, mismatch report and `--strict`, legacy/crosswalk/unknown subject refused, resolver by school year (CP 046/2025 from 2025/2026), MI from data, lines/province/retired, cache, grade subjects. Full suite: 62 passed on `sigrak_test_r103`; lint, typecheck and format check pass.

**Import on the repository data** (fresh scratch database `sigrak_scratch_r103`, run twice):

| Table | Run 1 created | Run 2 |
|---|---|---|
| `curriculum_versions` | 7 (all `draft`) | unchanged |
| `subjects` | 22 | unchanged |
| `subject_allocations` | 372 (SD structure 146, MI 86, SIGRAK-SD 82 + 30, SIGRAK-MI 28) | unchanged |
| `learning_outcome_elements` | 53 (48 + 5 PAI) | unchanged |
| `learning_outcomes` | 334 (046: 135, BKPDM 020: 100, 9941: 99) | unchanged |
| `topics` | 956 (432 + 300 + 224) | unchanged |
| `learning_objectives` | 2,695 | unchanged |
| `focus_items` | 4,069 | unchanged |
| `focus_item_objectives` | 2,048 | unchanged |

Run 1: 10,557 rows written; run 2: 0 rows written, 0 kept rows. Both runs report the same 24 mismatches, all `semester_jp_short` for Seni Musik and Seni Rupa per grade and semester (the old split, D-464, P4-30), and 12 notes for the Tari and Teater tracks without topics. Tata Boga reports nothing (D-458). `--strict` on the repository data therefore stops at `sigrak-sd-2026-r1-umum.json`. Versions after the import: `CP-UMUM-SD-BSKAP-046-2025` 2025-07-16 / 2025/2026, `STRUKTUR-SD-PERMENDIKDASMEN-13-2025` 2025-07-15 / 2025/2026, `CP-PABP-BKPDM-020-2026` 2026-06-11 / 2026/2027, `ALOKASI-MI-KMA-1503-2025` 2025-09-22 / 2026/2027, `CP-PAI-BA-MADRASAH-9941-2025` 2025-11-28 / 2026/2027, `SIGRAK-SD-2026-R1` and `SIGRAK-MI-2026-R1` null / 2026/2027.

**Shared files touched:** `database/schema.ts` (generated by `migration:run`; on a merge conflict, regenerate it by running the migrations). Not touched: `adonisrc.ts` (commands are discovered from `commands/`), `package.json` (module code uses relative imports, no `#curriculum/*` alias), `tests/helpers.ts`, `database/schema_rules.ts`.

**Design for the school-owned tables (after R1-01 merges).**

- `school_subjects`: `school_id` (FK CASCADE, RLS policy from R1-01's helper, composite indexes start with it), `subject_id` (FK RESTRICT), `grade` smallint nullable (NULL = every grade), `art_branch` nullable (the branch the school picks; per class later in `classes`, D-458), `delivery` nullable ∈ {subject, cocurricular} (KKA, D-452), `enabled` bool, `in_report` bool (D-204), `jp_per_week` smallint nullable (school-set JP where `jp_target_set_by = school`, Tata Boga, D-458), timestamps; `UNIQUE NULLS NOT DISTINCT (school_id, subject_id, grade)` instead of the old generated `grade_key`. A compulsory subject cannot be switched off (CHECK in the action, D-230). IDOR test per R1-00.
- `region_subjects` is not built: RS-18/D-466 renames it `local_content_items` in the layer model (R1-07, regional-layers §5.6). `subjects.json` `region_defaults` (Kudus → BJW) waits for it.
- `SubjectsForGrade.forSchool(school, grade, schoolYear)` then applies, in order: `forLevel()` → the layer resolver's local content for the school → `school_subjects` (a grade row wins over the every-grade row).

**Proposed decisions.**

1. `curriculum_versions.kind` ∈ {structure, cp, topics} so the resolver and import can tell sets apart; `name` is text from the creating file.
2. `subject_allocations` holds both the official yearly structure rows and the SIGRAK semester targets, told apart by the version; adds `art_branch` (English codes music, visual_art, dance, theatre), `status` (compulsory/optional/elective), `jp_target_set_by` (curriculum/school), `jp_per_year`, `basis`, `meta`. Structure rows split yearly JP 18 weeks + the rest (D-229).
3. `learning_outcome_elements` table for the official CP elements (D-452); `learning_outcomes.element_code` links rows to it; PAI elements live in the 046 set with `linked_version_code = CP-PABP-BKPDM-020-2026`, and the PAI CP rows get their element code by name.
4. `topics.art_branch` as a column (copied from `extras.art_branch`), since a class's topics are filtered by branch; `sub_element` of religion and MI topics goes to `extras.sub_element` as the data model says.
5. Religion and MI CP rows have no codes in the data: code `<version>-<subject>-<phase>-<nn>`, with nn the row's printed place in the phase (rows with no CP keep their number), so codes stay stable when a missing row is filled.
6. Rule sets in one profile domain are separate lines unless joined by `supersedes` (new optional profile key) or `curriculum_versions.supersedes_id`; per line the resolver applies D-378 (started and not retired, province first, else earliest with `inForce: false`). Needed because the `cp` domain lists the general CP and the religion CP side by side. Before the first profile version starts, the first version is used (`profile.inForce: false`).
7. Resolver cache is in-process, per school year, with a 10-minute lifetime and cleared by every import in the same process (an import runs in a CLI process, so web and worker processes pick it up within 10 minutes or on restart). No Redis dependency.
8. `SubjectsForGrade` statuses: compulsory, elective (D-452, D-410 transition), optional (SIGRAK content off by default, including Tata Boga), local_content (muatan lokal waiting for the region or school); `subjects.kind` is kept alongside.
9. Fokus–TP links removed to match a file that lists `objective_codes` are deleted (link rows only), as D-229 "synced" implies; topics, TP and fokus are never deleted.

**Open questions.**

1. Production image: the resolver and import read `docs/data/profiles/` and `docs/data/curriculum/` at runtime; R3's Dockerfile must ship these folders (or P5-09 moves profiles to a table).
2. `sigrak-sd-2026-r1-umum.json` has no `objective_codes` on its 2,021 fokus, so the general SD subjects and PAI have no fokus–TP links (the religion and MI files have them). A data task should add them (data model: `focus_item_objectives`).
3. MI classes get no Seni dan Budaya branch tracks or general-subject topics: `PROFIL-MI-2026` lists only `SIGRAK-MI-2026-R1` (Kemenag subjects) under `tp_atp_defaults`. Should the MI profile also list `SIGRAK-SD-2026-R1` for its general subjects?
4. The religion CP sets other than PAI have no element codes in the data, so their topics cannot link to elements; add codes in a data task if Cek Keselarasan needs them.
5. The `--strict` run on the repository data fails until P4-30 rescales the Musik/Rupa JP. Should CI run the import with `--strict` once that is done?
