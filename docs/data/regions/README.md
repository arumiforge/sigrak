# Region list (draft)

Region lists for the `regions` tree (province → kabupaten/kota → kecamatan, D-466), read by `app/regions/region_files.ts` and written to the database only by `database/seeders/region_seeder.ts` (and the demo seeder), idempotent by Kemendagri code. Moved here from `app/regions/data/jawa_tengah.ts` as owner data with its source (D-469). Status `draft` until Tim Validasi SIGRAK signs it off (D-113); the owner reviews the flagged items below.

## Files

| File | Scope | Status |
|---|---|---|
| `jawa-tengah.json` (`WILAYAH-JATENG`) | Provinsi Jawa Tengah (`33`); Kabupaten Pati (`33.18`, 21 kecamatan), Kudus (`33.19`, 9), Jepara (`33.20`, 16): the regencies of the school directory (D-169, D-170) | `draft` |

## Format

- Top level: `dataset` (`region_list`), `code`, `status`, `verify_by`, `decisions`, `scope`, `source`, `checked`, `regions`.
- `source.kemendagri_codes`: the decree the Kemendagri codes and names follow, its part, and `file`/`sha256` of a copy in the repository (`null`: no copy yet). `source.dapodik_codes`: where the Dapodik codes come from.
- `checked`: date, what the list was compared with (with sha256) and the result.
- `regions`: one node per region, `kemendagri_code` (dotted: `33`, `33.19`, `33.19.02`), `name` (Kemendagri spelling, without "Kabupaten"/"Kota" for a regency), optional `dapodik_code` (6 digits), `regency_kind` (`kabupaten`/`kota`) on a regency, `children`. The loader checks the code format per level, that a child's code starts with its parent's, and the field types; the database checks the same again (trigger, R1-04).
- Kecamatan names match the school directory by name within the regency, ignoring case, spaces and punctuation (the directory writes "Gunung Wungkal"). Kecamatan Dapodik codes are not in the repository yet (R1-04 open question 2).

## Source

- **Kemendagri codes and names:** Keputusan Menteri Dalam Negeri Nomor 300.2.2-2138 Tahun 2025 tentang Pemberian dan Pemutakhiran Kode, Data Wilayah Administrasi Pemerintahan, dan Pulau, set 25 April 2025 (it replaced Kepmendagri 100.1.1-6117 Tahun 2022). Kecamatan are in Lampiran C, per kabupaten/kota. The list was first written from memory of the official list (R1-04); no copy of the decree or its annex is in the repository yet.
- **Dapodik codes:** province `030000` and regencies `031800`, `031900`, `032000` from the source URLs of `docs/data/schools/*.json` (`referensi.data.kemendikdasmen.go.id/pendidikan/dikdas/<code>/2`) and `docs/drafts/regional-layers.md` §2.2.

## Pre-check (D-447, 2026-11-28)

What was compared:

1. **Community transcription of the decree:** `cahyadsn/wilayah`, file `db/wilayah.sql` (MIT; header "Data Kode Wilayah sesuai Kepmendagri No 300.2.2-2138 Tahun 2025", last edit 2026-02-13), fetched 2026-11-28, sha256 `c4c3396d9380d4edee072af1d9dff83573b574d7cd00a6562cf82e200e954031`. **Result:** the three regency codes and all 46 kecamatan codes and names match exactly (including "Kota Kudus", "Gunungwungkal", "Pakis Aji", "Kalinyamatan", "Donorojo").
2. **School directory** (`docs/data/schools/*.json`, Kemendikdasmen reference site): every kecamatan there matches one in the list by name; only "Gunung Wungkal" is spelled differently.
3. **Decree number and date:** the regulation index paralegal.id (Kepmendagri 300.2.2-2138/2025, set 25 April 2025) and the Ditjen Bina Adwil launch on 15 May 2025 (infopublik.id).

The official annex was **not** read: no official copy of Lampiran C for Jawa Tengah was found (JDIH Kemendagri was not reached; the regulation index has no annex file; a scanned copy on a regency open-data portal was not opened). So every item rests on a second-hand copy.

### Flagged items (owner review)

| # | Item | Why it is doubtful | Where to check |
|---|---|---|---|
| 1 | All 50 rows (codes `33`, `33.18`…`33.20`, `33.18.01`…`33.20.16`) | Checked only against a community transcription, not the official annex. Needs a check against Lampiran C of Kepmendagri 300.2.2-2138/2025 before production; then add the annex file (or its sha256) to `source.kemendagri_codes`. | Kepmendagri 300.2.2-2138/2025, Lampiran C, Provinsi Jawa Tengah, Kabupaten Pati, Kudus, Jepara (JDIH Kemendagri) |
| 2 | Whole list: amendment | Search results name an amending Kepmendagri 300.2.2-2430 Tahun 2025 (in force 23 June 2025, changes 300.2.2-2138). Its content was not read; it is not known whether it touches Jawa Tengah. | Kepmendagri 300.2.2-2430/2025 and its annex (JDIH Kemendagri) |
| 3 | `33.20.15` "Pakis Aji" (Jepara) | Written with a space in the transcription and in the school directory; other sources often write "Pakisaji". The name match ignores spaces, so imports work either way, but the shown name should follow the annex. | Lampiran C, Kabupaten Jepara, row 33.20.15 |
| 4 | `33.18.17` "Gunungwungkal" (Pati) | The school directory writes "Gunung Wungkal"; the list keeps the Kemendagri spelling of the transcription. Confirm the annex spelling. | Lampiran C, Kabupaten Pati, row 33.18.17 |
| 5 | `33.19.02` "Kota Kudus" (Kudus) | A kecamatan whose name starts with "Kota"; confirm the annex writes it so (not "Kudus Kota"), since regency labels starting with "Kota" are parsed as a kota elsewhere (`parseRegencyName`, regency labels only). | Lampiran C, Kabupaten Kudus, row 33.19.02 |
