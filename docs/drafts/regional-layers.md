# Regional Layers: National, Province, Kabupaten/Kota, Kecamatan, School

- **Status:** owner answers accepted 2026-11-28 (§12, D-466); implements D-456
- **Task:** RS-18
- **Last updated:** 2026-11-28
- **Builds on:** D-456 (layer model), D-354, D-355, D-378 (versioned rule sets, policy-profile resolver), D-380 (operator approves school proposals), D-253…D-257, D-323, D-377, D-379 (calendar), D-367, D-452 (catalogs, kepanduan), D-231, D-232 (muatan lokal), D-221, D-324, D-327 (supervision variants), D-278, D-283 (Berkas Administrasi, print), D-338, D-339 (staff roles and scopes), D-169, D-170, D-319 (NPSN directory, kecamatan), D-157, D-158, D-161 (Dapodik add-on, held), D-447 (agent pre-check)
- **Extends:** [`policy-innovation-layers.md`](policy-innovation-layers.md) (layers L0–L6, rule strength `force`, rule sets). Nothing here contradicts it; §2 maps the two models.

## 1. Purpose and scope

Rules in the field differ by province, kabupaten/kota, kecamatan and school. D-456 sets one model for every kind of data that varies this way. This draft gives that model a data shape, a resolver, a proposal flow, a UI rule and a migration path for the first five domains:

| Domain key | What varies | Today |
|---|---|---|
| `calendar` | Holidays, joint leave, school-year frame, events | `national_holidays`, `calendars` (region and school copies, D-256), `calendar_events`, `calendar_change_requests` (D-380) |
| `extracurricular` | Offered extracurricular list, kepanduan group | `docs/data/catalogs/extracurriculars.json` |
| `cocurricular_theme` | Kokurikuler themes and sample activities | `docs/data/catalogs/cocurricular-themes.json` |
| `local_content` | Muatan lokal subjects and their allocation | `subjects` (`kind = local_content`), `region_subjects`, `school_subjects` |
| `supervision_instrument` | Instrument templates and regional variants | `docs/drafts/teacher-supervision-instruments.md`, Kudus variant (D-327) |
| `admin_document_profile` | Berkas Administrasi profiles (component order and labels) | `admin-document-components.json` profiles (Format Kudus, D-278) |

Later domains join the same way, as data plus one adapter (§5.6), with no change to the resolver.

**Relation to earlier decisions.**

- **D-354 / D-378:** the policy-profile resolver picks, per domain, the national *rule-set version* in force for (school year, level, region). The layer resolver of §5 runs *after* it: it takes that national version as the top layer and applies the regional and school differences. The "province entry beats national" rule of D-378 becomes one case of the general rule here.
- **D-380:** the school layer keeps D-380 exactly: only the operator changes the school layer directly; others propose and the operator approves. §6 widens the same flow to the regional layers.
- **`policy-innovation-layers.md`:** L0–L6 say *who sets a rule*; the D-456 layers say *which area it covers*. Every rule strength (`force`) of its §2.1 applies here unchanged.

**Out of scope:** teacher-level content (L5) and SIGRAK features (L6) are not layered; letterheads stay per school or teacher (D-031); `form-options.json` and `class-inventory.json` stay plain catalogs until a field need appears.

## 2. Data shape

### 2.1 Layers and lines

| Layer (`layer`) | Area | Who may write | Maps to `policy-innovation-layers.md` |
|---|---|---|---|
| `national` | Indonesia | Tim SIGRAK via the rule-set console only (D-317), after Tim Validasi | L1, L2 (official) and SIGRAK defaults (`origin = sigrak`) |
| `province` | One province | Team proposal, approved per §6 | L3 |
| `regency` | One kabupaten or kota | Team proposal, approved per §6 | L3 |
| `district` | One kecamatan | Team proposal, approved per §6 | L3 (mostly local agreements) |
| `school` | One school | Operator directly; others propose (D-380) | L4 |

Kecamatan is the only layer between kabupaten/kota and school (no gugus or KKG layer, D-456). Code uses `regency` and `district` as in `regions` and `schools.district` today; the UI says "Kabupaten"/"Kota" and "Kecamatan".

**Line** (`line`) is recorded next to the layer on every package and item: `kemendikdasmen`, `kemenag`, or `all`. A school's line comes from its Profil Jenjang `ministry.code` (SD → `kemendikdasmen`, MI → `kemenag`, D-356). An `all` item applies to both; at the same layer, a line-specific item beats an `all` item with the same key (§5.2). This lets a Kanwil Kemenag calendar sit next to the Dinas calendar of the same province.

**Origin** (`origin`): `official` (a regulation or decree), `sigrak` (a SIGRAK default, `force` usually `example` or `free`), `local_agreement`, `school`. The national layer holds both official items and SIGRAK defaults; the UI shows the difference (§9).

### 2.2 Region codes

`regions` today has `province` and nullable `regency` text (D-377) and `schools.district` is text from the NPSN directory (D-319). D-456 needs a kecamatan layer and stable codes. Proposal: `regions` becomes a three-level tree.

| Column | Type | Notes |
|---|---|---|
| `id` | bigint | |
| `level` | varchar CHECK in (`province`,`regency`,`district`) | |
| `parent_id` | FK `regions` RESTRICT, nullable | NULL only for `province`; CHECK by trigger that parent level is one up |
| `name` | varchar | "Jawa Tengah", "Kudus", "Jati" |
| `regency_kind` | varchar CHECK in (`kabupaten`,`kota`), nullable | Only for `regency`; drives "Kabupaten Kudus" / "Kota Semarang" |
| `kemendagri_code` | varchar unique | Official Kemendagri code, dotted: `33`, `33.19`, `33.19.01` |
| `dapodik_code` | varchar unique, nullable | Kemendikdasmen reference code as on referensi.data.kemendikdasmen.go.id: `030000` Jawa Tengah, `031900` Kudus, `032000` Jepara, `031800` Pati (the source URLs of `docs/data/schools/*.json`) |
| `status` | `active`, `retired` | A retired region keeps its rows (pemekaran, renames); `replaced_by_id` nullable |

The two code systems differ: the reference site and Dapodik use their own 6-digit wilayah codes, Kemendagri uses dotted codes. `kemendagri_code` is the key SIGRAK uses in item keys and fixtures; `dapodik_code` is the join key for the directory and later Dapodik imports. The official region list is still missing as data (`docs/drafts/open-questions.md`, taxonomy facet G `WILAYAH`); see Q3.

`schools` keeps `region_id` (the regency, D-377) and gets `district_id` FK `regions` nullable (trigger: its parent is `region_id`), `region_source` ∈ {`npsn_directory`,`dapodik_import`,`staff_manual`}, `region_checked_at`. The text column `district` is dropped once `district_id` is filled (§8).

### 2.3 Tables (sketch, not a migration)

Generic tables hold the layer frame; domain items stay in domain tables with a shared column set, because queryable fields never live in JSONB (data-model conventions). A domain table that carries layered items is a **layered table**.

**`layer_packages`**: a versioned bundle of items one authority set for one area and domain. The national base, the Jawa Tengah kaldik, a kecamatan agreement and each school's own differences are all packages.

| Column | Notes |
|---|---|
| `id`, `public_id` | |
| `code` | unique, e.g. `KALDIK-JATENG-2026-2027-6H`, `MULOK-KUDUS-2026`, `SCHOOL-<school public_id>-CALENDAR-2026-2027` |
| `domain` | domain key of §1 |
| `layer` | §2.1 |
| `region_id` FK nullable / `school_id` FK nullable | CHECK: `national` → both NULL; `school` → only `school_id`; regional layers → only `region_id`, and the region's `level` matches the layer (trigger) |
| `line` | `kemendikdasmen`, `kemenag`, `all` |
| `kind` | `base` (national), `official` (applies automatically), `local_agreement` (opt-in per school), `school` |
| `level_scope` | `sd`, `mi`, `both` |
| `name` | Indonesian label people see, e.g. "Kalender Pendidikan Jawa Tengah 2026/2027" |
| `status` | `draft`, `active`, `retired` (D-113, D-447: draft until reviewed) |
| `applies_from_school_year`, `applies_to_school_year` nullable | as `rule_sets` (D-354) |
| `effective_on` nullable | only when the decree sets a date inside a school year |
| `version` | +1 on every published change; feeds cache stamps (§5.4) |
| `rule_set_code` nullable | for `base`: the rule-set or curriculum version this package mirrors |
| `evidence` JSONB | `{regulation_code, source_file, sha256, source_url, pages, checked_on, note}`; CHECK `kind <> 'official' OR evidence IS NOT NULL`. `regulation_code` points to the registry (`docs/data/taxonomy/regulations.json`, later `regulations`, kinds `perda`, `surat_edaran`, `other` already exist) |
| `approved_by_staff_id`, `approved_at` | |

Unique: (`domain`, `layer`, `region_id`, `school_id`, `line`, `kind`, `code`). A school has at most one `school` package per domain and school year.

**Layered columns** added to each domain table (`calendar_events`, `region_subjects` → `local_content_items`, a new `catalog_items`, `supervision_templates`, `admin_document_profiles`):

| Column | Notes |
|---|---|
| `package_id` FK `layer_packages` CASCADE | Gives layer, area, line, kind |
| `item_key` | Stable identity across revisions and layers: catalog code (`SIGRAK-KAT-EKS-01`), `HOL-2026-08-17`, an event uid, `S-04` |
| `shape` | `list` (set member: add or hide) or `setting` (one value per key, §3.3) |
| `force` | D-353 vocabulary; `mandatory` cannot be hidden (§4) |
| `origin` | §2.1 |
| `group_key` nullable | Offer group, e.g. `scouting` (§4) |
| `match_key` | Normalised duplicate key (calendar: date + kind; catalog: lower-cased label without spaces) |
| `revision`, `supersedes_id` | A change makes a new row; the old one is `retired`, never edited |
| `status` | `active`, `retired`, `shadowed` (duplicate of a higher item, §3.4) |
| `source_ref` JSONB | Page or article, as in the data files |

**`layer_hides`**: "not used" marks; the only other kind of difference.

| Column | Notes |
|---|---|
| `id`, `package_id` FK | The hiding package (its layer and area) |
| `domain`, `target_item_key` | Targets a key, not a revision, so new revisions stay hidden |
| `reason` nullable | Shown to people below |
| `status` | `active`, `void` |
| `void_reason` nullable | `became_mandatory`, `group_minimum`, `target_retired`, `region_changed` |
| `created_by_user_id` / `created_by_staff_id`, `created_at` | |

Unique (`package_id`, `target_item_key`).

**`layer_group_rules`**: `domain`, `group_key`, `min`, `default_item_key`, `line`, `force`, `source_ref`. The `scouting` group (min 1, default `pramuka`, Permendikdasmen 13/2025 Pasal 22 ayat (2), D-452) is the first row; it replaces `offer_groups` in the catalog file.

**`school_package_choices`**: `school_id`, `package_id` (kind `local_agreement` only), `school_year`, `status` (`active`, `ended`), `chosen_by`, `chosen_at`, `ended_at`, `end_reason`. School-owned, RLS.

**`layer_proposals`**: §6.

**`layer_stamps`**: `scope_key` (e.g. `regency:33.19`), `domain`, `stamp` bigint. Bumped in the same transaction as every publish, hide, opt-in or region change (§5.4).

**Documents** that read a layered domain (RPM schedules via the calendar, Berkas Administrasi, supervision visits) store `layer_stamp` JSONB: the package codes and versions they were made under, next to the rule-set codes (D-354). A document never changes silently.

## 3. Lower layers store only differences

### 3.1 The two kinds of difference

A lower layer stores only:

1. **Additions:** its own items (`list` items, or `setting` items where §3.3 allows).
2. **Hides:** `layer_hides` rows marking a higher, non-mandatory item as not used in its area.

It never edits or deletes a higher item. A "change" to a higher non-mandatory item is a hide plus an addition, shown to people as one action ("Ganti untuk sekolah ini"). Nobody proposes removing a national item (D-456); the console has no such action.

### 3.2 How higher changes flow down

Because lower layers hold no copies, a new revision of a higher item reaches every lower layer at the next resolution. Hides target `item_key`, so they keep working across revisions. Concretely:

| Higher-layer change | Effect below |
|---|---|
| New item | Appears everywhere below, unless a lower layer already hides that key (rare; a hide of an unknown key is allowed only for `national` keys announced in advance) |
| New revision of an item | Replaces the old one everywhere; hides stay |
| Item retired | Disappears; hides on it become `void` (`target_retired`) at the yearly clean-up |
| Item becomes `mandatory` | Every hide on it becomes `void` (`became_mandatory`); §3.4 |
| Package retired | Its items disappear; for a `local_agreement`, choices end with `end_reason = package_retired` |

For the calendar this **replaces the copy model of D-256** (superseded by D-466; "Salin dari kalender wilayah" and "Terapkan perubahan wilayah"): the school calendar is the resolved region calendar plus the school's own events and hides. The impact preview (D-261) and the shift preview with Batalkan (D-274) still run (Q1, D-466).

### 3.3 `setting` items

Some values are one per key, not a list: the school-year frame (`starts_on`, `even_semester_starts_on`, `ends_on`, `school_days_per_week`), the instrument variant used for `S-04`, the default Berkas profile. Rule: **the nearest layer that sets the key wins, unless a higher layer set it as `mandatory`.** This is D-378's "province beats national", generalised, and D-324's "a school uses its region's variant, or the default".

### 3.4 Conflicts

| Case | Detection | Resolution |
|---|---|---|
| A lower addition duplicates a **later** higher item (same `item_key`, or same `match_key`) | On publish of the higher item and at resolution | The higher item wins; the lower row becomes `shadowed` (kept, not shown). Its owner gets a notice "Sudah ada di tingkat {layer}" with a one-click retire |
| A hidden item becomes `mandatory` | On publish | Hides become `void` (`became_mandatory`); the item shows again; the operator gets a notice and, for the calendar, the D-261 impact preview |
| Hides would drop a group below its `min` (all kepanduan hidden) | On save (blocked) and at resolution (safety net) | Save is refused with the group's message. If several layers together cause it, the resolver restores `default_item_key` and voids the lowest hide (`group_minimum`) |
| An official package and a local agreement at the same layer add the same key | At resolution | Official wins; the agreement item is `shadowed` for that school |
| Same key, same layer, `all` and line-specific | At resolution | Line-specific wins |
| Two official packages of the same layer and line overlap in school year for the same domain | On publish (blocked) | Only one active official package per (domain, area, line, school year) |
| A lower layer adds a setting the higher layer made `mandatory` | On save (blocked) | "Nilai ini ditetapkan {layer} dan tidak bisa diganti" |

## 4. Mandatory national items

`force = 'mandatory'` on an item means no layer below may hide it or override its setting. Items found so far:

| Item | Domain | Source | How it is marked |
|---|---|---|---|
| National holidays (`kind = national_holiday`) | `calendar` | SKB 3 Menteri (D-253, D-254) | `mandatory`. Joint leave (`joint_leave`) is **not** mandatory: a region or school may mark one date as a school day (D-255), which is a hide |
| TKA dates | `calendar` | Kepmendikdasmen 56/2026, Perka BSKAP 047/H/AN/2025 | `mandatory`, `line = all`; no dataset in the repo yet (gap, §11) |
| AN dates (final-grade SD/MI, Permendikdasmen 9/2026 Pasal 5–6) | `calendar` | Permendikdasmen 9/2026 | `mandatory`, `line = all`; no dataset yet |
| At least one kepanduan | `extracurricular` | Permendikdasmen 13/2025 Pasal 22 ayat (2), D-452 | Group rule `scouting`, `min = 1`, default `pramuka`; single items stay hideable |
| Official CP text per subject, phase, element | (not layered) | Kepka BSKAP 046/H/KR/2025, BKPDM 020/2026, SK Dirjen Pendis 9941/2025 (D-452) | Not a layered domain at all: lower layers may only add local items (muatan lokal), never hide CP |
| Compulsory subjects and their JP | (rule set) | Permendikdasmen 13/2025, KMA 1503/2025 (D-230) | Stays in the structure rule set; not hideable. Muatan lokal cap stays a `maximum` warning (D-232) |
| 8 DPL, 7 KAIH habit list | (taxonomy) | 10/2025; Panduan Kokurikuler 2025 | Closed vocabularies, not layered |
| Observation frame: pra-observasi, observasi, pasca-observasi | `supervision_instrument` | Perdirjen GTK 7607/2023 | Decided: the step is `mandatory` (cannot be hidden), its template is a `setting` a region may vary (D-324) |
| Official regional calendar dates for the region's schools | `calendar` | e.g. Peraturan Kepala Dinas 400.3/23862/2026 | Decided (D-466): `mandatory` below the issuing layer (Q5) |

**Enforcement, three walls:**

1. **App validation** (`LayerRules` service): refuses a hide on a `mandatory` item or a hide that breaks a group minimum, with an Indonesian message from `lang/id`. Runs when a proposal is sent and again at approval (D-380 pattern).
2. **Database:** a `BEFORE INSERT OR UPDATE` trigger on `layer_hides` rejects a row whose target's active revision is `mandatory`; a trigger on each layered table voids hides when an item turns `mandatory`. The `layer_packages` CHECK requires `evidence` for `official`. National packages can be written only by the console's database role (no school-app grant).
3. **Resolver:** ignores any hide on a mandatory item and logs a warning, so bad data never removes a national rule.

## 5. Resolver

### 5.1 Place in the stack

```
PolicyProfileResolver (D-378)      → national rule-set codes per domain for (school year, level, region)
LayerResolver (this draft)         → resolved items per domain for (school, school year)
  └─ DomainAdapter per domain       → reads its layered table, knows match_key and setting keys
```

`LayerResolver` lives in a shared module (for example `app/policy/layers/`). Feature code calls `layers.resolve(domain, schoolId, schoolYear)` and never reads layered tables directly, as code never reads config pointers (CONTEXT, D-355).

### 5.2 Algorithm

```ts
type Layer = 'national' | 'province' | 'regency' | 'district' | 'school'

interface ResolvedItem {
  itemKey: string
  value: unknown                 // domain row (adapter maps it)
  force: Force
  source: {
    layer: Layer
    regionName: string | null    // "Jawa Tengah", "Kudus", "Jati"
    line: 'kemendikdasmen' | 'kemenag' | 'all'
    packageCode: string
    packageKind: 'base' | 'official' | 'local_agreement' | 'school'
    origin: 'official' | 'sigrak' | 'local_agreement' | 'school'
    sourceRef: SourceRef | null
  }
}

interface Resolution {
  items: ResolvedItem[]
  hidden: Array<ResolvedItem & { hiddenBy: { layer: Layer; packageCode: string; reason: string | null } }>
  shadowed: ResolvedItem[]
  warnings: LayerWarning[]       // voided hides, group restores, missing kecamatan
  stamp: Record<string, number>  // package code → version, stored by documents
}

async function resolve(domain, schoolId, schoolYear): Promise<Resolution> {
  const school = await schools.load(schoolId)               // RLS context already set (SET LOCAL, D-429)
  const profile = await policyProfiles.resolve(schoolYear, school.level, school.regionId)
  const line = profile.ministry.code                         // kemendikdasmen | kemenag
  const chain = regionChain(school)                          // [province, regency, district?]

  // 1. Packages in scope, top-down
  const scopes = [
    { layer: 'national' },
    { layer: 'province', regionId: chain.province.id },
    { layer: 'regency',  regionId: chain.regency.id },
    ...(chain.district ? [{ layer: 'district', regionId: chain.district.id }] : []),
    { layer: 'school',   schoolId },
  ]
  const optedIn = await choices.activePackageIds(schoolId, schoolYear)
  const nationalCodes = profile.ruleSets[domain]             // undefined = domain has no rule set yet
  const packages = (await packagesFor(domain, scopes, schoolYear, school.level))
    .filter(p => p.status === 'active')
    .filter(p => p.line === 'all' || p.line === line)
    .filter(p => p.kind !== 'local_agreement' || optedIn.has(p.id))
    .filter(p => p.layer !== 'national' || !nationalCodes || nationalCodes.includes(p.ruleSetCode))

  // 2. Walk layers; within a layer: base/official before local_agreement before school, `all` before line-specific
  const current = new Map<string, ResolvedItem>()
  const hidden = new Map<string, Hidden>()
  for (const layer of LAYER_ORDER) {
    for (const p of orderWithinLayer(packages, layer)) {
      for (const h of await hidesOf(p)) {
        const target = current.get(h.targetItemKey)
        if (!target) continue                                   // unknown or retired target: ignore
        if (target.force === 'mandatory') { warn('hide_on_mandatory', h); continue }
        current.delete(h.targetItemKey); hidden.set(h.targetItemKey, { ...target, hiddenBy: by(p, h) })
      }
      for (const item of await adapter(domain).itemsOf(p, schoolYear)) {
        const existing = current.get(item.itemKey) ?? findByMatchKey(current, item.matchKey)
        if (!existing) { current.set(item.itemKey, item); continue }
        if (existing.source.layer === layer) {                  // same layer: official > agreement, line-specific > all
          if (beatsWithinLayer(item, existing)) replace(current, existing, item) else shadow(item)
          continue
        }
        if (item.shape === 'setting' && existing.force !== 'mandatory') { replace(current, existing, item); continue }
        shadow(item)                                            // lower duplicate of a higher list item
      }
    }
  }

  // 3. Group minimums
  for (const rule of await groupRules(domain, line)) {
    if (countVisible(current, rule.groupKey) < rule.min) {
      restore(current, hidden, rule.defaultItemKey); warn('group_minimum', rule)
    }
  }

  // 4. Effective dates inside the school year
  const items = [...current.values()].filter(i => withinEffectiveDates(i, schoolYear))
  return { items, hidden: [...hidden.values()], shadowed, warnings, stamp: stampOf(packages) }
}
```

Order inside one layer: `base`/`official` → `local_agreement` → `school`; at equal kind, `all` → line-specific, so the line-specific item is applied last and wins.

### 5.3 Effective dates

- A package applies for `applies_from_school_year`…`applies_to_school_year`; a rule published mid-year applies from the next school year unless the decree sets an earlier date (D-354), which goes in `effective_on`.
- A school's choice of a local agreement applies from `chosen_at` (or the date the operator picks) to `ended_at`, inside one school year.
- Calendar items carry their own dates; the resolver returns the whole school year and `EffectiveDays` (D-259) counts as today.
- A closed academic year (D-318) resolves from the stamp stored when it closed, never from current data.

### 5.4 Caching and invalidation

- **Cache key:** `layers:{domain}:{school_id}:{school_year}:{stampHash}`, where `stampHash` hashes the `layer_stamps` of the school's chain: `national`, `province:<code>`, `regency:<code>`, `district:<code>`, `school:<id>`, and `choices:<school_id>`. Reading five small stamps (one Redis `MGET`) is cheaper than resolving.
- **Invalidation:** every publish, hide, opt-in/out and region change bumps the matching stamp in the same transaction (an after-commit hook writes Redis). Old keys expire by TTL (24 h); no fan-out delete over thousands of schools.
- **Shared regional part:** the regional resolution without the school layer is cached per (domain, district or regency, line, school year, opted-in package set), so schools of one kecamatan share it.
- **Tenancy:** cache keys always contain `school_id` for anything with school data; the shared regional part holds no school rows. Cached values hold no personal data.

### 5.5 What the resolver returns

Every value comes with its source (`layer`, area name, `line`, package code and kind, `origin`, `source_ref`). The UI never shows a layered value without that source (§9). `hidden` feeds the "Tidak dipakai" view; `warnings` feed the operator's notices; `stamp` goes into documents.

### 5.6 Domain adapters

| Domain | Layered table | `item_key` | `match_key` | Settings |
|---|---|---|---|---|
| `calendar` | `national_holidays` (national layer, read-only), `calendars` (frame, one per package), `calendar_events` | `HOL-<date>`, event uid | date + kind | `frame.*` |
| `extracurricular` | `catalog_items` | `SIGRAK-KAT-EKS-NN` | normalised label | — |
| `cocurricular_theme` | `catalog_items` | `SIGRAK-KAT-KOK-NN` | normalised label | — |
| `local_content` | `local_content_items` (was `region_subjects`): `subject_id`, `grades`, `allocation`, `in_report_default` | `MULOK-<subject code>` | subject | — |
| `supervision_instrument` | `supervision_templates` | `S-00`…`S-17`, `S-08b` | — | variant per instrument key |
| `admin_document_profile` | `admin_document_profiles` | profile key | — | default profile per role |

## 6. Proposal flow

### 6.1 Who proposes, who approves

| Target layer | Proposes | Approves | Evidence |
|---|---|---|---|
| School | Wali kelas/guru kelas, guru mapel, principal (D-380); the operator acts directly | Operator, optional note | None |
| Kecamatan, kabupaten/kota, province | Tim SIGRAK staff whose scope covers the area (D-338): `content`, `regional_lead`, `sales`, `support`, `curriculum` | `regional_lead` (Koordinator Wilayah) or `validator` with that area in scope; `owner` | Required for `official`: decree registered with source file + sha256 or URL and check date (D-254 pattern). For `local_agreement`: the agreement document or minutes (decided, Q7, D-466) |
| National | Not proposed through this flow; rule-set console and Tim Validasi (D-317, D-113) | — | — |

Separation of duty: a proposer never approves their own proposal (D-339). An area proposal is pre-checked by an agent against its source before a person decides (D-447).

### 6.2 `layer_proposals`

| Column | Notes |
|---|---|
| `id`, `public_id` | |
| `domain`, `target_layer`, `region_id` / `school_id` | `school_id` set → school-owned row with RLS |
| `package_id` nullable | NULL when the proposal creates a package (`create_package`) |
| `action` | `add`, `revise`, `hide`, `unhide`, `retire`, `create_package`, `retire_package` |
| `item_key` nullable, `payload` JSONB | Proposed item fields, validated by the domain adapter's schema |
| `reason` nullable, `evidence` JSONB nullable | |
| `status` | `draft`, `submitted`, `returned`, `approved`, `rejected`, `withdrawn` (`returned` only for area proposals) |
| `proposed_by_user_id` / `proposed_by_staff_id`, `decided_by_user_id` / `decided_by_staff_id`, `decided_at`, `decision_note` | |
| `impact` JSONB | Snapshot shown at approval: schools affected, RPM meetings moved (D-261) |

The calendar's `calendar_change_requests` (D-380) becomes `layer_proposals` rows with `domain = calendar`, `target_layer = school`; its rules (ConflictChecker, school year, class, impact preview) become the calendar adapter's validation.

### 6.3 States and checks

```
draft ──send──▶ submitted ──approve──▶ approved ──(publish job)──▶ item active from its dates
                    │  └──return (area only)──▶ returned ──send──▶ submitted
                    ├──reject──▶ rejected
                    └──withdraw (proposer)──▶ withdrawn
```

- Checks run at send and again at approval: mandatory and group rules (§4), duplicates (§3.4), schema, evidence for `official`.
- Approval of an area proposal publishes a new package version, bumps stamps, and runs the impact report (schools, documents, meetings) like D-317.
- **Audit:** every state change is an append-only row in the audit log (who, when, before/after); hides and choices log the same way.
- **Notifications** (in-app, Web Push D-397, Kabar D-319 for area changes):
  - proposer: on approve, return, reject;
  - approvers in scope: on a new submission;
  - operators (and principals) of affected schools: when an official area change or a voided hide touches their school, with the impact;
  - schools that opted in: when their local agreement changes or is retired.

## 7. Official regional rules and local agreements

| | Official (`kind = official`) | Local agreement (`kind = local_agreement`) |
|---|---|---|
| Examples | Province or kabupaten kaldik, Perda/Pergub on muatan lokal, a Dinas instrument | Kecamatan agreement on joint events, a KKKS format, a shared mulok choice |
| Applies to | Every school of the area and line, automatically | Only schools whose operator chooses it ("Ikuti paket") |
| Evidence | Required, registered regulation | Agreement document (D-466, Q7) |
| School may hide its items | Only non-mandatory items (Q5) | Yes, or leave the package |
| Layers | Province, kabupaten/kota; kecamatan only with an issuing authority (Q6) | Kecamatan by default; kabupaten/kota and province allowed |

**Choosing packages.** The operator sees "Paket daerah" per domain: official packages (always on, with source), and local agreements of the school's own kecamatan, kabupaten/kota and province, each with a switch. Leaving an agreement mid-year shows the impact first (calendar: D-261). Schools never see packages of other areas (D-456: users pick packages, not regions).

## 8. Region from NPSN and Dapodik

- **Source in v1:** the NPSN directory (`school_directory_entries`, D-169, D-170; Kudus, Jepara, Pati; SD and MI) gives province, kabupaten/kota and kecamatan (`district`). Dapodik sync is held (D-161); when the Dapodik add-on comes (D-158), its import is a second source. MI also appear in the directory with an NPSN; EMIS stays their data of record (Profil Jenjang `data_of_record`).
- **Setting it:** when staff create a school from its NPSN, the import maps `district` and the regency to `regions` rows by `dapodik_code` or name within the parent, sets `region_id`, `district_id`, `region_source = npsn_directory`, `region_checked_at`. School users cannot edit the region; the school profile shows it read-only with "Laporkan jika salah" (opens Minta Bantuan).
- **Changes:** each directory re-import compares regions. A difference creates a "Perubahan wilayah" item in the console for `support` or `admin`; nothing changes silently. On accept: the school's regional layers switch from the next day (or the next school year if staff choose), local agreement choices of the old area end (`end_reason = region_changed`), the school's own differences stay, stamps are bumped, and the operator sees the impact.
- **Missing data:** no NPSN yet (`npsn` nullable until verified): staff set the regency by hand (`region_source = staff_manual`), shown as "belum diverifikasi". No kecamatan: the kecamatan layer is skipped and the operator sees "Kecamatan belum tercatat; paket kecamatan belum bisa dipilih". Pemekaran or rename: the old region is `retired` with `replaced_by_id`; packages stay on the old region until staff move them.

## 9. UI

### 9.1 Source label on every value

A small badge after each layered value, from `lang/id` keys `layers.badge.*`:

| Source | Badge text | Extra |
|---|---|---|
| National, official | "Nasional" | Lock icon and "Wajib" when `mandatory` |
| National, SIGRAK default | "Bawaan SIGRAK" (Q8) | — |
| Province | "Provinsi Jawa Tengah" | — |
| Kabupaten/kota | "Kabupaten Kudus" / "Kota Semarang" | — |
| Kecamatan | "Kecamatan Jati" | Local agreement: "Kesepakatan Kecamatan Jati" |
| School | "Sekolah" | — |
| Line-specific | Second chip "Kemenag" or "Kemendikdasmen" | Only when the line is not `all` |

Tapping the badge opens "Asal data" (a Vaul bottom sheet on mobile, a popover on desktop): layer, area, package name, source decree with page, the date it was checked, and the strength label ("Wajib", "Disarankan", "Contoh", "Bebas", from `policy-innovation-layers.md` §4.4). The same strings appear in exports and PDFs as a "Sumber" column where a table lists layered items (D-150).

### 9.2 Hidden items

Each layered list has two tabs: "Dipakai" and "Tidak dipakai". A hidden item shows who hid it ("Disembunyikan oleh Kecamatan Jati") and the reason. The operator can "Pakai lagi" only for hides of their own school; area hides show "Diatur oleh {layer}". Mandatory items show no hide action and the note "Wajib secara nasional, tidak bisa disembunyikan". Hiding the last kepanduan is refused: "Sekolah perlu menyediakan paling sedikit satu kegiatan kepanduan."

### 9.3 Proposal screens

- **School:** "Usulkan perubahan" on a layered item or list (D-380 form): action, fields, reason. The operator's queue "Usulan" lists them with "Setujui" / "Tolak" and an optional note; approval shows the impact first.
- **Console (staff):** "Usulan wilayah": a list filtered by the approver's scope, a diff view (current → proposed), the evidence file, the agent pre-check flags (D-447), affected schools count, and "Setujui", "Kembalikan", "Tolak". The proposer cannot see an approve button on their own item.
- **Packages:** "Paket daerah" (§7) with "Ikuti paket" / "Berhenti mengikuti".

### 9.4 Mobile 360 px

Lists are cards, not tables. The badge wraps under the title, never truncates the area name; long names ("Kesepakatan Kecamatan Kaliwungu") wrap to two lines. Actions sit in a bottom sheet. Tabs stay one row with counts ("Dipakai 18 · Tidak dipakai 3"). Touch targets at least 44 px (Fondasi `ui.md`).

## 10. Migration of existing data

All files stay `draft` until reviewed (D-113, D-447). The migration converts data shapes; it does not change content.

| Source file | Becomes | Layer, line, area | Mandatory and flags |
|---|---|---|---|
| `docs/data/calendar/national-holidays-2026-2027.json` | `national_holidays` rows = national layer of `calendar`, `item_key` `HOL-<date>` | `national`, `all` | `national_holiday` → `mandatory`; `joint_leave` → `example` (hideable, D-255) |
| `docs/data/calendar/region-jawa-tengah-2026-2027.json` (`KALDIK-JATENG-2026-2027-6H`) | One `official` package; frame fields → `calendars` row as `setting` items; `events` → `calendar_events`; `joint_leave_school_days` (5 dates) → `layer_hides` of the national joint-leave keys; `assessment_windows` and `milestones` stay notes in `calendars.meta` (D-379) | `province` Jawa Tengah (`33`), line `all` by default because Lampiran I and XIII cover SD and MI (Q4) | Events `mandatory` for schools below (Q5); `evidence` from its `source` block (decree, sha256, pages) |
| Kudus, Jepara, Pati calendars | No package: they use the province package (D-323); the expected 254/134/120 check (D-323) stays the acceptance test | — | — |
| `docs/data/catalogs/extracurriculars.json` | `catalog_items` (`domain = extracurricular`) in the national `base` package; `offer_groups.scouting` → `layer_group_rules` | `national`, `all`, `origin = sigrak` | Group `scouting` min 1, default `pramuka`; items `free`; `offered_by_default` stays an item attribute (a school default, not a hide) |
| `docs/data/catalogs/cocurricular-themes.json` | `themes` and `activities` → `catalog_items` (`domain = cocurricular_theme`) | `national`, `all` | Themes with `guide_reference: true` → `origin = official`, `force = example`; others `origin = sigrak`, `free`. `habits_7kaih` stays a closed taxonomy list, not layered |
| `docs/data/curriculum/subjects.json` (`BJW`, `KTB`, `SSD`) and `region_subjects` ("Bahasa Jawa for Kudus") | `local_content_items`: `KTB`, `SSD` in the national base (`school_discretion`, off by default, D-204, D-231); Bahasa Jawa as an `official` item of the area that sets it | KTB, SSD: `national`; BJW: `province` Jawa Tengah if a provincial rule is registered, else `regency` Kudus, Jepara, Pati (Q9) | Cap stays a rule (`MULOK` `jp_limits` in `facet-g-context.json`, `maximum`, D-232); MI range from KMA 1503/2025 stays in the MI allocation rule set |
| `docs/drafts/teacher-supervision-instruments.md` S-00…S-17 (+ S-08 variants) | `supervision_templates` in the national `base` package | `national`; S-08b (Kemenag subjects) `line = kemenag`; others `all` | S-07/S-08/S-09 steps `mandatory` (frame, §4); telaah instruments `school_discretion` (D-452) |
| Kudus instrument set (`docs/sources/Instrumen_Supervisi_Kudus_Pra_Observasi_Pasca.docx`, D-327) | `supervision_templates` rows as `setting` variants for S-01, S-04/S-07, S-08, S-09 | `regency` Kudus (`33.19`), line `all`; kind `official` or `local_agreement` (Q10) | — |
| `docs/data/catalogs/admin-document-components.json` | `components` → national components; `profiles.kudus_class_teacher`, `kudus_subject_teacher` → `admin_document_profiles` in the Kudus package; "Standar SIGRAK" (D-278) → national default profile | Components and Standar: `national`; Format Kudus: `regency` Kudus, same kind as the Kudus instruments (Q10) | Default profile per role is a `setting`; Kudus schools get Format Kudus as default only if the package is `official` |
| Letterheads, `school_print_settings` (D-031, D-283) | Unchanged: school and teacher settings | — | — |
| `docs/data/taxonomy/facet-a-policy.json` (layers L0–L6), `facet-g-context.json` (`WILAYAH`, `KALENDER-DAERAH`) | Later data task: add nodes for the D-456 layers and lines, mapped to L1–L4 as in §2.1, and `WILAYAH.KECAMATAN` | — | — |
| `docs/data/profiles/sd.json`, `mi.json` (`calendar_source`, `region_province`) | `calendar_source` stays as a hint; the `region_province` entry of a rule set becomes a province package when such a rule set appears | — | — |

**Superseded or refined by this draft** (recorded in D-466): D-256 copy model and `calendars.source_calendar_id`/`source_version`/`version` (§3.2, Q1); D-377 two-column `regions` (§2.2); the cross-region opt-in of D-327 (Q11, superseded by D-466); the single-region D-324 variant choice (now `setting` items); `offer_groups` and `mandatory_to_offer` in the catalog file (now `layer_group_rules`).

## 11. Gaps, risks and testing

### 11.1 Gaps

- No official region list as data (Kemendagri and Kemendikdasmen codes, kecamatan); needed before any kecamatan package. The directory has kecamatan names only (9, 16, 21 for Kudus, Jepara, Pati).
- No TKA and AN date dataset; both are mandatory calendar items.
- No registered regional decree for Bahasa Jawa as muatan lokal in Jawa Tengah.
- No Kanwil Kemenag Jawa Tengah madrasah calendar.
- Evidence for the Kudus formats is an owner sample, not a decree.

### 11.2 Risks

| Risk | Mitigation |
|---|---|
| Name clash: the staff role "Koordinator Wilayah" vs the government's kecamatan korwil | UI says "Koordinator Wilayah SIGRAK" in staff screens; schools never see the role name |
| Silent changes to schools when an area package changes | Stamps in documents, impact report, notices; closed years frozen |
| Auto-applied calendar changes moving RPM meetings without the operator's say (D-256 vs D-456, settled by D-466) | Q1; impact notice and D-274 Batalkan for teachers |
| Resolution cost on hot paths (effective days, readiness) | Stamp-keyed cache and shared regional part (§5.4) |
| Wrong region from directory data | Region changes queue for staff; never automatic |
| Too many small packages to maintain | One official package per (domain, area, line, school year); agreements only on request |
| JSONB payloads growing into queryable data | Items stay in domain tables; JSONB only for `evidence`, `source_ref`, proposal payloads |

### 11.3 Testing (Japa, CI on every PR)

**Fixtures:** Jawa Tengah (`33`) → Kudus (`33.19`) → Jati and Dawe; Jepara (`33.20`) with no kecamatan for one school; one SD and one MI school per kecamatan; the converted Jawa Tengah calendar; the catalogs; a sample local agreement in Jati; a Kanwil-style `kemenag` package.

**Unit cases for `LayerResolver`:**

1. National only: result equals the base package.
2. Province addition appears for every regency below; not for Jepara when added at Kudus.
3. Hide of a non-mandatory national item at school: in `hidden`, not in `items`.
4. Hide of a mandatory item: refused by `LayerRules`; if forced into the table (trigger off in test), ignored by the resolver with a warning.
5. Joint leave hidden by the province (5 Jateng dates): effective days 254 / 134 / 120 (D-323).
6. Group minimum: hiding Pramuka with no other kepanduan is refused; across layers, the resolver restores `pramuka`.
7. Local agreement: not applied without a choice; applied with one; ends on region change.
8. Line filter: MI gets `kemenag` and `all`; SD gets `kemendikdasmen` and `all`; same-key line-specific beats `all`.
9. Setting: Kudus variant of S-04 beats national; national `mandatory` setting cannot be overridden.
10. Later national duplicate shadows a school addition (same `match_key`).
11. Item becomes mandatory: hides voided, item back, notice queued.
12. Effective dates: package from 2027/2028 not visible in 2026/2027; `effective_on` mid-year honoured.
13. Missing kecamatan: district layer skipped, warning returned.
14. Stamps: a publish changes the cache key; an unrelated region's publish does not.

**Property-style cases** (seeded random layer stacks, fast-check pinned per D-412/D-422 or a seeded generator): mandatory items are always in `items`; no `item_key` appears twice; every item has a source; `items ∪ hidden ∪ shadowed` covers every active item in scope; resolving twice gives the same result; adding then removing a hide gives the original result; package insertion order does not change the result.

**RLS and tenancy:** `layer_hides`, `school_package_choices` and school-layer `layer_proposals` and packages are school-owned with RLS; tests assert school A cannot read or write school B's rows through the resolver (IDOR test per resource). National and area packages are readable by all schools in scope but writable only by the console role. The resolver runs inside the request transaction after `SET LOCAL` of the tenant (D-429); cached values carry `school_id` in the key.

## 12. Owner answers (2026-11-28, D-466)

The owner accepted all 14 defaults. Recorded in D-466.

| # | Question | Answer |
|---|---|---|
| 1 | Calendar copy model | Yes. D-456 replaces the D-256 copy model; official area changes apply automatically, the operator gets an impact notice, teachers get the D-274 shift preview. |
| 2 | Hiding official regional items | Only items the package marks as not mandatory; kaldik dates are mandatory for the region's schools. |
| 3 | Region codes | Yes. Kemendagri codes as keys, Kemendikdasmen/Dapodik codes alongside; Tim SIGRAK adds the list as data, starting with Jawa Tengah. |
| 4 | Jawa Tengah calendar for MI | Yes, line `all`, until a Kanwil Kemenag calendar exists; a Kemenag package then wins for MI. |
| 5 | Strength of regional calendar dates | Mandatory for the region's schools, except their own STS/SAS (D-379). |
| 6 | Official rules at kecamatan | No; only local agreements. |
| 7 | Evidence for local agreements | Yes; a photo or PDF of the agreement, checked by the approver. |
| 8 | Label for SIGRAK defaults | "Bawaan SIGRAK", so "Nasional" means a government rule. |
| 9 | Bahasa Jawa | Default per kabupaten (Kudus, Jepara, Pati) until a provincial rule is registered. |
| 10 | Kudus formats | Local agreement, opt-in, until a Dinas document is supplied. |
| 11 | Other regions using Kudus formats | No cross-area opt-in (supersedes that part of D-327); the team proposes the package for another area with its own evidence. |
| 12 | Who chooses local agreements | The operator; the principal is notified. |
| 13 | School users proposing for an area | No; they use "Kirim Masukan" and the team proposes. |
| 14 | Region changes from the directory | Apply after staff accept, from the next day; staff may choose the next school year. |

## 13. Follow-ups for final docs

Not changed here; to update when this draft is promoted. These still state D-256 (copy model) or D-327 (cross-region choice) as current:

- `docs/final/data-model.md` line 134 (`calendars`: `source_calendar_id`, `source_version`, `version`, "copied", "Terapkan perubahan wilayah") and line 135 (`calendar_events.source_event_uid`, D-256).
- `docs/final/developer-handbook.md` line 373 (operator copies with "Salin dari kalender wilayah", D-256) and line 641 (status row citing D-256).
- `docs/data/calendar/README.md` line 13 ("schools copy it", D-256).
- `docs/final/product-concept.md` lines 175 and 291 cite D-327 for Supervisi; check that no cross-region variant choice is implied.
- `docs/final/research-digest.md` line 316 cites D-256 as a source for region calendars (still valid as a source; no change needed unless reworded).
