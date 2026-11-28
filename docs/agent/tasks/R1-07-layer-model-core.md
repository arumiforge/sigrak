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

- [ ] Tests (own test database `sigrak_test_r107`), lint and typecheck pass; IDOR test for every school-owned resource
- [ ] Pages checked at 360 and 1280 px where the task has UI; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
