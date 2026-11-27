# Data pre-check: school calendar data

Task RS-15 (D-447). Read-only pre-check; no data file was changed.

- **Files checked:** `docs/data/calendar/region-jawa-tengah-2026-2027.json`, `docs/data/calendar/national-holidays-2026-2027.json`, `docs/data/calendar/README.md`.
- **Sources:** `docs/sources/Pedoman_Kalender_Pendidikan_Prov_Jawa_Tengah_2026_2027.pdf` (Peraturan Kepala Dinas Pendidikan Provinsi Jawa Tengah 400.3/23862/2026), PDF pp. 11, 16–18 (Pasal 5–29), 22–23 (Lampiran I, SD/MI), 40–42 (Lampiran X, 6 hari, also read as page images), 49 (Lampiran XIII). SKB 3 Menteri copies fetched from JDIH Kemnaker on 2026-11-27 (not stored in the repo): `2025kb002.pdf` (SKB 1497/2/5 Tahun 2025, holidays 2026; scan, annex read as image, p. 3–4) and `2026skb003.pdf` (SKB 1205/3/2 Tahun 2026, holidays 2027; text layer, pp. 1–5). Both sha256 values match the ones in the file's `check.sources`.
- **Date:** 2026-11-27.
- **Method:** `pdftotext -layout` into the scratchpad; calendar grids read as page images. Python (`-I`) computed the weekday of every date in both files and rebuilt the effective-day count with the app rule (Mon–Sat from first to last day, minus Sundays, national holidays, active cuti bersama and events, with `joint_leave_school_days` kept as school days), per month and per semester. Each date was then compared by eye with the guide and the SKB annexes.

## Summary

| Checked | Count |
| --- | --- |
| National holiday and joint leave days (Jul 2026 – Dec 2027) | 30 (25 in 2026/2027, 5 in 2027/2028 to 31 Dec) |
| Regional dates (3 year dates, 11 events, 5 joint-leave school days, 2 assessment windows, 10 milestones) | 31 |
| Effective-day totals (year, 2 semesters, 12 months) | 15 |

| Severity | Flags |
| --- | --- |
| High | 0 |
| Medium | 1 |
| Low | 3 |
| **Total** | **4** |

Known point, confirmed (not counted): with the app rule the file gives 254 / 134 / 120 effective days, as Lampiran XIII states. Per month it differs only in May 2027 (22, guide 21) and June 2027 (15, guide 16). Lampiran XIII puts the "Penyerahan Rapor dan Pengumuman Kelulusan" day in May, but SD/MI kelulusan is the first Monday of June (7 Jun 2027, Pasal 22 ayat (1), p. 16). The guide's June column also counts 3 Sundays and 8 break days where there are 4 and 9. The file's choice (7 Jun) is the correct reading of the Pasal; keeping it as the default is sound.

## Flags

| # | Severity | Item | Data location (file + JSON path) | What differs | Source location (file, page) | Suggested fix |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Medium | Wrong pointer for national holidays | `region-jawa-tengah-2026-2027.json` `notes[1]` | Says national holidays and cuti bersama "come from the national table (docs/sources/usulan-01/data/libur-nasional-cuti-bersama.json)", the unverified legacy input. The README and D-254 say they come from `docs/data/calendar/national-holidays-2026-2027.json`, the checked dataset | `docs/data/calendar/README.md` §Jawa Tengah, "Fields" | Point `notes[1]` to `docs/data/calendar/national-holidays-2026-2027.json` |
| 2 | Low | Support claimed from Lampiran X headers | `region-jawa-tengah-2026-2027.json` `notes[7]` ("matches the Lampiran X headers (Mei 22, Juni 15)") | The Lampiran X month headers are not on one basis. They count TKA and upacara days as effective (Apr 26, Nov 25, Jul 17, as Lampiran XIII "Jumlah Hari Efektif"), yet June shows 15, which subtracts the kelulusan day. So the headers only partly support the choice; Pasal 22 ayat (1) is the real basis | Pedoman Kaldik Jateng Lampiran X, PDF pp. 40–41; Lampiran XIII, p. 49 | Cite Pasal 22 ayat (1) as the basis and describe the Lampiran X headers as mixed |
| 3 | Low | Exam type of the end-of-year window | `region-jawa-tengah-2026-2027.json` `assessment_windows[1].exam_type` = `sas` | The window is "Penilaian Sumatif Akhir Tahun" (Pasal 19 ayat (2)), not the end of semester 1. Not imported today, so no effect yet | Pedoman Kaldik Jateng Pasal 19 ayat (2), PDF p. 16 | Use an end-of-year type (e.g. `sat`) if the app has one, or note that `sas` covers both |
| 4 | Low | Joint-leave titles use the old wording | `region-jawa-tengah-2026-2027.json` `joint_leave_school_days[*].title` (e.g. "Cuti Bersama Hari Raya Idulfitri 1448 H") | The national file uses the SKB names ("Idul Fitri 1448 Hijriah", "Hari Raya Waisak 2571 BE"). The dates match, so this is cosmetic | SKB 1205/3/2 Tahun 2026 Lampiran B, PDF pp. 4–5 | Reuse the national file's names, or drop `title` and join on `date` |

## Checked and fine

**National holidays (`national-holidays-2026-2027.json`)**

- **2026 part (Jul–Dec):** 17 Aug (Mon), 25 Aug (Tue) and 25 Dec (Fri) as holidays, 24 Dec (Thu) as cuti bersama. These match SKB 1497/2/5 Tahun 2025 Lampiran A no. 14–16 and B no. 6 (image pp. 3–4). Set on 19 Sep 2025, as recorded.
- **2027:** 18 holiday days (1 Jan, 5 Jan, 6 Feb, 8 Mar, 10–11 Mar, 26 Mar, 28 Mar, 1 May, 6 May, 17 May, 20 May, 1 Jun, 6 Jun, 15 Aug, 17 Aug, 25 Dec, 26 Dec) and 8 cuti bersama (5 Feb, 9, 12, 15 Mar, 25 Mar, 18 May, 19 May, 24 Dec). These match SKB 1205/3/2 Tahun 2026 Lampiran A and B. Set on 15 Sep 2026; Diktum KEDUA leaves 1 Ramadan, Idul Fitri and Idul Adha to a KMA, as the `unresolved` block says.
- **Other checks:** the stated weekday of each day matches the computed one and the weekday printed in the SKB. No duplicate dates. Every day names the right decree for its year. Names follow the SKB, including the "Hijirah" spelling fixed to "Hijriah" as documented. Movable dates are plausible (Easter 28 Mar 2027 → Good Friday 26 Mar and Ascension 6 May; Imlek 6 Feb 2027).

**Jawa Tengah calendar (`region-jawa-tengah-2026-2027.json`)**

- **Start, semester and end dates:** first day Mon 13 Jul 2026 (Pasal 5, p. 11); semester 2 starts Sat 2 Jan 2027; last day Sat 19 Jun 2027 (Pasal 29, p. 18); next year Mon 12 Jul 2027 (Lampiran I no. 38).
- **Breaks:** semester-1 break 21 Dec 2026 – 1 Jan 2027 (Pasal 23 ayat (1), p. 17, and Lampiran XIII January = 24). Lampiran I no. 11 and the Lampiran X grid end it on 2 Jan; the file's choice and its note are correct. End-of-year break 21 Jun – 10 Jul 2027 (Pasal 23 ayat (2), 6-day).
- **Holidays and events:** extra holidays 10 Feb 2027 (perkiraan awal puasa) and 13 Mar 2027 (Lampiran I no. 17, 21; Lampiran X grid). Maulid on 25 Aug 2026 (SKB, Lampiran XIII August "libur umum 2", Lampiran X grid); Lampiran I no. 4 "5 September" is the guide's error. TKA 19–20, 22–23, 26–29 Apr 2027 with 21 Apr upacara and Sat 24 Apr a school day (Lampiran X grid: 24 Apr not shaded).
- **Days the guide still counts as school days:** cuti bersama 5 Feb, 15 Mar, 25 Mar, 18 May and 19 May 2027. This is borne out by Lampiran XIII: February has libur umum 1, March libur umum 4 + Ramadhan/Idul Fitri 3, May libur umum 4. The Lampiran X grid leaves 15 and 25 Mar unshaded.
- **Report cards and graduation:** report cards Sat 19 Dec 2026 and Sat 19 Jun 2027 (Pasal 21, p. 16); kelulusan Mon 7 Jun 2027 (Pasal 22 ayat (1)).
- **Assessment windows:** 23 Nov – 5 Dec 2026 and 24 May – 5 Jun 2027 fit "minggu ke-4 … s.d. minggu ke-1" of Pasal 19 with weeks starting Monday.
- **Milestone weekdays:** 2 May 2027 is a Sunday, and 20 May and 1 Jun 2027 fall on holidays, as their titles say.
- **Effective-day count:** the rebuilt count gives July 16, Aug 24, Sep 26, Oct 27, Nov 24, Dec 17, Jan 24, Feb 22, Mar 20, Apr 17, May 22, Jun 15 = 134 + 120 = 254. This equals `expected`, except the known May/June point.
- **Source details:** the `expected.per_month_column` remark is right: the "Jumlah Hari Efektif" column sums to 137 and 131. Page 49 does carry both "LAMPIRAN XIII" and "LAMPIRAN XIV" in its header. The source file sha256 and set date (29 May 2026) match the registry entry PERKADIS-JATENG-400-3-23862-2026.
- **Nyepi:** the file's note on the guide's Nyepi date (Pasal 26: 9 Mar; Lampiran I and SKB: 8 Mar) is right; 8 Mar is used.

## Could not check

- **Final dates of Idul Fitri and Idul Adha 1448 H:** they depend on the Minister of Religious Affairs' isbat decisions (SKB 2027 Diktum KEDUA); no such KMA is in the repo or was fetched.
- **Colour coding of every Lampiran X cell:** read by eye from 80 dpi images. Shaded days agree with the file, but small icons (MPLS days, upacara) were not checked cell by cell.
- **The SKB copies** were fetched for this check only and are not in `docs/sources/`. Their hashes match the file's record, but a later reader cannot re-check them from the repo.
