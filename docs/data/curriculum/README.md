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

One format for all topics (D-363): the data model's own shape (D-140), one version per level and year. Codes: topic `SIGRAK-SD-2026-R1-PP-K1-01`, TP `…-TP01`, fokus `…-FM01`, ATP `ATP-<subject>-K<grade>-BAB-<nn>`. Each subject has its semester JP targets in `allocations` (the topics are checked against them at import) and a `curation` block. Each topic may have `references`, `curation_notes`, and `extras` (art branch, science process skills, subject status, learning type, ATP details).

Provenance: converted on 2026-11-09 by [`scripts/curriculum/convert_legacy_topics.py`](../../../scripts/curriculum/convert_legacy_topics.py) from the legacy app curriculum data (general SD subjects and PAI) and the two earlier SIGRAK religion drafts (D-139…D-141, D-145, D-146). The input files were removed afterwards; they are in the git history before this change. During conversion the D-234 Tata Boga trim went into the data, and notes that named the dropped files or the legacy app's internals were reworded.

| File                           | Topics | TP    | Fokus | sha256                                                             |
| ------------------------------ | ------ | ----- | ----- | ------------------------------------------------------------------ |
| `sigrak-sd-2026-r1-umum.json`  | 432    | 1,372 | 2,021 | `7a8b136dc4d3d1005753e64bba7dbdcdea6a084bd30774e7f3d0ea8d74075e57` |
| `sigrak-sd-2026-r1-agama.json` | 300    | 765   | 1,060 | `4e339ca4734fa0aeb9e59e4ead0b9cdb62e915c309c86339ef2902596cc391fe` |
| `sigrak-mi-2026-r1.json`       | 224    | 558   | 988   | `46351a397be2d36fadbe61e61222ba2f9d3b9eefdedeb525119e204134d53ec0` |
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
- `allocations[]` rows may carry `status` (`optional` = SIGRAK content a school switches on, D-204; `elective` = mata pelajaran pilihan) and `basis`. New rows: Bahasa Inggris grades 1–2 (optional), KKA grades 5–6 (elective, 72 and 64 JP a year), Tata Boga grades 3–6 (optional, 2 JP a week; the owner still has to confirm the target).

In `subjects.json`, `kind: elective` is new: a mata pelajaran pilihan the school may offer. Koding dan KA uses it with `grades: [5, 6]` and `delivery` (`subject` or `cocurricular`, chosen by the school, Kepmendikdasmen 127/P/2025), and supersedes D-208. It corresponds to `JENIS-MAPEL.PILIHAN` in the taxonomy. No subject uses `cocurricular` any more.

Other fixes from the pre-check: ATP codes of Bahasa Inggris grades 1–2, Bahasa Jawa and KKA grade 6 now follow `ATP-<subject>-K<grade>-BAB-<nn>` (75 codes); Bahasa Inggris grades 1–2 have their weekly distribution; Tata Boga semesters of 18 weeks carry 36 JP (2 × 18) and KTB-K6-04's ATP details match its 28 JP over 14 weeks; element names follow the decree. The known issue "Matematika grade 4 semester 2" is closed: the data has 90 JP (35 + 35 + 20).

| File (status `draft`)            | Bytes     | sha256                                                             |
| -------------------------------- | --------- | ------------------------------------------------------------------ |
| `cp-umum-sd-bskap-046-2025.json` | 109,437   | `056b35500816f37cf33c26288735f334209bb1013b7954e775c18f435a32baa6` |
| `sigrak-sd-2026-r1-umum.json`    | 2,450,068 | `7a8b136dc4d3d1005753e64bba7dbdcdea6a084bd30774e7f3d0ea8d74075e57` |
| `subjects.json`                  | 9,384     | `0b753839eb45fcefd2f56890e57cdb0be1c0edc85f96ca7835c05d4164563d1b` |

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
