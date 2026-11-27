# Data pre-check: religion and madrasah curriculum (RS-15, D-447)

- **Data set:** SD religion CP and SIGRAK R1 religion topics; MI Kemenag subjects CP, SIGRAK R1 MI topics, MI JP allocation.
- **Files checked (`docs/data/curriculum/`):** `cp-pendidikan-agama-sd-bkpdm-020-2026.json`, `sigrak-sd-2026-r1-agama.json`, `cp-pai-bahasa-arab-mi-sk-dirjen-9941-2025.json`, `sigrak-mi-2026-r1.json`, `mi-allocation-kma-1503-2025.json`.
- **Sources (`docs/sources/`):**
  - `Salinan_Kepka_BKPDM_No._020_Tahun_2026_…pdf`, Lampiran I, pp. 4–44 (Fase A–C pages: Islam 6–8, Kristen 12–14, Katolik 20–23, Hindu 29, Buddha 34–36, Khonghucu 40–42; element tables 6, 11, 20, 28, 34, 40). PDF page = printed page.
  - `SK_Dirjen_Pendis_No_9941_Tahun_2025_CP_PAI_dan_Bahasa_Arab_pada_Madrasah.pdf`, PDF pp. 13–16 (Al-Qur'an Hadis), 44–48 (Akidah Akhlak), 70–73 (Fikih), 90–92 (SKI), 99–101 (Bahasa Arab). PDF page = printed page + 2.
  - `KMA_No_1503_Tahun_2025_Pedoman_Implementasi_Kurikulum_Madrasah.pdf`, Lampiran II BAB III B, pp. 28–32 (Tabel 1–5 and the rules after Tabel 5).
- **Date:** 2026-11-27
- **Method:**
  - SK 9941: `pdftotext -layout` per page, then a Python (`-I`) substring comparison of every `lead_in` and outcome text against the normalised page text; element intros checked with `grep`. The text layer is reliable for Latin text but **unreliable for Arabic** (broken ligatures, reordered harakat), so all six Arabic passages were read from page images (150 dpi pages, 400–500 dpi crops) and compared letter by letter, harakat included.
  - BKPDM 020 and KMA 1503 have **no usable text layer** (scans). Every Fase A–C page and every allocation table was rendered at 150 dpi and compared by eye with the JSON, word by word and cell by cell.
  - R1 topic files (SIGRAK's own TP, ATP, fokus, JP): checked by script for internal consistency only: codes, numbering, phase/grade fit, JP sums, week ranges, semester totals, TP/fokus links, `cp_text` against the CP files, CP coverage, allocation against the KMA 1503 file and the Permendikdasmen 13/2025 file.

## Summary

| Item | Count |
| --- | --- |
| BKPDM 020: outcome texts (incl. 2 "no CP" cells) + phase summaries + element/sub-element names | 96 + 6 + 34 |
| SK 9941: lead-ins + outcome texts + element intros (Arabic passages read from images: 6) | 14 + 99 + 6 |
| KMA 1503: subject rows (3 values each) + total rows + notes + rules | 56 + 12 + 4 + 5 |
| R1 files: topics / TP / fokus checked for consistency | 524 / 1,323 / 2,048 |
| Flags, high (wrong content a teacher would see) | 0 |
| Flags, medium (wording/structure mismatch) | 3 |
| Flags, low (cosmetic or unsure) | 4 |

No transcription error was found in the BKPDM 020 CP (six religions) or in the KMA 1503 tables. The MI CP's Latin text matches the decree; two Arabic harakat differ from the printed page.

## Flags

| # | Severity | Item (religion/subject, phase, element/code) | Data location (file + JSON path) | What differs | Source location (file, page) | Suggested fix |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | medium | Bahasa Arab, Fase C, Komponen Bahasa, pattern "هَلْ أَنْتَ تُحِبُّ …" | `cp-pai-bahasa-arab-mi-sk-dirjen-9941-2025.json` `subjects[4].phases[2].outcomes[0].text` and `.arabic_passages[1].text`; copied into `sigrak-mi-2026-r1.json` `cp_text` of BAR-K5-01…K5-08 and BAR-K6-01…K6-08 (16 topics) and fokus title BAR-K6-03-FM01 | Data: `اللُّغَةَ الْعَرَبِيَّةَ؟` (fatha). The page prints `اللُّغَةِ الْعَرَبِيَّةِ؟` (kasra on both words). The data's form is the grammatical one (object of تُحِبُّ), but it was changed silently: no `review_notes`, against the file's own "as printed" convention (D-127). | SK 9941, PDF p. 101 (printed p. 99), second Arabic block, line 2 | Store as printed and add a `review_notes` entry (printed genitive is likely a source error), or record an owner-approved correction; then re-copy `cp_text` into the 16 MI topics. The fokus title may keep the correct form if the note says so. |
| 2 | low | Bahasa Arab, Fase C, Komponen Bahasa, "فِي السَّاعَةِ السَّادِسَةِ" | Same paths as #1 (and the same 16 `cp_text` copies) | Data: `السَّادِسَةِ` (shadda on sin). Printed: `السَادِسَةِ` (no shadda). Silent correction of a missing shadda. | SK 9941, PDF p. 101 (printed p. 99), second Arabic block, line 1 | Same as #1: keep as printed with a review note, or approve the correction and note it. |
| 3 | medium | MI allocation, implementation rules 2, 3, 8 | `mi-allocation-kma-1503-2025.json` `rules[0]`, `rules[1]`, `rules[4]` | Rules are condensed, not copied. Rule 2 drops "merupakan muatan pembelajaran yang … dengan"; rule 3 drops "pada Madrasah" and the a–c list; rule 8 drops "di Madrasah", the a/b split and the whole clause "untuk pemenuhan jam tatap muka paling sedikit 24 (dua puluh empat) jam tatap muka per-minggu". | KMA 1503, pp. 31–32 | Copy the rules verbatim (keeping the list items), or add a `text_kind: "summary"` marker and keep rule 8's 24-hour condition. |
| 4 | medium | All five SD religions and all five MI subjects: fokus → TP links | `sigrak-sd-2026-r1-agama.json` and `sigrak-mi-2026-r1.json`, `subjects[].topics[].focus_items[].objective_codes` | Links were drafted by order, and some point at the wrong TP of the topic. Read and confirmed: PAKT-K1-04-FM02 "Doa Bapa Kami" → TP01 "membuat tanda salib" (TP "mengucapkan doa Bapa Kami" exists); QH-K1-01-FM03 "Melafalkan huruf dal sampai ya" → TP02 "menulis huruf hijaiyah secara terpisah" (should be TP01); PAKR-K1-04-FM02 "Ramah dan sopan kepada keluarga" → TP "arti kebaikan" (TP "sikap ramah dan sopan kepada anggota keluarga" exists); PAKT-K6-07-FM02 "Kehidupan kekal" → TP "kebangkitan badan" (TP "makna kehidupan kekal" exists). | — (SIGRAK derivation) | Re-link fokus to the matching TP during P4-31 review. A keyword heuristic lists 100 likely cases; see "Heuristic list" below (unsure, needs a reader). |
| 5 | low | MI allocation note `muatan_lokal_I_V` | `mi-allocation-kma-1503-2025.json` `notes.muatan_lokal_I_V` | The note cites "Tabel 4, note c", but Tabel 4 note c ends at "216 (dua ratus enam belas)." without "sebagai mata pelajaran pilihan" (Tabel 1–3 note b has it). The number words are also dropped. | KMA 1503, p. 28, 29 (note b), p. 30 (note c) | Split the note or say Tabel 4's wording is shorter. |
| 6 | low | MI CP status vs subject curation note | `cp-pai-bahasa-arab-mi-sk-dirjen-9941-2025.json` `extraction.verified` = false; `sigrak-mi-2026-r1.json` `subjects[].curation.note`; `README.md` curation table | The MI subjects' note says "SIGRAK draft from the verified CP", but the MI CP file is still `verified: false` (Tim Validasi sign-off pending, D-113). | — | Reword the note ("from the structured CP, sign-off pending") or complete the sign-off. |
| 7 | low | MI R1 conventions | `sigrak-mi-2026-r1.json` `conventions[1]` | Refers to `tp-atp-pendidikan-agama-sd-2026.json`, which no longer exists (now `sigrak-sd-2026-r1-agama.json`). | — | Update the file name. |

### Heuristic list for flag 4 (unsure)

Fokus whose linked TP shares no keyword with the fokus title while another TP of the same topic shares two or more. Not each one was read; some may be fine. QH-K1-01-FM03 was not caught by the heuristic, so the list is not complete.

- PAKR (12): K1-04-FM02, K1-06-FM01, K1-08-FM04, K2-08-FM01, K2-08-FM04, K2-09-FM02, K4-10-FM01, K4-10-FM02, K5-02-FM03, K5-03-FM02, K5-09-FM01, K5-09-FM03
- PAKT (8): K1-04-FM02, K1-08-FM03, K5-01-FM02, K5-06-FM02, K5-10-FM03, K6-03-FM02, K6-05-FM02, K6-07-FM02
- PAH (8): K1-01-FM03, K1-03-FM02, K3-08-FM02, K3-08-FM03, K4-02-FM02, K4-07-FM03, K6-02-FM02, K6-08-FM02
- PAB (15): K1-03-FM02, K1-08-FM02, K1-09-FM02, K2-03-FM01, K2-03-FM02, K2-06-FM02, K2-07-FM04, K2-09-FM02, K2-10-FM02, K3-06-FM03, K3-08-FM02, K4-06-FM02, K5-01-FM04, K6-03-FM03, K6-08-FM02
- PAKH (10): K1-10-FM02, K3-05-FM02, K3-08-FM02, K4-01-FM02, K4-01-FM03, K4-01-FM04, K4-08-FM02, K4-10-FM02, K5-02-FM03, K5-08-FM02
- QH (8): K1-04-FM03, K1-08-FM02, K1-08-FM03, K2-01-FM02, K5-01-FM02, K5-03-FM03, K5-04-FM04, K5-05-FM04
- AA (13): K1-06-FM02, K1-06-FM03, K1-06-FM05, K2-02-FM04, K2-06-FM03, K2-06-FM04, K2-07-FM02, K3-02-FM03, K3-06-FM03, K3-06-FM04, K5-04-FM03, K6-04-FM04, K6-06-FM03
- FIK (10): K1-02-FM04, K1-05-FM04, K2-05-FM05, K2-06-FM04, K3-02-FM02, K3-06-FM01, K3-06-FM04, K4-01-FM04, K4-06-FM03, K6-04-FM02
- SKI (15): K3-01-FM02, K3-03-FM02, K3-03-FM03, K3-03-FM04, K3-06-FM02, K3-08-FM02, K4-01-FM04, K4-02-FM03, K4-06-FM03, K5-01-FM02, K5-01-FM04, K5-02-FM04, K6-02-FM04, K6-03-FM03, K6-06-FM03
- BAR (1): K2-04-FM02

## Checked and fine

- **Islam (BKPDM 020, 1.1):** all 15 Fase A–C outcomes and the 5 element names match pp. 6–8 word for word (including qadā', taklīf, al-Fātiḥah).
- **Kristen (1.2):** 3 phase summaries, 28 outcomes and both "-" cells (Fase A Allah Penyelamat/Pembaru) match pp. 12–14; sub-element names match the table on p. 11.
- **Katolik (1.3):** 3 summaries and 12 outcomes match pp. 20–23; element names match p. 20.
- **Hindu (1.4):** 15 outcomes match p. 29, including the diacritics (Rāmāyaṇa, Purāṇa, Smṛti, Pañca Yajña); element names match p. 28.
- **Buddha (1.5):** 9 outcomes match pp. 34–36 (including pāramī); element names match p. 34.
- **Khonghucu (1.6):** 15 outcomes match pp. 40–42, Chinese characters and pinyin included (caron for the third tone is the recorded convention); the "Nabi Kǒngzǐ (孔)" anomaly on p. 41 is real and recorded.
- **Al-Qur'an Hadis (SK 9941):** lead-ins, 27 outcomes, sub-element names match PDF pp. 13–16; the "kongkrit" note is right.
- **Akidah Akhlak:** lead-ins, element intros (including Fase B "meliputi kegiatan." without "sebagai berikut", p. 46) and 30 outcomes match pp. 44–48.
- **Fikih:** lead-ins, intros, 22 outcomes match pp. 70–73; the repeated "berupa kritik sosial" notes are right.
- **SKI:** no Fase A in the source (starts at Fase B, p. 90); lead-ins and 14 outcomes match pp. 90–92.
- **Bahasa Arab:** Latin text matches pp. 99–101; Arabic Fase A (both blocks) and Fase B (both blocks) match the page images letter for letter and harakat for harakat; Fase C matches except flags 1–2. The three existing review notes (مَا لَوْنُ spacing, خَالِيْ, كَمْ السَّاعَةُ) describe the page correctly.
- **MI allocation (KMA 1503):** every cell of Tabel 1–5 (pp. 28–31) matches, including empty kokurikuler cells stored as 0, grade VI on 32 weeks, the subject totals and the "Wajib + Muatan Lokal" and "+ Pilihan" ranges; both `source_quirks` are real. Required-subject sums equal the printed total rows.
- **SD R1 religions (`sigrak-sd-2026-r1-agama.json`):** 300 topics / 765 TP / 1,060 fokus, sha256 as in README; codes, ATP codes and numbering are consistent; phase fits grade; every topic's JP = weekly distribution = fokus JP; semesters fill 18/18 weeks (grade 6: 18/14) = 54/54 (54/42) JP, matching 108/96 JP in Permendikdasmen 13/2025; every `cp_text` equals the CP file; every CP outcome of each phase is covered; book reference grade matches; `cp_source` section numbers right.
- **MI R1 (`sigrak-mi-2026-r1.json`):** 224 topics / 558 TP / 988 fokus, sha256 as in README; same structural checks pass at 2 JP per week; per-grade intrakurikuler and kokurikuler JP equal the KMA 1503 file; SKI only in grades 3–6 as in the decree; every Pemahaman Konsep sub-element (Bahasa Arab: Komponen Bahasa) of each phase is covered; every Arabic phrase quoted in a fokus title occurs in the phase's CP text.

## Could not check

- **TP, ATP and fokus content quality** (pedagogy, level of difficulty, theological accuracy): outside this pre-check; only structure and links were checked. The fokus → TP review in flag 4 needs a human reader.
- **Book references:** `references.book_pages` is null everywhere and the book editions are not in `docs/sources/`.
- **PAI (Islam) SD topics:** they live in `sigrak-sd-2026-r1-umum.json`, not in this data set's files.
- **KMA 1503 rules 1, 4, 5** are not in the data (by choice); not checked further. Fase D–F of both CP decrees are out of scope.
- **Element description tables** (Deskripsi column) of both CP decrees are not stored in the data, so not compared.
