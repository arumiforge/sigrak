# R1-07 — Layer model core and resolver

- **Phase:** R1
- **Status:** in-progress
- **Owner:** r1/r1-07-layers
- **Depends on:** R1-01, R1-04
- **Can run in parallel with:** R1-05, R1-06

## Goal

Build the D-456/D-466 layer model once for every domain: packages per layer and line, additions and hides as differences, mandatory national items, opt-in local agreements, proposals, and a resolver that returns value, source and layer.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- `docs/drafts/regional-layers.md` (whole), `docs/drafts/policy-innovation-layers.md`; decisions D-354, D-378, D-380, D-456, D-466

## Output

- Migrations (block `17643500xxxxx`): `layer_packages`, layered columns helper, `layer_hides`, `layer_group_rules`, `school_package_choices`, `layer_proposals`, `layer_stamps` as in the draft.
- `app/layers/`: resolver with caching by region-chain version stamps; mandatory-item guards in app and database; proposal flow (school → operator; team → Koordinator Wilayah or validator with evidence).
- UI pieces: source badge ("Bawaan SIGRAK", "Provinsi …", "Kecamatan …", "Sekolah") and "Asal data" sheet as shared components.
- The 14 resolver cases of the draft §11 as Japa tests.

## Done when

- [x] Tests (own test database `sigrak_test_r107`), lint and typecheck pass; IDOR test for every school-owned resource
- [x] Pages checked at 360 and 1280 px where the task has UI; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r1/r1-07-layers` (from `r1/r1-00-gate-split`). 201 tests pass on `sigrak_test_r107` (42 new); lint, typecheck and format check pass. Screenshots of the four pages at 360 and 1280 px: no horizontal scroll.

**Built**

- Migrations `1764350000001…8`: `layer_domains` (domain → item table), `layer_stamps`, `layer_packages` (area/kind/evidence CHECKs, region-level trigger, one active official package per area/line/overlapping years, frame immutable), `layer_group_rules`, `layer_notices`, `layer_hides` (mandatory guard trigger, `school_id` and `domain` copied from the package), `school_package_choices` (only active local agreements of the school's own chain), `layer_proposals` (separation-of-duty CHECKs), `catalog_items` (first layered table) and the `schools` region-change trigger. Stamps are bumped by triggers in the same transaction as every change. RLS: a school reads national packages and those of its own province/regency/district (`app_region_chain()`), writes only its own school package; national/area rows are written only by `sigrak_staff` and the owner; stamps, domains and group rules are read-only for the app.
- `app/layers/` (alias `#layers/*`): `resolver/resolve_core.ts` (pure §5.2 algorithm), `resolver/layer_resolver.ts` (loader; runs inside the tenant/staff transaction after the policy-profile resolver; cache keyed by school, year, day, line and the chain's stamps), `layer_rules.ts` (app wall), `school_layer.ts` (operator hide/unhide/add/retire), `package_choices.ts` (follow/leave, principal notice), `proposals.ts` (school and area flows with evidence, return/resubmit/withdraw), `notices.ts`, `database/layered_table.ts` (columns + SQL helper for later domains), `domains/` (adapter interface, registry, extracurricular adapter and catalog import), controllers, validators, access rules.
- Proof domain: **extracurricular catalog** — list items only, a national base from `docs/data/catalogs/extracurriculars.json`, the kepanduan group rule (min 1, default Pramuka), and no earlier table to migrate. `node ace layers:import-catalog [--activate]` keeps the package `draft` until Tim Validasi signs off (D-113).
- Pages: app. `/ekstrakurikuler`, `/paket-daerah`, `/usulan`; admin. `/usulan-wilayah`. Shared components `inertia/components/layers/` (source badge with "Wajib" and line chips, "Asal data" as bottom sheet on phones and popover on desktop, tabs). Copy in `resources/lang/id/layers.json`.
- Tests: `tests/functional/layers/` (14 §11.3 cases, RLS/IDOR per table and over HTTP, proposals, local agreements, pages, import), `tests/unit/layer_resolver.spec.ts` (seeded property checks, cache), helpers `tests/layers.ts`.

**Shared files touched:** `package.json` (`#layers/*`), `start/routes.ts` (one import), `tests/functional/tenancy/rls_coverage.spec.ts` (`catalog_items` in `CHILD_TABLES`), `commands/layers_import_catalog.ts` (new), regenerated `database/schema.ts`, `.adonisjs/server/pages.d.ts`, `.adonisjs/server/routes.d.ts`.

**Deviations from the draft**

1. Stamp scope keys use region ids (`region:<id>`) instead of Kemendagri codes, and stamps are read from PostgreSQL in the request transaction (one indexed query) instead of a Redis `MGET`; the resolution cache is in-process (LRU, 24 h). No after-commit hook is needed and a value is never stale.
2. The region-change hook is a trigger on `schools` (any path that moves a school), not code in `applyDue()`; `region_change_queue.ts` is unchanged.
3. Evidence is required for local agreements too (D-466), not only official packages; evidence is metadata (document title, regulation code, URL, pages, checked on) — no file upload yet.
4. Case 5 checks the 5 Jawa Tengah joint-leave hides on the national holiday list; the 254/134/120 effective-day counts stay the acceptance test of R1-08's calendar adapter.
5. `layer_hides` voids instead of deleting on "Pakai lagi" (`void_reason = unhidden`, added to the list).
6. School packages are open-ended (`applies_to` NULL), so a school's differences carry into later years until a new package starts.

**Proposed decisions**

1. Stamps in PostgreSQL bumped by triggers; in-process cache keyed by them (Redis only if measurements ask for it).
2. Region change handled by a database trigger on `schools`.
3. Approvers for area proposals are `admin` until `regional_lead`/`validator` staff roles and area scopes (D-338) exist.
4. Local agreement choices are per school year and do not carry over automatically.
5. Notices live in `layer_notices` until the in-app inbox/Web Push slice reads them.

**Open questions**

1. Should local agreement choices copy into the next school year on rollover (R1-06), or must the operator choose again?
2. Evidence files (photo/PDF of an agreement): store on the VPS disk or R2 (D-400)? Needed before the console accepts uploads.
3. When do `regional_lead`/`validator` roles and per-staff area scopes arrive (R1-05 or later)? Until then every proposer/approver covers every area.
4. The app menu has no entries for the three school pages yet (`app_layout.tsx` is shared): who adds them?
5. Agent pre-check of area proposals (D-447) and the D-261 impact preview are not built; they belong to the calendar and console slices.

