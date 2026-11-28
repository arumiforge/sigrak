# Progress

Single source of truth for what is happening. Keep it short: move finished phases to `archive/` when they stop being useful.

Status values: `todo` · `in-progress` · `blocked` · `review` · `done`.
Owner = branch name or session label of whoever claimed the task.

## Current phase

**Phase R — total overhaul (perombakan total) is active** (2026-11-27, D-388…D-410). SIGRAK is rebuilt on AdonisJS 7 + Inertia React 19 + PostgreSQL 19 following Fondasi. Feature freeze for ~8–12 weeks (D-406): Phase 5 is paused and its slices are rebuilt after R1. The Laravel app and the stack-specific docs were removed (D-407) and nothing is ported from them: everything is built fresh on the new stack; SIGRAK product content stays and is reviewed step by step (D-411). Decisions now run to D-468 (D-468: R0 gate passed, R1 starts; D-458…D-467: owner interview of 2026-11-28, second part — curriculum, marketing site, Plane, logo, worker_threads, ops guides, layer model details, R0-08 results; D-456: one layer model national→province→kabupaten/kota→kecamatan→school; D-457: Plane masking removes KK and NUPTK too, UU PDP handling offline; D-455: Plane masking removes only NIK and phone numbers; D-454: school names may go to Plane, lighter masking; D-453: Plane integration choices; D-452: data decisions from the RS-15 pre-check, supersedes D-208; D-451: AI job runtime from R0-06; D-450: Typst is the PDF engine; D-445…D-449: owner interview of 2026-11-27, second part; D-441: agents never check repository visibility; D-442: cloud sessions use the container's full capacity; D-443: parents use the public chatbot without AI; D-444: legal checks handled offline). **Repository:** since 2026-11-27 SIGRAK lives in the private `arumiforge/sigrak` with a clean history (D-423); PR numbers up to #94 below and in task files refer to the previous repository, PR numbers in `arumiforge/sigrak` start again at #1. The owner interview of 2026-11-27 is recorded as D-423…D-441 (Ubuntu Pro, Portainer and ops hostnames, monitoring, hardening, supply chain, PgBouncer, backups, mail and integration settings, ops docs, decision-log pruning, UI kits, marketing site on the VPS, notes site, maps, HaKI, problem-to-solution teams, Plane). Earlier: pnpm D-422; versions, Ubuntu 26.04, nginx, Compose, server access, tmux, server guides in Indonesian, CalVer, Fondasi left to the owner: D-412…D-421). Server guides: `docs/server/` (PRs #88, #89); owner's handbook: `docs/handbook/index.html` (PR #90; update it with every decision that changes it).

**Phases 0–3 are done** (2026-11-01). All approved docs are in `docs/final/` with Indonesian PDFs in `docs/pdf/`. Decisions run D-001…D-234, D-240…D-372, and D-377…D-387 (D-185…D-202 unused; D-235…D-239 reserved; D-373…D-376 were reserved for a parallel session and stay unused). D-252…D-328 are the legacy app upgrade (P4-13, `docs/drafts/legacy-upgrade-01.md`). On 2026-11-11 four parallel sessions were merged: P4-24 (with P4-05, P4-14, P4-20; PR #70), P4-22 (PR #71), P5-03i…l (PR #72), P4-23 (PR #73). No running tasks. P4-01 (Buku Induk and Dapodik sync) is on hold as upcoming (D-161). **Next:** P5-04 (content core); in parallel P4-29…P4-31 (curation), P4-19 (Peta Asesmen on facet E), and P4-32 once the owner supplies the PDFs. Every undecided point, with the default in use, is in `docs/drafts/open-questions.md`.

## Open decisions blocking work

- Owner interview on the remaining open points (started 2026-11-27): `docs/drafts/open-questions.md` and the open rows of `docs/drafts/fondasi-uptake.md`. Settled: parents use the public chatbot without AI (D-443); legal checks are handled offline by the developer (D-444); the cloud environment uses the plain `sigrak` setup line (checked 2026-11-27).

## Phases

### Phase 0 — Repository conventions · done

| ID | Task | Status | Owner | Depends on | Output |
|---|---|---|---|---|---|
| P0-01 | No-attribution rule | done | pw/amazing-hawking-dn7dfo | — | `CLAUDE.md`, `.claude/settings.json` |
| P0-02 | Language, stack, docs structure, agent workflow | done | pw/amazing-hawking-dn7dfo | P0-01 | `CLAUDE.md`, `docs/` |
| P0-03 | Owner commit identity, one `main` branch, Indonesian URLs | done | main | D-148, D-149 | `CLAUDE.md`, `.claude/`, `docs/agent/`, rewritten history |

### Phase 1 — Product concept docs · done

| ID | Task | Status | Owner | Depends on | Output |
|---|---|---|---|---|---|
| P1-01 | Archive owner sources + owner interview | done | pw/eloquent-shannon-9iwufg | — | `docs/sources/`, D-007…D-021, D-023…D-037 |
| P1-02 | Product concept | done | pw/eloquent-shannon-9iwufg | P1-01 | `docs/final/product-concept.md` |
| P1-03 | Content engine (templates, wizard, games, TKA, export) | done | pw/eloquent-shannon-9iwufg | P1-01 | `docs/final/content-engine.md` |
| P1-04 | AI Provider Engine | done | pw/eloquent-shannon-9iwufg | P1-01 | `docs/final/ai-provider-engine.md`, D-022 |
| P1-05 | Data model | done | pw/eloquent-shannon-9iwufg | P1-02…P1-04 | `docs/final/data-model.md` |
| P1-06 | Design system and UI writing | done | pw/eloquent-shannon-9iwufg | P1-01 | `docs/final/design-system.md` |
| P1-07 | Religious education curriculum (SD religions, MI Kemenag) | done | pw/eloquent-shannon-9iwufg | P1-05 | `docs/final/religious-education.md`, `docs/data/curriculum/` |
| P1-08 | Finish KMA 1503/2025 (MI allocation) + collect open questions | done | p1/p1-08-mi-allocation | P1-07 | `docs/data/curriculum/mi-allocation-kma-1503-2025.json`, `docs/drafts/open-questions.md`, D-038 |

Approved 2026-10-31 (D-123); moved to `docs/final/` in P3-01.

### Phase 2 — data and technical docs · done

Ran in parallel sessions and was integrated on `p2/p2-00-integration`. Decisions from the task outputs are D-039…D-085.

| ID | Task | Status | Owner | Depends on | Output |
|---|---|---|---|---|---|
| P2-01 | Verify SD religion CP transcription | done | p2/p2-01-verify-religion-cp | — | `docs/data/curriculum/cp-pendidikan-agama-sd-bkpdm-020-2026.json` |
| P2-02 | Structure MI CP data, retype Arabic | done | p2/p2-02-mi-cp-structure | — | `docs/data/curriculum/cp-pai-bahasa-arab-mi-sk-dirjen-9941-2025.json` |
| P2-03 | TKA SD/MI framework seed data | done | p2/p2-03-tka-framework-data | — | `docs/data/tka/kerangka-tka-sd.json` |
| P2-04 | Architecture overview | done | p2/p2-04-architecture | — | `docs/final/architecture.md` |
| P2-05 | Server setup guide | done | p2/p2-05-server-setup | — | `docs/final/server-setup.md` |
| P2-06 | Coding standards | done | p2/p2-06-coding-standards | — | `docs/final/coding-standards.md` |
| P2-07 | Export and localization guide | done | p2/p2-07-export-localization | P2-06 | `docs/final/export-localization.md` |
| P2-08 | Server monitoring and alerts | done | p2/p2-08-server-monitoring | P2-05 | `docs/final/server-monitoring.md` |
| P2-09 | TP and ATP for five SD religion subjects | review | p2/p2-01-verify-religion-cp | P2-01 | `docs/data/curriculum/tp-atp-pendidikan-agama-sd-2026.json` |
| P2-10 | TP and ATP for five MI Kemenag subjects | review | p2/p2-01-verify-religion-cp | P2-02, P2-09 | `docs/data/curriculum/tp-atp-pai-bahasa-arab-mi-2026.json` |

### Phase 3 — final docs · done

| ID | Task | Status | Owner | Depends on | Output |
|---|---|---|---|---|---|
| P3-01 | Move approved drafts to final + Indonesian PDFs | done | p3/p3-01-final-docs-pdf | D-123 | `docs/final/*.md`, `docs/pdf/*.pdf` |
| P3-02 | PDF build script + rebuild outdated PDFs | done | p3/p3-02-pdf-build-script | P3-01 | `scripts/docs-pdf/`, `docs/pdf/*.pdf` |
| P3-03 | Move server monitoring to final + Indonesian PDF | done | main | D-143 | `docs/final/server-monitoring.md`, `docs/pdf/server-monitoring.pdf`, `docs/pdf/server-setup.pdf` |

Later candidates (not yet tasks): curriculum data fixes (Seni Musik and Seni Rupa JP to the D-458 tracks in P4-30; Tata Boga JP is set by the school, D-458; Matematika K4 S2 and the religion/MI TP↔fokus links were fixed in RS-17) · TP/ATP/fokus/JP for five religions and five MI subjects (reviewed by Tim Validasi SIGRAK, D-113) · import support for `ALOKASI-MI-KMA-1503-2025`.

### Phase 4 — add-on designs · on hold

| ID | Task | Status | Owner | Depends on | Output |
|---|---|---|---|---|---|
| P4-01 | Buku Induk and Dapodik sync design | blocked (upcoming, D-161) | main | D-157, D-158 | `docs/drafts/buku-induk-dapodik.md` |
| P4-02 | Game kelas: IFP learning mode for SD/MI (benchmark + design) | done | sky/inspiring-volta-3bdmuq | D-011, D-014, D-158 | `docs/final/ifp-classroom.md`, `docs/pdf/ifp-classroom.pdf` |
| P4-03 | Official documents (`docs/dokumen-resmi/`) → SD/MI data | done | p4/p4-03-dokumen-resmi-data | — | `docs/data/regulations/`, `docs/drafts/dokumen-resmi-sd-mi.md` |
| P4-03b | Apply P4-03 findings to `docs/final/` + Indonesian PDFs | done | p4/p4-03b-final-docs | P4-03, D-203…D-209 | `docs/final/{content-engine,data-model,product-concept,religious-education}.md`, `docs/pdf/` |
| P4-04 | Class and school administration features for SD/MI (research + recommendations) | done | p4/p4-04-administration-features | D-009, D-158 | `docs/drafts/administration-features.md`, D-210…D-221 |
| P4-05 | (Do together with P4-14, P4-20, P4-24 as one docs consolidation task; also apply D-352…D-372: TKA levels D-371 and Pindai LJK/uraian D-369, D-370 in content-engine and data-model `exam_results`, KBC for SD D-368 in religious-education, and handbook §12.1.) Update final docs and glossary for the 2025–2026 rules and P4-04 choices ("murid", rapor 12 components, ekskul, JTM) + PDFs (the P4-03 §10 list is already applied by P4-03b) | done | p4/p4-final-docs-sync | D-210…D-221, P4-03b | `docs/final/*.md`, `docs/pdf/` |
| P4-06 | Design: assessment and rapor extensions (KKTP, diagnostic, remedial/enrichment, item analysis, kokurikuler assessment, 12-component rapor, catatan wali kelas, reflection, portfolio, kenaikan, kelulusan) | todo | — | D-213, D-214, D-215, P4-05 | Draft feeding P5-08 |
| P4-07 | Design: class and homeroom extensions (absence warning, class agreement, 7 KAIH, parent messages, home visits, health data, ekskul and Pramuka, tabungan, effective weeks) | todo | — | D-214…D-216, D-219 | Draft feeding P5-07 |
| P4-08 | Design: principal, operator, supervisor administration (supervisi PM, bukti kinerja, pembagian tugas and JTM SK, budaya sekolah aman, mutasi, inventaris sekolah, supervisor recap and mentoring) | todo | — | D-212, D-217, D-221…D-225, P4-12 | Draft feeding P5-09 |
| P4-09 | Design: console mapping of core vs add-on per feature | todo | — | D-211 | Draft feeding P5-10 |
| P4-10 | Design: e-Rapor SD and RDM export | todo | — | D-218, P5-08 | Draft |
| P4-11 | Design: Penyusun KSP and evaluasi KSP (after v1) | todo | — | D-209, D-217 | Draft |
| P4-12 | Teacher supervision instruments for SD/MI (map + first draft, principal → guru kelas, guru mapel, wali kelas) | done | p4/p4-04-administration-features | D-217, D-221 | `docs/drafts/teacher-supervision-instruments.md` |
| P4-13 | Legacy app upgrade decisions: usulan-01 (U-01…U-15) + Part B (B-01…B-16) + walk-through gaps, owner interviews in six parallel sessions | done | claude/review-proposal-coverage-tzqbk4 | D-251 | `docs/drafts/legacy-upgrade-01.md`, `legacy-coordination.md`, D-252…D-328 |
| P4-14 | Apply the legacy app upgrade to `docs/final/` and drafts (list in `legacy-upgrade-01.md` §4) + Indonesian PDFs | done | p4/p4-final-docs-sync | P4-13 | `docs/final/*.md`, `docs/pdf/` |
| P4-15 | Curate the usulan-01 catalogs (kokurikuler, ekstrakurikuler, class inventory, form options, administration components) into `docs/data/catalogs/` with SIGRAK names and codes, Tim Validasi review pending (D-305, D-367) | done | sky/optimistic-thompson-2qmlfz | — | `docs/data/catalogs/` |
| P4-16 | LKPD exploration: new LKPD forms (print, no-device, digital, hybrid, new tech), tested 2025–2026 Indonesian SD studies, third-party AR/VR embeds, local context, starter-then-adapt model, risks, clash check | done | sky/determined-bardeen-p9fbn7 | D-024, D-296 | `docs/drafts/lkpd-exploration.md` |
| P4-17 | Internal roles for Tim SIGRAK: role catalogue, editable scopes (region, level, field), access matrix, support access, clash check | done | sky/determined-bardeen-p9fbn7 | D-167, D-314 | `docs/drafts/internal-roles.md` |
| P4-18 | Assessment landscape SD/MI (owner's Master Assessment Landscape) translated to SIGRAK features: map vs existing, Peta Asesmen dataset, instrument templates, five-questions wizard, cautions, phasing; input for P4-06 | done | sky/determined-bardeen-p9fbn7 | P5-08 decisions, D-331 | `docs/drafts/assessment-landscape.md` |
| P4-19 | Design: assessment landscape (Peta Asesmen dataset shape, instrument tags, five-questions wizard, D-346 templates, Wave A) | todo | — | D-344…D-351, P4-18 | Draft + `docs/data/assessment/` |
| P4-20 | Apply D-329…D-351 to `docs/final/` (content-engine LKPD, data-model staff roles and assessment tags, architecture console, product-concept) + Indonesian PDFs | done | p4/p4-final-docs-sync | P4-16…P4-18 | `docs/final/*.md`, `docs/pdf/` |
| P4-21 | Policy foundation and innovation layers: layer model and rule strength, what the government fixes, component classification, regulation versioning, SD/MI Profil Jenjang, master taxonomy | done | sky/optimistic-thompson-2qmlfz | P4-03, P4-04, P4-18 | `docs/drafts/policy-innovation-layers.md` |
| P4-25 | Developer handbook (whole SIGRAK process) + Indonesian PDF (D-361) | done | sky/optimistic-thompson-2qmlfz | D-352…D-360 | `docs/final/developer-handbook.md`, `docs/pdf/developer-handbook.pdf` |
| P4-26 | Research digest of all research so far + Indonesian PDF (D-362) | done | sky/optimistic-thompson-2qmlfz | — | `docs/final/research-digest.md`, `docs/pdf/research-digest.pdf` |
| P4-27 | Remove the legacy brand from current files (D-360) | done | sky/optimistic-thompson-2qmlfz | — | code, data, sources, docs, PDFs |
| P4-28 | SIGRAK curriculum dataset: one format, SIGRAK codes, curation per subject, crosswalk, SIGRAK catalogs (incl. P4-15) | done | sky/optimistic-thompson-2qmlfz | D-140, D-360 (D-363…D-367) | `tasks/P4-28-sigrak-curriculum-dataset.md` |
| P4-29 | Curate the SD core subjects (PP, BIN, MTK, IPAS) with the D-364 checklist (CP vs official decree, TP cover CP, ATP order and JP vs 13/2025, fokus linked to TP, known issues closed, references) | todo | — | P4-23, D-364 | `docs/data/curriculum/sigrak-sd-2026-r1-umum.json` |
| P4-30 | Curate the other SD subjects (SB, PJOK, BIG, BJW, KTB, SSD, KKA) with the D-364 checklist (CP vs official decree, TP cover CP, ATP order and JP vs 13/2025, fokus linked to TP, known issues closed, references) | todo | — | P4-23, D-364 | `docs/data/curriculum/sigrak-sd-2026-r1-umum.json` |
| P4-31 | Curate the religion subjects, SD (PAI, PAKR, PAKT, PAH, PAB, PAKH) and MI (QH, AA, FIK, SKI, BAR), with the D-364 checklist; set `curation.status: curated` with reviewer and date | todo | — | P4-23, D-364 | `docs/data/curriculum/sigrak-*.json` |
| P4-22 | Data: `docs/data/taxonomy/` seed (facets A–H, codes, strengths, crosswalks) + regulation registry JSON, Tim Validasi review | review (Tim Validasi, D-113) | p4/p4-22-taxonomy-seed | P4-21 answers | `docs/data/taxonomy/` |
| P4-23 | Get and extract missing regulations (Permendikdasmen 1/2026, 10/2025, 12/2025, 26/2025, 9/2026, 6/2026; base 12/2024, 21/2022, BSKAP 046/H/KR/2025; verify KMA 512/2026) | done (6 of 10 regulations; the other 4 in P4-32) | `p4/p4-23-missing-regulations` | — | `docs/sources/`, `docs/data/regulations/` |
| P4-24 | Apply accepted P4-21 answers to `docs/final/` (product-concept, data-model, architecture, content-engine) + Indonesian PDFs | done | p4/p4-final-docs-sync | P4-21 answers | `docs/final/*.md`, `docs/pdf/` |
| P4-32 | Add the four regulations P4-23 could not reach (Permendikdasmen 1/2026, 9/2026, Kepmendikdasmen 17/2026, base Permendikbudristek 12/2024): owner fetches the PDFs from an Indonesian connection, team stores them with sha256, extracts SD/MI parts, fills `docs/data/taxonomy/regulations.json` (`pending_p4_23` → false) | done | `p4/p4-32-remaining-regulations` | P4-23 | `docs/sources/`, `docs/data/regulations/`, `docs/data/taxonomy/regulations.json` |

### Phase R — total overhaul · in progress

Scope is SD/MI only; SMP/MTs is scoped after SD/MI is finished (D-396). R0 gate passed on 2026-11-28 (D-468); R1 is running. Later phases are planned, not started; each gets its task files when it starts.

| ID | Task | Status | Owner | Depends on | Output |
|---|---|---|---|---|---|
| R0-01 | Overhaul decisions, Fondasi audit, uptake list, phase R plan, old stack removed, SK sample anonymised | done (PR #79) | r0/r0-01-overhaul-decisions-plan | — | `tasks/R0-01-overhaul-decisions-plan.md` |
| R0-02 | Fondasi base setup (pointer block, AGENTS.md, hooks, commit-policy CI, `sigrak-session` skill, `ai/`) | done (PR #83) | r0/r0-02-fondasi-base-setup | R0-01 | `tasks/R0-02-fondasi-base-setup.md` |
| R0-03 | Remove old-stack passages from the remaining docs + PDFs | done (PRs #81, #82, #84) | r0/r0-03a…c | R0-01 | `tasks/R0-03-purge-old-stack-docs.md` |
| R0-04 | Bahasa Inggris SD/MI transition (D-410) in data and docs | done (PR #80) | r0/r0-04-bahasa-inggris-transition | R0-01 | `tasks/R0-04-bahasa-inggris-transition.md` |
| R0-05 | Spike: AdonisJS 7 + Inertia React skeleton, three guards on three hostnames, `/kalender`, CI | done (PR #87) | r0/r0-05-spike-skeleton | R0-01 | `tasks/R0-05-spike-skeleton.md` |
| R0-06 | Spike: BullMQ AI job with SSE progress | done (accepted, D-468) | igi/dazzling-franklin-5i1w8n | R0-05 | `tasks/R0-06-spike-ai-job-sse.md` |
| R0-07 | Spike: Typst PDF, two weeks (D-399) | done; Typst accepted (D-450) | igi/dazzling-franklin-5i1w8n | R0-01 | `tasks/R0-07-spike-typst-pdf.md` |
| R0-08 | Spike: light k6 run and R1 gate report | done (D-467; gate passed, D-468) | rs/rs-18-layers-r0-08-gate | R0-05…R0-07 | `tasks/R0-08-spike-load-gate.md` |
| R0-09 | Cloud environment for the new stack: setup script (Node 24, PostgreSQL 18 + pgvector, Redis, Typst, k6) and settings doc | done (PR #85) | r0/r0-09-cloud-environment | R0-01 | `.claude/cloud/setup.sh`, `docs/agent/cloud-environment.md` |
| R0-10 | Remove the remaining Laravel material; everything starts on the new stack (D-411) | done (PR #86) | r0/r0-10-remove-laravel-remnants | R0-03 | `tasks/R0-10-remove-laravel-remnants.md` |
| R0-11 | Version and server decisions D-412…D-421; Node 26 + PostgreSQL 19 in the app, CI, compose and cloud setup | done (PR #91) | r0/r0-11-version-and-server-decisions | R0-05 | `tasks/R0-11-version-and-server-decisions.md` |
| R0-12 | pnpm replaces npm (D-422): lock file, supply-chain settings, CI, cloud setup | done (merged in the previous repository) | r0/r0-12-pnpm | R0-11 | `tasks/R0-12-pnpm.md` |
| R0-13 | Move to `arumiforge/sigrak` with a clean history; rename every reference to the old repository name (D-423) | done (PR #1) | r0/r0-13-rename-sigrak | — | import commit on `main`, renamed files |
| R0-14 | Record the 2026-11-27 owner interview: D-423…D-440, CONTEXT, handbook, `rekomendasi-tambahan.md` Keputusan column, follow-up tasks | done (PR #2) | r0/r0-14-owner-decisions | R0-13 | `DECISIONS.md`, `CONTEXT.md`, `docs/handbook/index.html`, `docs/server/rekomendasi-tambahan.md` |
| R0-15 | Licensed assets: Hugeicons Pro (Rounded Stroke and Rounded Solid only, names normalised, `.DS_Store` removed) and the shadcn/studio Pro `radix` blocks the app uses; zips and licence files never committed; `THIRD_PARTY_NOTICES.md` names the licence holder (D-402, D-434) | done (PR #3) | r0/r0-15-licensed-assets | — | `inertia/icons/hugeicons/`, `docs/drafts/shadcn-studio-catalog.md` |
| R1 | Build the foundation (D-468): split into R1-01…R1-11, order and parallel rules in `tasks/R1-00-foundation-plan.md` | in-progress | r1/r1-00-gate-split | R0 gate (passed, D-468) | `tasks/R1-*.md` |
| R1-01 | Tenancy core and RLS (`SET LOCAL` per transaction) | review (merged into the R1 branch) | r1/r1-01-tenancy-rls | — | `tasks/R1-01-*.md` |
| R1-02 | Indonesian copy base and translation checks | review (merged into the R1 branch) | r1/r1-02-lang-id | — | `tasks/R1-02-*.md` |
| R1-03 | Curriculum tables, import, Profil Jenjang, policy-profile resolver | in-progress | r1/r1-03-curriculum | — | `tasks/R1-03-*.md` |
| R1-10 | Runtime settings: AI concurrency, queue-wait alert, worker_threads pool (D-463, D-467) | review (merged into the R1 branch) | r1/r1-10-runtime-settings | — | `tasks/R1-10-*.md` |
| R1-04 | Regions and school directory (NPSN → region) | in-progress | r1/r1-04-regions | R1-01 | `tasks/R1-04-*.md` |
| R1-05 | Auth, invitations, self sign-up, flexible trial, role switch, staff console | in-progress | r1/r1-05-auth | R1-01, R1-02 | `tasks/R1-05-*.md` |
| R1-07 | Layer model core and resolver (D-456, D-466) | todo | — | R1-01, R1-04 | `tasks/R1-07-*.md` |
| R1-06 | Academic year, classes, teaching assignments | todo | — | R1-03, R1-05 | `tasks/R1-06-*.md` |
| R1-08 | Calendar on the layer model | todo | — | R1-06, R1-07 | `tasks/R1-08-*.md` |
| R1-09 | Timetable and draft generator | todo | — | R1-06 | `tasks/R1-09-*.md` |
| R1-11 | Load re-measure with a real page and RLS (D-467) | todo | — | R1-08 | `tasks/R1-11-*.md` |
| R2 | Staff console on `admin.`, built new (D-338…D-343 roles and scopes; new role Peneliti and the Bank Masalah / Bank Praktik Baik flow, D-439; integration settings in the panel, D-431; Kabar, Acara, Cerita Sekolah and legal pages edited here, D-435) | planned | — | R1 | — |
| R3 | Infrastructure per Fondasi and `docs/server/`: `deploy/compose.yaml` with replicas (D-415), nginx config (D-414), `deploy/server/sigrak-setup.sh` and `check-app` (D-416), tmux provisioning (D-418), cloudflared and Cloudflare Access (D-417), R2, backups with pgBackRest (D-404, D-405), GlitchTip (D-403), monitoring, DR runbook and standby VPS on Ubuntu 26.04 (D-413), Renovate (D-412, D-428), CalVer release workflow (D-420); the 2026-11-27 ops decisions: Ubuntu Pro (D-424), Portainer and the "SIGRAK ops" Access application (D-425), Better Stack, Uptime Kuma, Netdata and alerts (D-426), CrowdSec, WAF, Lynis, auditd, chrony, terminal tools (D-427), Trivy, gitleaks, SHA-pinned Actions (D-428), PgBouncer, PgHero, pgtune, Cloudflare caching (D-429), Backrest, bucket locks, monthly restore drill (D-430), SPF/DMARC (D-431), Plane CE as `sigrak-plane` (D-440); proposals still ☐ in `docs/server/rekomendasi-tambahan.md` only after the owner decides | planned | — | R0 gate | split when it starts |
| R4 | New stack docs replacing the removed ones (architecture, server setup, coding standards, export and localization, monitoring, local setup) + update the developer handbook, with Indonesian PDFs | planned | — | R1, R3 | — |
| R5 | Rebuild the Phase 5 slices on the new stack in D-392 order (content core, templates, Di Kelas, assessment, portals, business, chatbot D-393/D-394, TKA add-on last) | planned | — | R1, R2 | — |

### Phase R side tasks (2026-11-27 interview, D-423…D-440) · todo

Each runs in its own session; none started. The phase R line (R0-06…R0-08, R1…R5) continues in parallel.

| ID | Task | Status | Owner | Depends on | Output |
|---|---|---|---|---|---|
| RS-01 | Decision-log pruning, D-001…D-150: tag `decisions-before-prune` first; delete superseded entries, rewrite partly superseded ones to what still applies; never reuse IDs (D-433) | todo | — | R0-14 merged | `DECISIONS.md` |
| RS-02 | Decision-log pruning, D-151…D-330 (D-433) | todo | — | RS-01 (tag) | `DECISIONS.md` |
| RS-03 | Decision-log pruning, D-331…D-440 (D-433) | todo | — | RS-01 (tag) | `DECISIONS.md` |
| RS-04 | Fix references to removed IDs in `docs/final/`, task files and the handbook; move the Phase 0–5 tables of this file to `docs/agent/archive/` (keep open tasks reachable) (D-433) | todo | — | RS-01…RS-03 | `docs/final/`, `docs/agent/` |
| RS-05 | Notes site `note.sigrak.com` (temporarily `*.workers.dev`): Workers static assets in the existing Worker `sigrak-note` (wrangler `name = "sigrak-note"`) with handbook, `docs/server/` guides, runbook; GitHub Action with wrangler on changes to `main`; Actions pinned to SHAs. The owner reports Access on `workers.dev` and preview URLs and both secrets are in place; check before the first deploy (D-436) | todo | — | — | `.github/workflows/`, notes site source |
| RS-06 | Marketing site: sitemap, page drafts and legal drafts (`/syarat-penggunaan`, `/kebijakan-privasi`, `/perlindungan-data-murid` under UU PDP; versioned, "berlaku sejak"); lawyer review before launch, offline by the developer (D-435, D-444) | review (owner answered, D-459, D-460; three small items left in its README) | rs/rs-18-layers-r0-08-gate | — | `docs/drafts/marketing-site.md`, legal drafts |
| RS-07 | Plane integration design: masked worker calls, signed internal webhook endpoint, status back to SIGRAK and the reporter, switch-off and export (D-439, D-440) | review (all owner questions answered, D-453…D-455, D-457, D-461) | rs/rs-18-layers-r0-08-gate | — | `docs/drafts/plane-integration.md` |
| RS-08 | Impeccable (pbakaus/impeccable) review: move useful checks into SIGRAK's UI rules; Fondasi gaps to `docs/drafts/fondasi-uptake.md` (D-434, D-421) | todo | — | — | UI rules, uptake notes |
| RS-09 | Incident runbook, routine maintenance schedule and status-page guide, in Indonesian in `docs/server/` (D-432) | review (owner values filled, D-465; developer placeholders wait for R3) | rs/rs-18-layers-r0-08-gate | — | `docs/server/` |
| RS-10 | Market and competitor research, part 1: continue `docs/final/research-digest.md` §11 (app benchmarks), SD/MI first | todo | — | — | research digest |
| RS-11 | Market research, part 2: differentiation, innovation areas, market gaps; how good practice, research and seminars (Bank Praktik Baik, D-439) become features | todo | — | RS-10 | research digest, draft |
| RS-12 | HaKI materials: philosophy, history (without the legacy brand, D-360), background, guidebook; needs an owner interview on the history; filed after the PT exists (D-438) | todo | — | owner interview | `docs/drafts/haki/` |
| RS-13 | Fundamentals handbook for the owner (several sessions), published on the notes site (D-436) | todo | — | RS-05 for publishing | handbook source |
| RS-14 | Maps spike: MapLibre + PMTiles on R2, desa/kecamatan levels, "<5" rule (D-437) | blocked (boundary data lands in Fondasi first) | — | Fondasi boundary data | spike report |
| RS-15 | Agent pre-check of draft data against official sources: CP, taxonomy and regulation registry, regulation extracts, calendars; flag doubtful items with reason and source location (D-447) | review (82 flags, 9 high; `docs/drafts/data-precheck/README.md`) | igi/dazzling-franklin-5i1w8n | — | flag list per data set |
| RS-16 | Logo brief for Codex in `ai/`: full colour, single colour, negative, 16 px (D-448); both wordmark cases (D-462) | review | igi/dazzling-franklin-5i1w8n | — | `ai/` brief |
| RS-17 | Apply D-452 and the RS-15 fixes to `docs/data/` (official CP text per element, KKA, kepanduan, theme, telaah, AN for MI, "di luar CP" marks, smaller corrections); sync final docs that cite D-208 | done | igi/dazzling-franklin-5i1w8n | RS-15 | `docs/data/`, `docs/final/` |
| RS-18 | Layer model design (D-456): `docs/drafts/regional-layers.md` — data shape for layers, lines, additions and hidden items, resolver order, proposal and approval flow, region from NPSN, UI showing source and layer; first domains: calendar, catalogs, muatan lokal, supervision instruments, document formats | todo | — | — | `docs/drafts/regional-layers.md` |
| RS-19 | CPU-heavy work off the Node event loop: proposal to run Excel/large imports/images/leger in `worker-exports` through a `worker_threads` pool or child processes sized to the container CPU limit, plus replica and `UV_THREADPOOL_SIZE` values per role (D-415) | done (D-463 pool, D-467 starting sizes in `docs/drafts/r0-gate.md` §6; built in R1/R3) | rs/rs-18-layers-r0-08-gate | R0-08 numbers | decision + design note |

### Phase 5 — v1 build · paused (D-406; rebuilt as R5)

Order confirmed by D-162. P5-01 and P5-02 run in parallel. Each slice gets its task file, split into smaller tasks, when it starts.

| ID | Task | Status | Owner | Depends on | Output |
|---|---|---|---|---|---|
| P5-01 | Project scaffold and CI | removed (D-407, D-411; replaced by R0-05) | pw/jolly-fermi-c64iie | — | — |
| P5-02 | Server, staging, and monitoring setup | superseded by R3 (D-411) | — | — | — |
| P5-03 | Slice 1 — Foundation: auth, invitations, schools and roles, academic year and classes, curriculum import, timetable | done except P5-03m (todo, D-383); P5-03i…l in PR #72, owner answers D-379…D-382 in PR #75 | p5/p5-03ij-calendar-timetable-versioning | P5-01 | App code; split in `tasks/P5-03-foundation.md` |
| P5-04 | Slice 2 — Content core: AI provider engine, template engine, RPM, Dokumen Saya, PDF/DOCX export | todo | — | P5-03 (incl. P5-03i) | App code |
| P5-05 | Slice 3 — More templates: Bank Soal, LKPD, Quiz Battle | todo | — | P5-04 | App code |
| P5-06 | Slice 4 — TKA: package template, exam site, sessions, cards, token, results (target: 2028 season) | todo | — | P5-05 | App code |
| P5-07 | Slice 5 — Di Kelas with offline sync, Jurnal from RPM | todo | — | P5-03 | App code |
| P5-08 | Slice 6 — Asesmen: plan, scores, analysis per TP, report cards | todo | — | P5-05 | App code |
| P5-09 | Slice 7 — Portals: principal, operator, supervisor; validation and comments | todo | — | P5-03 | App code |
| P5-10 | Slice 8 — Business: trial, subscriptions, add-ons, manual payment, Mode Contoh | todo | — | P5-03 | App code |

## Start here (next session)

1. Read `CLAUDE.md`, `docs/agent/CONTEXT.md`, and this file. Phase R decisions are D-388…D-410 in `DECISIONS.md`.
2. Fondasi: attach it and check for updates only when a developer asks (`docs/agent/fondasi-check.md`); what SIGRAK took is in `docs/drafts/fondasi-uptake.md`, the audit in `docs/fondasi-audit.md`.
3. Approved product specs: `docs/final/*.md`. Data: `docs/data/`.
4. Only `main` exists. Nothing is ported from the removed Laravel build (D-411). Start any task branch from `main` and delete it after merge.

## Remaining work (not yet tasks)

- **Owner:** Tim Validasi SIGRAK reviews the CP data and the catalogs (`status: draft`, D-113); topics are curated per subject in P4-29…P4-31 (D-364).
- **Docs:** every doc in `docs/final/` has a matching Indonesian PDF, and every translation lives in `docs/pdf/src/` (D-156).
- **Data:** transcribe the special-education religion CP (Lampiran II of BKPDM 020/2026) for the six religions (D-155).
- **Deferred from P5-03i…l (PR #72), each tied to its slice:** the impact preview counts RPM meetings once `meetings` exists (`MeetingImpact` is a no-op, D-261, P5-04); conflict rules for supervision schedules and Agenda & Rapat (D-260, P5-09); Profil Jenjang as a table with console editing and the D-368 switch for SD KBC fields (P5-09); `regulations`, `rule_sets`, `rules` tables, a console for every domain, and Kabar Regulasi (D-354, D-355, P5-09 or own slice); region calendars for other provinces or regencies (data only, D-257); the new `lang/id` keys listed in PR #70 (with their slices).
- **Tim Validasi:** the taxonomy and regulation registry (`docs/data/taxonomy/`), the new regulation extracts, and the calendar data (`docs/data/calendar/`), all `status: draft`.
- **Later candidates:** listed under Phase 2 above, plus a dedicated e-Rapor export (D-144).

## Handoff notes

Short notes for the next agent (newest first, max ~10 lines; delete stale ones). Older notes: `archive/handoff-notes-2026-10-30-to-11-01.md`, `archive/handoff-notes-2026-11-03-to-11-11.md`.

- 2026-11-28 (later) — Session `rs/rs-18-layers-r0-08-gate` (one PR into `main`): RS-18 layer model drafted (`docs/drafts/regional-layers.md`) and answered (D-466); R0-08 k6 scripts in `spikes/k6/` and gate report `docs/drafts/r0-gate.md` (all targets met except AI queue wait, fixed by a setting, D-467); owner interview recorded as D-458…D-467 and applied: curriculum data (D-458, D-464), marketing drafts (D-459, D-460, new parent-notice template), Plane design (D-461), ops guides (D-465), logo brief (D-462), RS-19 (D-463). **Next:** owner reviews R0-06 → R1 gate decision; P4-30 rescales Seni Musik/Rupa JP to the 54 JP tracks; update final docs that still state D-256/D-327 (`regional-layers.md` §13: data-model, developer-handbook, calendar README, product-concept); RS-06 leftovers (form data retention, Game kelas trial length, default trial length, D-389 `/panduan`, product-concept invitation-only line). HaKI interview (RS-12) still postponed.
- 2026-11-28 — PR #8 continued: RS-17 applied D-452 to `docs/data/` and the final docs; owner decisions D-452…D-457 (data, Plane, layer model). Its open owner questions were answered in the later session above.
- 2026-11-27 — Session `igi/dazzling-franklin-5i1w8n` (PR #8): R0-06 in review (D-451), R0-07 done (Typst accepted, D-450); owner interview D-443…D-449; side tasks RS-06, RS-07, RS-09, RS-16 and RS-15 drafted and waiting for the owner (open questions in each draft; RS-15 decisions listed in its README). HaKI interview (RS-12) postponed by the owner. Not started: RS-01 (needs a tag push the session proxy refuses), RS-05 (deploys on merge), RS-08 (external repository).
- 2026-11-27 — Cloud environment check (account `akun-7`): everything as in `cloud-environment.md`; lint, typecheck, format check and 17 tests pass after the CI step `cp .env.example .env && node ace generate:key`. `setup.sh` fixed: it re-downloaded Node 26 every run because `/opt/node22/bin` comes first on `PATH` (now links Node 26 and pnpm into `~/.local/bin`), and it now creates `.env` like CI so `pnpm test` passes right after setup. D-442 recorded: cloud sessions use the container's full capacity.
- 2026-11-27 — PRs #1, #2 and #3 merged; only `main` remains. Next: the R0 spikes (R0-06…R0-08) and the side tasks RS-01…RS-14; R1 maps the Hugeicons files in `inertia/components/icon.tsx`.
- 2026-11-27 — Moved to private `arumiforge/sigrak`: import commit on `main` (copy of the previous `main` at `4bce398`, no old history). PR #1 (R0-13) renames every reference to the old repository name; PR #2 (R0-14, stacked on #1, merge #1 first) records the owner interview as D-423…D-440 and adds side tasks RS-01…RS-14. R0-15: the owner uploaded the licensed zips; assets PR #3. Owner reports done: previous repository and Fondasi private, Worker `sigrak-note` created, Access on `workers.dev` and preview URLs, Cloudflare secrets added. The owner confirmed `arumiforge/sigrak` is private and set up as intended; no further visibility checks are needed.

- 2026-11-27 — PR #91 (R0-11) merged. R0-12: pnpm 12.23 replaces npm (D-422); `pnpm-workspace.yaml` denies `@swc/core`'s install script and holds new versions for one day. ProUI is dropped: shadcn/studio Pro replaces it.
- 2026-11-27 — PRs #86 (R0-10) and #87 (R0-05) merged. R0-11: owner confirmed the relayed proposals ("setuju semua"); D-412…D-421 recorded, app moved to Node 26 + PostgreSQL 19 (tests, lint, typecheck, build pass locally), handbook v3. `rekomendasi-tambahan.md` stays proposals until the owner fills the Keputusan boxes.
- 2026-11-27 — R0-10: owner clarified "legacy" = the Laravel build. D-411: nothing ported from it, tag `laravel-final` no longer a reference, Laravel-era technical decisions marked superseded; SIGRAK content (incl. D-252…D-328) stays for step-by-step review. P5-01/P5-02 task files removed. R0-05 branch received, PR next.
- 2026-11-27 — R0-02, R0-03, R0-04 merged (PRs #80…#84; PR body footers removed). R0-09: cloud environment setup script and settings doc for the owner (`docs/agent/cloud-environment.md`). R0-05 still running. Owner: delete merged remote branches (the session proxy cannot), the repository still showed public at 02:55 UTC.
- 2026-11-27 — R0-01 (branch `r0/r0-01-overhaul-decisions-plan`): owner interview recorded as D-388…D-410; Laravel app and stack docs removed (tag `laravel-final`); SK sample anonymised; `docs/fondasi-audit.md`, `docs/drafts/fondasi-uptake.md`, `docs/agent/fondasi-check.md`; phase R tasks R0-02…R0-08. Next: owner merges and makes both repos private; then R0-02…R0-05 and R0-07 can run in parallel.
