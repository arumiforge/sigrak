# SIGRAK catalogs (draft)

Option lists and catalogs SIGRAK offers schools and teachers, curated from the owner's usulan-01 material (`docs/sources/usulan-01/data/`) on 2026-11-09 (D-305, D-367, task P4-15). Every file is `status: draft`: Tim Validasi SIGRAK reviews it before any seeder reads it (D-113).

## Files

| File | What it holds | Items | Source | Used by |
|---|---|---|---|---|
| `cocurricular-themes.json` | Sample themes (with the six reference themes of Panduan Kokurikuler 2025, `guide_reference`), 7 KAIH habits (D-207 label "Tidur Cepat"), 7 KAIH movement forms, outputs, and 20 sample kokurikuler activities | 19 themes, 7 habits, 3 forms, 3 outputs, 20 activities | `katalog-kokurikuler.json` | Buat > Kokurikuler, annual kokurikuler JP target (D-277) |
| `extracurriculars.json` | Formats, days, categories with their purpose, offer groups, and the default extracurricular list; at least one kepanduan must be offered, Pramuka by default (D-210, D-216, D-452) | 3 formats, 7 days, 6 categories, 1 offer group, 21 items | `katalog-ekstrakurikuler.json` | Ekstrakurikuler (P5-07) |
| `class-inventory.json` | Item picker for school and class inventory, conditions, funding sources | 30 items, 3 conditions, 3 funding sources | `inventaris-kelas.json` | Inventory (D-217, D-306) |
| `form-options.json` | Option groups for forms (diagnostic assessment, achievements, meeting minutes, student transfer, Bank Soal, grading, attendance, voluntary contributions), each with its fields and options | 8 groups | `pilihan-isian.json` | Forms across the school app |
| `admin-document-components.json` | Components of Berkas Administrasi and two regional ordering profiles | 25 components, 2 profiles | `komponen-administrasi-pembelajaran.json` | Berkas Administrasi (D-278…D-283) |

Each file starts with a `meta` block: `catalog`, Indonesian `title`, `version` (`SIGRAK-KAT-2026-R1`), `status`, `review`, `source_ref`, `source_sha256`, `converted_on`, the decisions it applies, and its conventions.

## Conventions

- Keys are English snake_case and never change once seeded. Labels and other text people see are Indonesian.
- Codes: `SIGRAK-KAT-<AREA>-NN` for the main items of a file, `SIGRAK-KAT-<AREA>-<LIST>-NN` for its secondary lists. Areas: `KOK` (kokurikuler; `KAIH` habits, `KEG` activities), `EKS` (ekstrakurikuler; `KEL` categories), `INV` (inventory; `KON` conditions, `DNA` funding), `OPS` (form options, one list code per option list), `ADM` (administration components). Codes are stable: a retired item keeps its code, a new item takes the next free number.
- No identifier from the legacy app is carried over. Where D-305 keeps an old label as reference, it sits in `legacy_label` and never reaches the UI.
- `review_notes` are Indonesian notes for Tim Validasi SIGRAK, not shown to teachers. Items marked `origin: proposed` were not readable in the source and are SIGRAK proposals.
- `offer_groups` in `extracurriculars.json` hold minimum-offer rules over several items: `{key, label, min, default, source_ref, decisions, review_notes}`. An item belongs to a group through `offer_group`; at least `min` items of the group stay switched on, and `default` is the item key switched on for a new school. A school-added item joins a group by carrying its `offer_group`. The one group, `scouting`, implements Permendikdasmen 13/2025 Pasal 22 ayat (2): Pramuka by default, replaceable by another kepanduan, one must stay (D-452). `mandatory_to_offer` stays on every item for a single-item lock; no item uses it now.
- `guide_reference: true` on a theme marks the reference themes of Panduan Kokurikuler 2025 (p. 28). Themes stay the school's (13/2025 Pasal 18 ayat (3)).
- In `admin-document-components.json` a profile entry's own `label` is shown and printed; `format_label` (the regional instrument's wording) prints only for entries without one.
- D-305 named the files `cocurricular-activities.json` and `extracurricular.json`; D-367 settles the names above.

## Not catalogs

These usulan-01 files stay in `docs/sources/` and are not converted here:

- `aturan-cetak-aplikasi-lama.json`, `aturan-progres-aplikasi-lama.json`: print and progress rules. SIGRAK's own rules are D-280…D-283 (Berkas Administrasi, PDF merge, print rules) and D-263 (one completeness service).
- `libur-nasional-cuti-bersama.json`: national holidays and joint leave. They belong to the school calendar (U-05) and are checked against the official SKB in calendar task P5-03i (D-263 marks holidays as `excused`).

## Checksums (sha256)

| File | sha256 |
|---|---|
| `admin-document-components.json` | `51fe882e4e82a163c89d964c1a05b10145c8a420b79cea1f83c0d31c51cece59` |
| `class-inventory.json` | `a906fe6f8977b79f4d2afe03454d57337215aadaa30d57891467df55ad25354d` |
| `cocurricular-themes.json` | `fe04e575842010c3ede27568c7e0d7a44d1cc6acc7fcb80b4ecec8b4f380f7e9` |
| `extracurriculars.json` | `531e1defc3c0c4a61d7475c213da06adc1be5467312c24ccfadb06da83aabeb7` |
| `form-options.json` | `34144cfd1a5f1ad6da4d1cfa32a7c2ca6c9bb3fbc1c5c92193745850d6f93c2f` |
