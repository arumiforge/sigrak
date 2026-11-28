# Curriculum data

Curriculum source files for the curriculum importer (the import command and load order are set up again in the new app, R0-05/R4). The data model is in [`docs/final/data-model.md`](../../final/data-model.md) (Curriculum).

| File                                                                                               | Version code                   | What it holds                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`subjects.json`](subjects.json)                                                                   | —                              | Subject catalogue: codes, names, aliases (D-227); `transition` for a subject phased in by school year (Bahasa Inggris SD/MI grades 3–6: elective by school readiness until 2026/2027, compulsory from 2027/2028, D-410); `kind: elective` with `grades` and `delivery` for Koding dan KA (D-452) |
| [`cp-umum-sd-bskap-046-2025.json`](cp-umum-sd-bskap-046-2025.json)                                 | `CP-UMUM-SD-BSKAP-046-2025`    | Official CP, Fase A–C, of the general SD subjects with a national CP (Kepka BSKAP 046/H/KR/2025), per subject, phase and element; element codes for PAI (D-452)                                                                                                                                  |
| [`cp-pendidikan-agama-sd-bkpdm-020-2026.json`](cp-pendidikan-agama-sd-bkpdm-020-2026.json)         | `CP-PABP-BKPDM-020-2026`       | CP for the six SD religion subjects                                                                                                                                                                                                                                                              |
| [`cp-pai-bahasa-arab-mi-sk-dirjen-9941-2025.json`](cp-pai-bahasa-arab-mi-sk-dirjen-9941-2025.json) | `CP-PAI-BA-MADRASAH-9941-2025` | CP for MI's Kemenag subjects                                                                                                                                                                                                                                                                     |
| [`mi-allocation-kma-1503-2025.json`](mi-allocation-kma-1503-2025.json)                             | `ALOKASI-MI-KMA-1503-2025`     | MI JP allocation                                                                                                                                                                                                                                                                                 |
| [`sigrak-sd-2026-r1-umum.json`](sigrak-sd-2026-r1-umum.json)                                       | `SIGRAK-SD-2026-R1`            | General SD subjects, PAI, muatan lokal, KKA (elective subject for grades 5–6, D-452): topics, TP, ATP, fokus, JP                                                                                                                                                                                 |
| [`sigrak-sd-2026-r1-agama.json`](sigrak-sd-2026-r1-agama.json)                                     | `SIGRAK-SD-2026-R1`            | The five other SD religions: topics, TP, ATP, fokus, JP                                                                                                                                                                                                                                          |
| [`sigrak-mi-2026-r1.json`](sigrak-mi-2026-r1.json)                                                 | `SIGRAK-MI-2026-R1`            | The five MI Kemenag subjects: topics, TP, ATP, fokus, JP                                                                                                                                                                                                                                         |
| [`crosswalk-legacy-2026.json`](crosswalk-legacy-2026.json)                                         | —                              | Team only, **never imported**: old codes → SIGRAK codes (D-365)                                                                                                                                                                                                                                  |

The SD allocation comes from the official structure, `docs/data/regulations/curriculum-structure-permendikdasmen-13-2025.json` (`STRUKTUR-SD-PERMENDIKDASMEN-13-2025`, D-366).

## SIGRAK R1 dataset

One format for all topics (D-363): the data model's own shape (D-140), one version per level and year. Codes: topic `SIGRAK-SD-2026-R1-PP-K1-01`, TP `…-TP01`, fokus `…-FM01`, ATP `ATP-<subject>-K<grade>-BAB-<nn>`. Each subject has its semester JP targets in `allocations` (the topics are checked against them at import) and a `curation` block. Two exceptions (D-458): Seni dan Budaya has one allocation row per grade and art branch (`art_branch`), because a pupil takes one branch for the whole allocation and the school picks the branch per class, so topics are checked against their own branch's row (joined by `extras.art_branch`); a row with `jp_target_set_by: "school"` (Tata Boga) is no target at all, only a SIGRAK suggestion, and the school sets the JP. Each topic may have `references`, `curation_notes`, and `extras` (art branch, science process skills, subject status, learning type, ATP details).

Provenance: converted on 2026-11-09 by [`scripts/curriculum/convert_legacy_topics.py`](../../../scripts/curriculum/convert_legacy_topics.py) from the legacy app curriculum data (general SD subjects and PAI) and the two earlier SIGRAK religion drafts (D-139…D-141, D-145, D-146). The input files were removed afterwards; they are in the git history before this change. During conversion the D-234 Tata Boga trim went into the data, and notes that named the dropped files or the legacy app's internals were reworded.

| File                           | Topics | TP    | Fokus | sha256                                                             |
| ------------------------------ | ------ | ----- | ----- | ------------------------------------------------------------------ |
| `sigrak-sd-2026-r1-umum.json`  | 432    | 1,372 | 2,021 | `7a8b136dc4d3d1005753e64bba7dbdcdea6a084bd30774e7f3d0ea8d74075e57` |
| `sigrak-sd-2026-r1-agama.json` | 300    | 765   | 1,060 | `08dae829104e7ef2b9b5a431d75b51453ea95fdeb5fc2042e0b207e1a1a6141b` |
| `sigrak-mi-2026-r1.json`       | 224    | 558   | 988   | `4d6371c40c557300cca66c689211223deb49fcb759067b83171f9d627f787408` |
| `crosswalk-legacy-2026.json`   | 956    | 2,695 | 4,069 | `3bd23ab67bba5fde511fa77cef6c74b590dd21d92535bccaca82d3028ccbf4eb` |

## Official CP and the general-subject topics (D-452)

`cp-umum-sd-bskap-046-2025.json` holds the official CP of Kepka BSKAP 046/H/KR/2025, Lampiran II, Fase A–C, for PP, Bahasa Indonesia, Matematika, Bahasa Inggris (Fase B–C), IPAS (Fase B–C), PJOK, Koding dan KA (Fase C), and Seni Musik, Seni Rupa, Seni Tari and Seni Teater (Tari and Teater have no topics yet). Kepka BKPDM 020/2026 amends only the religion CP, so the text is current. The shape follows `learning_outcomes` (D-226):

- `subjects[]`: `cp_key` (subject code, or `SB-MUS`, `SB-RUPA`, `SB-TARI`, `SB-TEATER` for the arts), `subject_code`, `subject_name`, `decree_section`, `pages`, `elements[]` (`code` `<cp_key>-E<n>`, `name`, optional `name_en`, `phases`), `phases[]` (`phase`, `grades`, `heading`, `lead_in`, `pages`, `summary` null, `outcomes[]`).
- `outcomes[]`: `code` (`<version>-<cp_key>-<phase>-<nn>`), `order`, `element_code`, `element`, `sub_element`, `decree_number`, `pages`, `text` (verbatim, "murid"); optional `translation_en` (Bahasa Inggris), `element_intro` (IPAS Keterampilan Proses rows), `heading_as_printed`, `figure_note`.
- `linked_sets[]`: PAI's element codes `PAI-E1`…`PAI-E5`; the text stays in `cp-pendidikan-agama-sd-bkpdm-020-2026.json` (`religions[key=islam]`, found by phase and element name).
- `extraction.conventions` and `extraction.source_anomalies` record how the text was copied and the decree's own slips (kept as printed).

Counts: 11 decree subjects, 48 elements, 135 outcome rows, plus 5 linked PAI elements. Procedure: `pdftotext -layout` of the PDF, parsed per heading (phase, `n.m.` element, bullet sub-element), with doubtful places checked against the rendered page; every stored text was matched word for word against the decree section text.

Schema change in `sigrak-sd-2026-r1-umum.json` (2026-11-28, RS-17, recorded in its `schema_changes`):

- `topics[].cp_text` is renamed `cp_summary`, same text. It is the teacher-friendly "Ringkasan SIGRAK" (`field_labels`), never shown as the official CP. An importer that still reads `cp_text` must read `cp_summary`. The religion and MI topic files still use `cp_text` until they move over.
- `topics[].element_codes` (after `element`) lists the official elements a topic covers; `null` for muatan lokal (BJW, SSD, KTB). `element` now repeats the official names joined by `; `, except for the PJOK topics marked `element_not_in_cp`, which keep their old names.
- `subjects[].cp_version_code` names the CP set (`null` for muatan lokal); KKA has a `note`.
- `topics[].outside_cp` (only on marked topics) is a list of marks for content outside the decree's CP. Each mark is `{kind, field, reason, source_ref, precheck_flag, severity}`: `kind` ∈ {`no_cp_in_phase`, `element_not_in_cp`, `content_not_in_cp`, `content_in_later_phase`}, `field` ∈ {`topic`, `element`, `cp_summary`}, `precheck_flag` is the row in [`sd-cp-general.md`](../../drafts/data-precheck/sd-cp-general.md), `severity` is copied from it. The marked content is unchanged until it is reviewed. 119 topics are marked: Bahasa Inggris grades 1–2 (20), PAI tajwid in the summaries (60), PJOK older elements and strands (11), and later-phase or extra content in PP, MTK, Seni Musik, Seni Rupa, Bahasa Indonesia, KKA and IPAS (28).
- `allocations[]` rows may carry `status` (`optional` = SIGRAK content a school switches on, D-204; `elective` = mata pelajaran pilihan) and `basis`. New rows: Bahasa Inggris grades 1–2 (optional), KKA grades 5–6 (elective, 72 and 64 JP a year), Tata Boga grades 3–6 (optional, 2 JP a week; D-458 later made these a SIGRAK suggestion, not a target).

In `subjects.json`, `kind: elective` is new: a mata pelajaran pilihan the school may offer. Koding dan KA uses it with `grades: [5, 6]` and `delivery` (`subject` or `cocurricular`, chosen by the school, Kepmendikdasmen 127/P/2025), and supersedes D-208. It corresponds to `JENIS-MAPEL.PILIHAN` in the taxonomy. No subject uses `cocurricular` any more.

Other fixes from the pre-check: ATP codes of Bahasa Inggris grades 1–2, Bahasa Jawa and KKA grade 6 now follow `ATP-<subject>-K<grade>-BAB-<nn>` (75 codes); Bahasa Inggris grades 1–2 have their weekly distribution; Tata Boga semesters of 18 weeks carry 36 JP (2 × 18) and KTB-K6-04's ATP details match its 28 JP over 14 weeks; element names follow the decree. The known issue "Matematika grade 4 semester 2" is closed: the data has 90 JP (35 + 35 + 20).

| File (status `draft`)            | Bytes     | sha256                                                             |
| -------------------------------- | --------- | ------------------------------------------------------------------ |
| `cp-umum-sd-bskap-046-2025.json` | 109,437   | `056b35500816f37cf33c26288735f334209bb1013b7954e775c18f435a32baa6` |
| `sigrak-sd-2026-r1-umum.json`    | 2,450,068 | `7a8b136dc4d3d1005753e64bba7dbdcdea6a084bd30774e7f3d0ea8d74075e57` |
| `subjects.json`                  | 9,384     | `0b753839eb45fcefd2f56890e57cdb0be1c0edc85f96ca7835c05d4164563d1b` |

## Owner's curriculum choices (D-458)

Applied to `sigrak-sd-2026-r1-umum.json` on 2026-11-28 (recorded in its `schema_changes` and `conventions`), closing pre-check flags 16 and 17:

- **Keterampilan Tata Boga (KTB, muatan lokal):** SIGRAK sets no JP target; the school sets it. The four allocation rows carry `jp_target_set_by: "school"` (new optional field) and a `basis` that calls the numbers a SIGRAK suggestion. In each topic, `extras.atp.calculation_basis` and `extras.atp.notes` now start with "PERKIRAAN SIGRAK, bukan target JP", and `curation_notes` has a D-458 note. Topic order, TP and ATP are unchanged. KTB-K6-04's `extras.atp` already matched its 28 JP over 14 weeks (fixed in RS-17).
- **Seni dan Budaya (SB):** `allocations` has 24 rows, one per grade and `art_branch` (Seni Musik, Seni Rupa, Seni Tari, Seni Teater), each the full track: 54 JP per semester, 42 in grade 6 semester 2 (108 JP a year, 96 in grade 6; 13/2025 Tabel 1–5 note b). The Musik and Rupa topics stay and join their track through `extras.art_branch`; `order_in_semester` already counts per branch (pre-check flag 23).
- **Matematika Fase C:** MTK-K6-02 "Rasio" moves from Bilangan to Aljabar (`element_codes` `MTK-E2`). Its `cp_summary` is the official Aljabar Fase C text (`CP-UMUM-SD-BSKAP-046-2025-MTK-C-02`), so its `outside_cp` mark (flag 7) is removed; 118 topics are now marked. P4-29 checks whether Aljabar needs more topics (patterns, unknown values).
- **CP umum start year:** `applies_from_school_year` of `CP-UMUM-SD-BSKAP-046-2025` was already `2025/2026` in `docs/data/profiles/sd.json` and `mi.json`; the regulation registry has no such field.

Known gaps (for P4-30):

- **Seni Tari and Seni Teater** have allocation rows but no topics. A class whose school picks either branch has no SIGRAK topics yet.
- **Seni Musik and Seni Rupa topic JP** still hold the old split of one semester target between the two branches (for example grade 1 semester 1: 27 + 27 JP against 54 each). The import reports these rows as short until the JP, week ranges and fokus estimates are scaled to the branch track.

| File (status `draft`)         | Bytes     | sha256                                                             |
| ----------------------------- | --------- | ------------------------------------------------------------------ |
| `sigrak-sd-2026-r1-umum.json` | 2,481,962 | `b82293897d49636ec2e73c22682046c045670b842962ad676faf36372653c181` |

## Curation per subject (D-364)

`curation.status` ∈ {`converted`, `in_review`, `curated`}, with `since`, `reviewed_by`, `reviewed_on`, and `note`. Only `curated` subjects are active for teachers (enforced from P5-04). The import keeps each subject's curation in the version's file meta.

| Status                                          | Subjects                                                   |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `converted` (not yet reviewed)                  | PP, BIN, MTK, BIG, PJOK, PAI, SB, BJW, SSD, IPAS, KKA, KTB |
| `in_review` (SIGRAK draft from the verified CP) | PAKR, PAKT, PAH, PAB, PAKH; QH, AA, FIK, SKI, BAR          |
| `curated`                                       | none yet                                                   |

Checklist before a subject becomes `curated`: CP matches the official decree; the TP cover the CP; ATP order and JP match Permendikdasmen 13/2025 (SD) or KMA 1503/2025 (MI); every fokus is linked to its TP; known issues closed; references recorded. Curation tasks: P4-29 (SD core), P4-30 (SD others), P4-31 (religions SD and MI).

## Crosswalk

`crosswalk-legacy-2026.json` maps every old topic, TP, and fokus code (legacy app IDs and aliases, earlier draft codes) to its SIGRAK code, plus `retired` entries for old IDs that were merged into a topic. It is for the team, to trace a question about old data. Nothing in the app reads it, and old codes never appear in topics (`topics.legacy_codes` was dropped, D-365). Source findings on the legacy data: [`docs/drafts/curriculum-source-check-2026.md`](../../drafts/curriculum-source-check-2026.md).
