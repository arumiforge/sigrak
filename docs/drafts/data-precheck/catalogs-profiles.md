# Data pre-check: catalogs and level profiles

Task RS-15 (D-447). Read-only pre-check; no data file was changed.

- **Files checked:** `docs/data/catalogs/cocurricular-themes.json`, `extracurriculars.json`, `form-options.json`, `class-inventory.json`, `admin-document-components.json`, `README.md`; `docs/data/profiles/sd.json`, `mi.json`, `README.md`. Cross-checked with `docs/data/regulations/cocurricular-guide-bskap.json` (form and dimension keys) and `docs/data/curriculum/subjects.json` (subject codes).
- **Sources:** `Panduan_Kokurikuler_BSKAP_2025.pdf` (PDF pp. 8, 10–11, 27–31, 33); `Permendikdasmen_No_13_Tahun_2025…pdf` (pp. 4–5, 15–21); `Permendikdasmen_No_9_Tahun_2026…pdf` (pp. 3–4); `Permendikdasmen_No_6_Tahun_2026…pdf` (Pasal 18); `Kepmendikdasmen_No_56_Tahun_2026…pdf`; `Kepmendikdasmen_No_127_P_2025…pdf` (p. 6); `KMA_No_512_Tahun_2026…pdf` (p. 2, image); `KMA_No_1503_Tahun_2025…pdf` (pp. 4, 28, image); `SK_Dirjen_Pendis_No_9941_Tahun_2025…pdf` (p. 5); `Salinan_Kepka_BKPDM_No._020_Tahun_2026…pdf` (p. 3, image).
- **Date:** 2026-11-27.
- **Method:** `pdftotext -layout` into the scratchpad; scans read as page images. Python (`-I`) checked code format, uniqueness and numbering, keys per list, every cross-reference (themes, forms, dimensions, subjects, habits, movement forms, outputs, categories, formats, admin components in profiles), counts against the READMEs, and the README checksums. Claims that cite a regulation, guide or decision with an official basis were read against the source.

## Summary

| Checked | Count |
| --- | --- |
| Catalog codes (all unique, sequential, valid format) | 206 |
| Cross-references (20 activities, 21 extracurricular items, 6 categories, 42 profile component refs) | all |
| Profile versions | 2 (SD, MI) |

| Severity | Flags |
| --- | --- |
| High | 3 |
| Medium | 2 |
| Low | 7 |
| **Total** | **12** |

## Flags

| # | Severity | Item | Data location (file + JSON path) | What differs | Source location (file, page) | Suggested fix |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | High | AN missing for MI | `profiles/mi.json` `versions[0].external_assessments` (only `tka`, `akmi`); `profiles/README.md` "AN and TKA for SD; TKA for MI" | AN participants are "peserta didik kelas akhir pada SD/MI/Sederajat", and participants come from schools run by the ministry of religion too. 56/2026 runs TKA and AN for SD/MI | Permendikdasmen 9/2026 Pasal 5 ayat (3) huruf a, PDF p. 3; Pasal 6 ayat (1), p. 4; Kepmendikdasmen 56/2026 | Add `{ "code": "an", "status": "confirmed" }` to MI and fix the README line |
| 2 | High | Pramuka locked as the required kepanduan | `catalogs/extracurriculars.json` `items[code=SIGRAK-KAT-EKS-01]` (`mandatory_to_offer: true`) and its `review_notes` | The rule is "kepramukaan **atau** kepanduan lainnya". The file's own D-210 text says "Pramuka or another kepanduan". Locking Pramuka stops a school that offers another kepanduan instead | Permendikdasmen 13/2025 Pasal 22 ayat (2), PDF p. 4 | Keep Pramuka `offered_by_default: true`, but make the rule "at least one item in `scouting_leadership` that is a kepanduan" (or `mandatory_to_offer: false` plus a check); fix the review note |
| 3 | High | Official example theme hidden as "old P5 theme" | `catalogs/cocurricular-themes.json` `themes[code=SIGRAK-KAT-KOK-12]` (`offered: false`, review note "Tema projek kurikulum sebelumnya (P5)") | Panduan Kokurikuler 2025 lists "Gaya hidup berkelanjutan" as one of its six reference themes. It is a current example, and teachers would not see it | Panduan Kokurikuler 2025, PDF p. 28 ("Referensi tema sebagai inspirasi", item f) | Set `offered: true` and change the review note; check `SIGRAK-KAT-KOK-13` "Suara Demokrasi" the same way (not in the 2025 list, so `false` may stay) |
| 4 | Medium | KKA described as kokurikuler only | `catalogs/cocurricular-themes.json` `meta.decisions.D-208`, `activities[code=SIGRAK-KAT-KOK-KEG-07].review_notes`; `catalogs/extracurriculars.json` `items[code=SIGRAK-KAT-EKS-20].review_notes` | 13/2025 lists KKA for SD/MI kelas V–VI as a Mata Pelajaran Pilihan, intrakurikuler 72/64 JP, kokurikuler "-". 127/P/2025 lists kokurikuler and ekstrakurikuler (robotika, koding) only as options. See taxonomy pre-check flag 1 | Permendikdasmen 13/2025 Lampiran II Tabel 4–5, PDF pp. 19–21; Kepmendikdasmen 127/P/2025 BAB II B, p. 6 | Follow the Tim Validasi outcome on D-208; reword the notes ("KKA may also run as kokurikuler") |
| 5 | Medium | KBC off by default for SD religion teachers | `profiles/sd.json` `versions[0].rpm_extra_fields.kbc` (`enabled: false`, D-368) | KMA 512 Diktum KESATU applies KBC to schools under the Ministry of Religion **and** to religion teachers in general schools. D-368 is a deliberate SIGRAK choice, so this is for Tim Validasi to confirm, not an extraction error | KMA 512/2026 Diktum KESATU, PDF p. 2 (image) | Confirm D-368. If kept, say in `source` that it narrows KMA 512 Diktum KESATU |
| 6 | Low | `effective_on` empty where the text fixes it | `profiles/sd.json` `rule_sets.cp[0].effective_on`; `profiles/mi.json` `rule_sets.structure_jp[0].effective_on`, `rule_sets.cp[0].effective_on` (each "tanggal berlaku belum diperiksa") | Each decree applies from the day it was set | BKPDM 020/2026 Diktum KEDUA, PDF p. 3; KMA 1503/2025 Diktum KEDELAPAN, p. 4; SK Dirjen Pendis 9941/2025 Diktum KETIGA, p. 5 | 2026-06-11; 2025-09-22; 2025-11-28 (`applies_from_school_year` unchanged) |
| 7 | Low | "Cara lainnya" used for multi-subject projects (unsure) | `catalogs/cocurricular-themes.json` `activities[code=SIGRAK-KAT-KOK-KEG-08, -12, -16, -18, -19, -20].form` = `other_ways` (2–3 `related_subjects` each) | The guide defines lintas disiplin as integrating two or more subjects in one theme. "Cara lainnya" covers activities typical of the school, value-based activities, and single-subject activities. The review note "sesuai Panduan Kokurikuler 2025" does not fit these six well | Panduan Kokurikuler 2025, PDF p. 28 (lintas disiplin), p. 33 (cara lainnya) | Tim Validasi to decide: `cross_disciplinary_collaborative`, or keep `other_ways` and drop the subjects |
| 8 | Low | Five official reference themes absent | `catalogs/cocurricular-themes.json` `themes` | The guide's reference themes "Generasi sehat dan bugar", "Peduli dan berbagi", "Aku cinta Indonesia", "Hidup hemat dan produktif" and "Berkarya untuk sesama dan bangsa" are not in the catalog. Not an error: themes are the school's (13/2025 Pasal 18 ayat (3)) | Panduan Kokurikuler 2025, PDF p. 28 | Consider adding them, marked as examples from the guide |
| 9 | Low | General-subject CP not in the profiles (unsure) | `profiles/sd.json`, `profiles/mi.json` `rule_sets.cp` | Each lists only the religion CP (BKPDM 020/2026; SK 9941/2025). The general-subject CP of Kepka BSKAP 046/H/KR/2025 (set and in force 16 Jul 2025) has no rule-set entry, although the registry lists it | Kepka BSKAP 046/H/KR/2025 Diktum KEDELAPAN, PDF p. 6 | Add a CP entry for 046/H/KR/2025, or say why the TP/ATP defaults cover it |
| 10 | Low | "Agreed amount" for a voluntary contribution (unsure) | `catalogs/form-options.json` `groups[key=voluntary_contribution].fields[key=agreed_amount, remaining_amount]` (legacy labels "Nominal bayar", "Kurang bayar") | A fixed agreed amount with an outstanding balance reads like a levy rather than a voluntary contribution. The rule on sumbangan versus pungutan (Permendikbud 75/2016, Komite Sekolah) is not in `docs/sources/`, so this was not verified | — | Check against Permendikbud 75/2016; consider dropping `remaining_amount` |
| 11 | Low | Retired terms in a print label | `catalogs/admin-document-components.json` `profiles[key=kudus_subject_teacher].components[order=5].format_label` = "CP, ATP dan Modul Ajar (mapel dan P5)" | "Modul Ajar" and "P5" are retired terms (taxonomy `MODUL-AJAR`, `P5`). A `label` override exists, but it is unclear which label prints | — | Make sure only `label` reaches print, or update `format_label` |
| 12 | Low | Islam-specific activities without scope | `catalogs/cocurricular-themes.json` `activities[code=SIGRAK-KAT-KOK-KEG-04, -05]` | Theme KOK-02 carries a review note about SD schools with murid of several religions. Its activities "Pagi Mengaji" and "Yasin, Tahlil, dan Doa Harian bersama" have none. They link `PAI`, which is SD-only in `subjects.json`, so MI cannot link them either | — | Add the same review note, or a religion or level scope |

## Checked and fine

**Against official sources**

- **7 KAIH:** labels and order (Bangun Pagi … Tidur Cepat) match Panduan Kokurikuler p. 30. D-207 "Tidur Cepat" is the guide's own label.
- **Kokurikuler forms:** the three forms (`cross_disciplinary_collaborative`, `g7kaih`, `other_ways`) match 13/2025 Pasal 16 ayat (2) (p. 3) and Panduan Kokurikuler pp. 11, 28.
- **Themes:** themes belong to the school (13/2025 Pasal 18 ayat (3); Panduan p. 27), as the catalog conventions say.
- **8 dimension keys:** these match `cocurricular-guide-bskap.json` and the DPL list (Panduan p. 10). Every activity targets at least one dimension (Panduan p. 31, criterion i).
- **Pramuka item:** the Pasal 22 reference itself is correct; see flag 2 for the locking.
- **SD profile:**
  - Rule set `STRUKTUR-SD-PERMENDIKDASMEN-13-2025` has `effective_on` 2025-07-15 (Pasal II, p. 5, promulgated 15 Jul 2025).
  - `homeroom_teacher_term` "Guru kelas" matches 6/2026 Pasal 18 ayat (3) huruf a.
  - `cocurricular_jp_source` "all_compulsory_except_english" matches 13/2025 Tabel 1–5 (pp. 15–21): every compulsory subject has 36 kokurikuler JP, while Bahasa Inggris, muatan lokal and KKA have "-".
  - AN and TKA match 9/2026 Pasal 5 ayat (3) and 56/2026.
- **MI profile:**
  - `cocurricular_jp_source` "some_subjects" matches KMA 1503 Tabel 1 (p. 28): kokurikuler JP only for Al-Qur'an Hadis, Pendidikan Pancasila and Bahasa Indonesia.
  - TKA for MI matches 56/2026 (SD/MI).
  - KBC is on for MI (KMA 512 Diktum KESATU).
  - Set dates cited in `source` are right: 22 Sep 2025, 28 Nov 2025, and BKPDM 11 Jun 2026.

**Internal consistency**

- **Codes:** 206 codes in 5 catalogs, all unique across files, valid `SIGRAK-KAT-…` format, numbered 01…n without gaps.
- **Keys:** no duplicate keys in any list.
- **Cocurricular references:** every activity's theme, form, dimensions, subjects (codes exist in `subjects.json`), habits, movement form and output exist. G7KAIH activities carry habits and a movement form; other forms carry none.
- **Extracurriculars:** every item's category and every category's formats exist; every category has items.
- **Admin components:** both Kudus profiles reference existing components with no duplicates, ordered 1–24 (guru kelas) and 1–18 (guru mapel), as D-278 says.
- **Counts:** these match the catalogs README (14 themes, 7 habits, 3 forms, 3 outputs, 20 activities; 3 formats, 7 days, 6 categories, 21 items; 30 inventory items, 3 conditions, 3 funding sources; 8 form groups; 25 components, 2 profiles).
- **Checksums:** all five sha256 values in the catalogs README match the files.
- **Taxonomy links:** the `members_from` paths in the taxonomy that point into these catalogs resolve.

## Could not check

- **Cross-disciplinary activities with no subjects yet** (`SIGRAK-KAT-KOK-KEG-06`, `-09`, `-10`): these have empty `related_subjects`. The review notes already ask Tim Validasi to choose them.
- **Homeroom JTM:** `homeroom_jtm_default` (SD 2, MI 6) rests on Permendikdasmen 11/2025 and KMA 736/2026 (with KMA 943/2026), which are not in `docs/sources/`.
- **AKMI** (`mi.json`, `to_verify`), `report_export_target` (e-Rapor SD, RDM), `calendar_source` and `data_of_record` (Dapodik, EMIS): there is no official source in the repo.
- **Class inventory items, form-option lists** (diagnostic, achievement, meeting, transfer, question bank, grading, attendance) **and admin components:** these cite only SIGRAK decisions or the legacy material. The Kudus format was compared only by count; `instrument_items` refer to SIGRAK's own S-01/S-15 set (`docs/drafts/teacher-supervision-instruments.md`), not to the owner's sample instrument.
- **Pramuka rules for MI** in KMA 1503/2025: scanned, and the relevant pages were not located.
