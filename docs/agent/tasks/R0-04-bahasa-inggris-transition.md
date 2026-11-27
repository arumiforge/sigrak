# R0-04 — Bahasa Inggris SD/MI follows Fondasi F-031

- **Phase:** R0
- **Status:** review
- **Owner:** R0-04 sub-agent (branch `r0/r0-04-bahasa-inggris-transition`)
- **Depends on:** R0-01
- **Can run in parallel with:** R0-02, R0-03 (not the same files), R0-05

## Goal

Apply D-410 (supersedes D-387): grades 3–6 elective by school readiness until 2026/2027, compulsory from 2027/2028; grades 1–2 optional.

## Read first

- D-387, D-410; Fondasi `data/mapel/` (Bahasa Inggris transition) and F-031
- `docs/data/regulations/curriculum-structure-permendikdasmen-13-2025.json`, `docs/data/curriculum/subjects.json`, `docs/data/profiles/`

## Output

- Data files above with the transition per academic year; docs that state D-387 (grep "Bahasa Inggris")

## Done when

- [x] 2026/2027 shows Bahasa Inggris as elective for grades 3–6, 2027/2028 as compulsory

## Result

Done 2026-11-27, following Fondasi `mapel` (`transition` + `compulsory_from` on the SD/MI kelas III–VI rows, F-031). SDLB/MILB rows are left as printed.

- `docs/data/curriculum/subjects.json`: new optional field `transition` (explained in `conventions`). BIG has `levels` sd/mi, `grades` 3–6, `periods` (`until_school_year` 2026/2027 `elective`, `condition: school_readiness`; `from_school_year` 2027/2028 `compulsory`), `grades_1_2: optional`, and `source` (Pasal 33 huruf a, D-410, F-031, D-204).
- `docs/data/regulations/curriculum-structure-permendikdasmen-13-2025.json`: the Bahasa Inggris rows of Tabel 3–5 and the `bahasa_inggris` rule now carry `elective_until` 2026/2027 and `compulsory_from` 2027/2028 (the key names the 12/2024 extract already uses), plus `transition_source` on the rows. `group` stays `required`, as printed.
- `docs/data/curriculum/mi-allocation-kma-1503-2025.json`: the same three fields on the MI Bahasa Inggris rows for grades III–IV, V, VI.
- `docs/data/regulations/curriculum-base-permendikbudristek-12-2024.json`: the Pasal 33 open point is marked `resolved` with `decision: D-410`.
- READMEs in `docs/data/curriculum`, `docs/data/regulations`, `docs/data/profiles` point to the new fields. The profiles do not repeat the transition; they point to `subjects.json`.
- Drafts: `policy-innovation-layers.md` (§5 table, §6.3), `open-questions.md` (D-387 marked superseded), `fondasi-uptake.md` (`mapel` row).
- Still open: the `docs/final/` wording (research-digest, developer-handbook, data-model) is applied by another task. The import and `SubjectsForGrade` have to read `transition`, so that in 2026/2027 a school can switch BIG grades 3–6 off, and from 2027/2028 it cannot.
