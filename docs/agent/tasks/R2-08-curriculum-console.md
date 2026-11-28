# R2-08 — Curriculum console: compare, publish, roll back, impact

- **Phase:** R2
- **Status:** review
- **Owner:** r2/r2-08-curriculum-console
- **Depends on:** R2-01
- **Can run in parallel with:** R2-02…R2-06

## Goal

Staff compare a draft curriculum version with the active one, publish it after a validator's sign-off, roll it back, and see which schools are affected (D-317). The JP audit on RPMs waits for R5 (no RPM table yet).

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R2-00-console-plan.md`, the R2-01 Result (abilities and scope helpers)
- Decisions D-113, D-229, D-317, D-339 (validator, content, curriculum roles), D-458; R1-03 Result (curriculum tables, `curriculum:import`, `PolicyProfileResolver`)

## Output

- Migration block `17645700xxxxx` if needed: version status (draft, signed_off, active, retired), sign-off record (validator, time, note; a validator never signs off their own import, D-339).
- Console pages: versions list, compare (added/removed/changed CP, TP, topics, JP per subject and grade), sign off, publish (curriculum role), roll back to the previous version, impact report (schools by level and region using that version; RPM counts come in R5).
- All changes logged; publish and rollback in one transaction with resolver cache invalidation.
- Tests: separation of duty, publish/rollback, compare output on fixture versions.

## Done when

- [x] Tests (own database `sigrak_test_r208`), lint, typecheck, format check pass
- [x] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r2/r2-08-curriculum-console` (from `r2/r2-00-split`). Full suite 402 tests (393 before + 9 new) on `sigrak_test_r208`; lint, both typechecks, `prettier --check .` and `node ace build` pass. Pages checked with Playwright at 360 and 1280 px (no sideways scroll); screenshots are not committed (the R2 set is R2-09's).

### Built

- **Migration** `1764570000001_add_curriculum_version_review`: `curriculum_versions.status` ∈ draft, signed_off, active, retired; `imported_by_ids bigint[]`; the sign-off record `signed_off_by_id`, `signed_off_at`, `sign_off_note`, `signed_off_fingerprint`; `published_by_id`, `published_at`; CHECKs (a signed-off row has a time and fingerprint, a draft has neither sign-off nor publication). The staff ids have **no foreign key**: with one, the fixtures' `TRUNCATE staff_users CASCADE` emptied the curriculum tables. One line in `database/schema_rules.ts` types `imported_by_ids` as `number[]`.
- **`app/curriculum/console/review.ts`**: `signOff` (draft only, never by someone in `imported_by_ids`, D-339; stores the fingerprint of `meta.files` hashes), `withdrawSignOff`, `publish` (signed_off only; refused when the data changed after the sign-off, when the signer imported afterwards, or while the predecessor is still draft/signed off), `rollback` (active → draft with the sign-off cleared; a retired predecessor becomes active again), `recordImport`. Each change locks the row, writes its `staff_activity_logs` row (`curriculum.signoff|signoff_withdraw|publish|rollback|import`) in the same transaction, and clears the resolver cache after commit.
- **Resolver** (`PolicyProfileResolver`): once a line has an active version, its draft and signed-off versions are skipped. With nothing published the resolver works as before, so the current data (all draft) keeps working.
- **`compare.ts`**: added/removed/changed rows for JP allocations, CP elements, CP, topics and TP. Rows are matched by code with the version prefix taken off (`SIGRAK-SD-2027-R1-PP-K1-01` ↔ `SIGRAK-SD-2026-R1-PP-K1-01`) and allocations by subject, grade, learning type and art branch. The result has a summary per area and per subject (yearly JP over all grades, and whether the subject is in both versions or only one), with details for one subject grouped by grade (CP by phase, elements apart), plus yearly JP and topic JP per grade. A subject that is in one version only is shown as a whole, not row by row.
- **`impact.ts`**: schools per level and kabupaten/kota within the staff member's scope (`applySchoolScope`); whether the version is in their Profil Jenjang for its school year (the current year, or its start year when that is later), and which version of the same line (the `supersedes_id` chain) they use today. Counts only.
- **`curriculum:import --by <staff email>`** records the importer on every version the run changed (none when nothing changed), logs `curriculum.import`, and warns when an import touches a signed-off or active version.
- **Pages** (`start/routes/curriculum.ts`, lang `curriculum.json`, R1-12 patterns): `/kurikulum` (list), `/kurikulum/{id}` (steps Draf → Disahkan validator → Diterbitkan, the sign-off record with its note, the reasons an action is blocked, Sahkan with an optional note, Batalkan pengesahan, Terbitkan, Kembalikan ke versi sebelumnya, contents counts, files, version line, history), `/kurikulum/{id}/bandingkan?dengan=&mapel=`, `/kurikulum/{id}/dampak`. POST `sahkan`, `batalkan-pengesahan`, `terbitkan`, `kembalikan`. Menu item "Kurikulum" in a new group "Kurikulum dan konten" (`curriculum.view`), icon `curriculum` (Hugeicons books-01). Audit labels under `staff.audit.actions.curriculum.*`.
- **Tests** `tests/functional/curriculum/console.spec.ts` (9): separation of duty and withdrawal; `--by` (unknown email, no-op import, recorded importer); publish blocked without sign-off, by an unpublished predecessor and by data changed after sign-off; resolver following publish and rollback (retired predecessor restored); compare output on two fixture versions; impact counts and an empty scope; page access per role (403 for Support); page props (blocked reason, base, subject); sign-off/publish/rollback over HTTP with 403 for the wrong role.

### Deviations from the task file

- Publish does **not** retire the predecessor. Retired versions are skipped for every school year (R1-03), so retiring would break past years and the years before the new version starts. Both stay active and the resolver switches by start year. A rollback therefore only retires something when that was already retired before.
- Rollback sends the version back to **draft** and clears its sign-off, so republishing needs a new review. It also works on a version with no predecessor ("back to before publishing").
- `curriculum.draft` is not used by any page. There is no console upload: drafts still come from `curriculum:import`, and `--by` records who prepared them.
- Compare and impact are separate pages, not panels on the version page.

### Missing ability keys

None. `curriculum.view|signoff|publish` cover everything; `curriculum.draft` is unused (see above).

### Open questions

- **Owner:** none of the seven imported versions is published yet. Should Tim Validasi sign off and the curator publish them now? Until a line has an active version, its drafts stay in use, as they are today.
- **Owner:** a rollback sends the version back to draft and needs a new sign-off. Is that right, or should it go back to "Disahkan"?
- **Owner:** should a console upload of curriculum files (the `curriculum.draft` ability for Penyusun konten) come in a later task?
- **Team (R1-03 follow-up):** `topics`, `learning_outcomes`, TP and fokus codes are unique across all versions, and the importer upserts on `code`. A new version that reused codes would move rows out of the active version. The data uses version-prefixed codes, so nothing breaks today; the importer should refuse a code owned by another version. It also writes into active versions without a review (the command now warns).
- **Team:** the resolver cache is per process (10-minute lifetime). After a publish or rollback, other web and worker processes pick up the change within 10 minutes. Is that acceptable, or do we want a Redis-based clear?
- **Team (R2-09):** the activity log page does not name `curriculum_version` subjects yet (the row details carry the code).
- **Team (R5):** the impact report has no RPM counts and no JP audit yet (D-317).
