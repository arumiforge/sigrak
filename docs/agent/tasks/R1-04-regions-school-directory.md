# R1-04 — Regions and school directory (NPSN → region)

- **Phase:** R1
- **Status:** done
- **Owner:** r1/r1-04-regions
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

- [x] Tests (own test database `sigrak_test_r104`), lint and typecheck pass; IDOR test for every school-owned resource
- [x] Pages checked at 360 and 1280 px where the task has UI; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r1/r1-04-regions` (from `r1/r1-00-gate-split`). 145 tests pass on `sigrak_test_r104` (26 new); lint, typecheck and format check pass. Screenshots of both pages at 360 and 1280 px: no horizontal scroll.

**Built**

- Migrations `1764320000001…4`:
  - `…01` `regions` becomes a tree: `level` (province/regency/district), `parent_id`, `name`, `regency_kind` (kabupaten/kota), `kemendagri_code` (unique, dotted, format checked per level), `dapodik_code` (unique, 6 digits, nullable), `status`, `replaced_by_id`. A trigger checks that the parent is one level up and that the child's code starts with the parent's code. Active names are unique per parent and kind (Kabupaten and Kota Pekalongan can both exist). `province`, `regency` and `regency_key` (D-377) are dropped; existing rows are backfilled (Jawa Tengah, Kudus, Jepara, Pati), and any other existing row stops the migration. Writes are revoked from `sigrak_app`. The down migration restores the old shape.
  - `…02` `schools`: `district_id` (kecamatan), `region_source` (`npsn_directory`/`dapodik_import`/`staff_manual`, default `staff_manual`), `region_checked_at`. A trigger checks that `region_id` is a kabupaten/kota and `district_id` a kecamatan inside it. `district` text becomes nullable and stays as the shown name until a later migration drops it.
  - `…03` `school_directory_entries` (D-169): NPSN, name, level, address, village, the text names as fetched, `region_id`/`district_id` (matched rows), coordinates, `source_url`, `fetched_on`, `removed_at`. Reference data, so no RLS; the app role may read only.
  - `…04` `region_change_reviews`: `public_id`, `school_id`, directory entry, from/to region and district, `status` (pending/accepted/rejected/superseded), `apply_from` (next_day/next_school_year), `effective_on`, `decided_by_staff_id`, `decided_at`, `applied_at`, `note`. At most one pending row and one accepted-but-not-applied row per school. RLS: the school may **read** its own rows (SELECT policy); only `sigrak_staff` writes.
- `app/regions/` (alias `#regions/*`):
  - `data/jawa_tengah.ts`: province, Kudus/Jepara/Pati and their 46 kecamatan. `region_list.ts`: `seedRegionList()` (upsert by Kemendagri code), name matching that ignores case and spaces ("Gunung Wungkal" = "Gunungwungkal").
  - `school_directory_importer.ts`: `importSchoolDirectory(path)` validates the file (VineJS), finds the regency by the Dapodik code in the source URL (else by name), matches kecamatan by name, and upserts by NPSN. It is idempotent: a second run reports everything unchanged and writes nothing. Schools the file no longer lists are marked `removed_at` and restored when listed again. It then calls `detectRegionChanges()`. Everything runs in one owner transaction.
  - `region_change_queue.ts`: detection compares the directory with the place the school is heading to (an accepted change still waiting, else its current region). A new difference supersedes an open review with another target; going back to the current place supersedes it. `RegionChangeQueue.accept()` sets the date (tomorrow or the next school year), supersedes a change still waiting and records the staff member. `reject()` keeps the school and saves an optional reason; later imports do not re-ask the same move. `applyDue(today)` moves the school (`region_source = npsn_directory`, `region_checked_at`). All three run in `staffTransaction()`.
  - `school_directory.ts`: `SchoolDirectory.lookup(npsn)` returns the form fill (name, level, address, kabupaten/kota and kecamatan refs, coordinates, removed flag, matching SIGRAK school). `SchoolDirectory.assignRegion(school, entry)` is for R1-05's school form; the caller saves.
  - `effective_dates.ts`, `access.ts` (admin and support only, else 403), `validators.ts`, controllers.
- Commands: `node ace school-directory:import <files…>` and `node ace regions:apply-changes` (daily, for the scheduler role).
- `database/seeders/region_seeder.ts`: the Jawa Tengah list plus the three files in `docs/data/schools` (570 + 772 + 825 rows; every kecamatan matches). `demo_seeder.ts` now uses the tree and sets `district_id`.
- Routes `start/routes/regions.ts` (admin. only, staff guard): `GET /direktori-sekolah` (page with NPSN lookup and directory size per kabupaten/kota), `GET /direktori-sekolah/{npsn}` (JSON for the school form; 404 "NPSN ini belum ada di direktori."), `GET /perubahan-wilayah`, `POST /perubahan-wilayah/{review}/terima` (`apply_from`), `POST /perubahan-wilayah/{review}/tolak` (`note`).
- Pages `inertia/pages/admin/school_directory.tsx`, `admin/region_changes.tsx`, component `inertia/components/regions/region_nav.tsx` (tabs between the two pages until R1-05 adds a console menu). Copy is in `resources/lang/id/regions.json`.
- Tests: `tests/functional/regions/` (tree constraints, grants, import of the repository files, idempotency, removal and restore, bad files, detection, accept/reject/apply, superseding, IDOR, role checks, lookup JSON and pages), `tests/unit/regions.spec.ts`, helpers in `tests/regions.ts`.

**Shared files touched:** `package.json` (`#regions/*` import), `start/routes.ts` (one import line), `tests/helpers.ts` (`createSchool()` now uses a test Kabupaten Uji `33.99` with Kecamatan Uji `33.99.01` from the new `testRegions()`), `tests/functional/tenancy/rls.spec.ts` (region calendar test uses `testRegions()`), `database/seeders/demo_seeder.ts`, `app/models/region.ts`, `app/models/school.ts` (`districtRegion` relation, `RegionSource`), new models `app/models/school_directory_entry.ts` and `region_change_review.ts`, new commands in `commands/`, and the regenerated `database/schema.ts`, `.adonisjs/server/pages.d.ts` and `.adonisjs/server/routes.d.ts`. **Merge note:** any parallel code that uses `Region.firstOrCreate({ province, regency })` or reads `regions.province`/`regency` must switch to `kemendagriCode` (or `testRegions()` in tests). `schools.district` is now `string | null`.

**Proposed decisions**

1. *Region tree replaces the text columns:* `regions.province`/`regency`/`regency_key` (D-377) are dropped. A province-level region is a `level = province` row, so D-377's rule (a calendar owned by a province, schools in a regency) still holds.
2. *Reference data is owner-written:* `regions` and `school_directory_entries` are written only by migrations, seeders and the import command; `sigrak_app` (and so staff transactions) may only read them.
3. *Region change reviews are school-readable, staff-writable:* SELECT-only school policy plus the staff policy, so the operator can see a coming change but never decide it.
4. *"Next school year" means 1 July* of the coming school year, until R1-06 stores school years with real start dates.
5. *A newer accepted change supersedes one still waiting* (its `from` is the waiting change's target), so at most one change waits per school.
6. *Kecamatan match by normalised name* within the regency (case, spaces and punctuation ignored); the Dapodik kecamatan codes stay empty until they are added as data.
7. *A directory row missing from a later fetch is marked removed, never deleted;* removed rows trigger no region reviews.
8. *A rejection holds:* the same move is not asked again by later imports.

**Open questions**

1. **Kemendagri kecamatan codes are written from memory of the official list**, not from a file in the repository (none exists, regional-layers.md §11). Tim Validasi should check `app/regions/data/jawa_tengah.ts` against the current Kepmendagri before production. Should the list then move into `docs/data/regions/` as owner data with a source and sha256, like the calendar files?
2. Kecamatan Dapodik codes: `fetch.cjs` already reads them (`parseDistricts`) but does not write them. Should the script save `district_code` per school, so the import can match by code? That needs a new fetch, which is outside this task.
3. Scheduling `regions:apply-changes`: there is no scheduler role yet. Should it run daily at 00:05 WIB from the scheduler (R3), or as a BullMQ repeatable job on `worker-default`?
4. On accept, regional-layers.md §8 also asks to end the old area's local agreement choices (`end_reason = region_changed`), bump layer stamps and notify the operator. These belong to R1-07 (layers); `RegionChangeQueue.applyDue()` is where to hook them in.
5. A rejected move (same from and to) is not queued again by later imports; a different target is. Should a rejection expire, for example after a school year? Default now: it holds until the directory shows another target.
6. Should `content` staff get read-only access to the two pages? Default now: admin and support only.

### Follow-up D-469 (R1-13)

- Open question 1 answered: the list moved to `docs/data/regions/jawa-tengah.json` (`dataset: region_list`, status `draft`, `source`, `checked`) with a README; `app/regions/data/jawa_tengah.ts` is gone and `app/regions/region_files.ts` (`loadRegionList()`, `jawaTengahRegions()`) reads and checks the file. Seeders, tests and the import's error message point at the new place.
- Pre-check (D-447): all 3 regency codes and 46 kecamatan codes and names match a community transcription of Kepmendagri 300.2.2-2138 Tahun 2025 (`cahyadsn/wilayah`, sha256 in the README); the official Lampiran C was not found or read, and the amending Kepmendagri 300.2.2-2430/2025 was not read. Five items are flagged for the owner in `docs/data/regions/README.md`.
