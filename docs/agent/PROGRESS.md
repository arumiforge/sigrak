# Progress

Single source of truth for what is happening. Keep it short: move finished phases to `archive/` when they stop being useful.

Status values: `todo` · `in-progress` · `blocked` · `review` · `done`.
Owner = branch name or session label of whoever claimed the task.

## Current phase

**Phase R — total overhaul (perombakan total) is active** (2026-11-27, D-388…D-410). SIGRAK is rebuilt on AdonisJS 7 + Inertia React 19 + PostgreSQL 18 following Fondasi. Feature freeze for ~8–12 weeks (D-406): Phase 5 is paused and its slices are rebuilt after R1. The Laravel app and the stack-specific docs were removed (D-407) and nothing is ported from them: everything is built fresh on the new stack; SIGRAK product content stays and is reviewed step by step (D-411). Decisions now run to D-422 (pnpm D-422; versions, Ubuntu 26.04, nginx, Compose, server access, tmux, server guides in Indonesian, CalVer, Fondasi left to the owner: D-412…D-421). Server guides: `docs/server/` (PRs #88, #89); owner's handbook: `docs/handbook/index.html` (PR #90; update it with every decision that changes it).

**Phases 0–3 are done** (2026-11-01). All approved docs are in `docs/final/` with Indonesian PDFs in `docs/pdf/`. Decisions run D-001…D-234, D-240…D-372, and D-377…D-387 (D-185…D-202 unused; D-235…D-239 reserved; D-373…D-376 were reserved for a parallel session and stay unused). D-252…D-328 are the legacy app upgrade (P4-13, `docs/drafts/legacy-upgrade-01.md`). On 2026-11-11 four parallel sessions were merged: P4-24 (with P4-05, P4-14, P4-20; PR #70), P4-22 (PR #71), P5-03i…l (PR #72), P4-23 (PR #73). No running tasks. P4-01 (Buku Induk and Dapodik sync) is on hold as upcoming (D-161). **Next:** P5-04 (content core); in parallel P4-29…P4-31 (curation), P4-19 (Peta Asesmen on facet E), and P4-32 once the owner supplies the PDFs. Every undecided point, with the default in use, is in `docs/drafts/open-questions.md`.

## Open decisions blocking work

- Owner: archive or make private the previous SIGRAK repository, and make `arumiforge/fondasi` private (D-409); `arumiforge/sigrak` is private; upload Hugeicons Pro files after that (D-402); may parents use the school chatbot (D-394); lawyer check on encrypted backups abroad (`docs/drafts/fondasi-uptake.md`). Questions with a default in use: `docs/drafts/open-questions.md` (2026-11-11 sections).

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

Later candidates (not yet tasks): curriculum data fixes (Matematika K4 S2, Tata Boga target, TP↔fokus links) · TP/ATP/fokus/JP for five religions and five MI subjects (reviewed by Tim Validasi SIGRAK, D-113) · import support for `ALOKASI-MI-KMA-1503-2025`.

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

Scope is SD/MI only; SMP/MTs is scoped after SD/MI is finished (D-396). Gate with the owner after R0 before R1 starts. Later phases are planned, not started; each gets its task files when it starts.

| ID | Task | Status | Owner | Depends on | Output |
|---|---|---|---|---|---|
| R0-01 | Overhaul decisions, Fondasi audit, uptake list, phase R plan, old stack removed, SK sample anonymised | done (PR #79) | r0/r0-01-overhaul-decisions-plan | — | `tasks/R0-01-overhaul-decisions-plan.md` |
| R0-02 | Fondasi base setup (pointer block, AGENTS.md, hooks, commit-policy CI, `sigrak-session` skill, `ai/`) | done (PR #83) | r0/r0-02-fondasi-base-setup | R0-01 | `tasks/R0-02-fondasi-base-setup.md` |
| R0-03 | Remove old-stack passages from the remaining docs + PDFs | done (PRs #81, #82, #84) | r0/r0-03a…c | R0-01 | `tasks/R0-03-purge-old-stack-docs.md` |
| R0-04 | Bahasa Inggris SD/MI transition (D-410) in data and docs | done (PR #80) | r0/r0-04-bahasa-inggris-transition | R0-01 | `tasks/R0-04-bahasa-inggris-transition.md` |
| R0-05 | Spike: AdonisJS 7 + Inertia React skeleton, three guards on three hostnames, `/kalender`, CI | done (PR #87) | r0/r0-05-spike-skeleton | R0-01 | `tasks/R0-05-spike-skeleton.md` |
| R0-06 | Spike: BullMQ AI job with SSE progress | todo | — | R0-05 | `tasks/R0-06-spike-ai-job-sse.md` |
| R0-07 | Spike: Typst PDF, two weeks (D-399) | todo | — | R0-01 | `tasks/R0-07-spike-typst-pdf.md` |
| R0-08 | Spike: light k6 run and R1 gate report | todo | — | R0-05…R0-07 | `tasks/R0-08-spike-load-gate.md` |
| R0-09 | Cloud environment for the new stack: setup script (Node 24, PostgreSQL 18 + pgvector, Redis, Typst, k6) and settings doc | done (PR #85) | r0/r0-09-cloud-environment | R0-01 | `.claude/cloud/setup.sh`, `docs/agent/cloud-environment.md` |
| R0-10 | Remove the remaining Laravel material; everything starts on the new stack (D-411) | done (PR #86) | r0/r0-10-remove-laravel-remnants | R0-03 | `tasks/R0-10-remove-laravel-remnants.md` |
| R0-11 | Version and server decisions D-412…D-421; Node 26 + PostgreSQL 19 in the app, CI, compose and cloud setup | done (PR #91) | r0/r0-11-version-and-server-decisions | R0-05 | `tasks/R0-11-version-and-server-decisions.md` |
| R0-12 | pnpm replaces npm (D-422): lock file, supply-chain settings, CI, cloud setup | review | r0/r0-12-pnpm | R0-11 | `tasks/R0-12-pnpm.md` |
| R1 | Build the foundation: tenancy (+ RLS), auth and invitations, schools and roles, academic year and classes, curriculum policy (`PolicyProfileResolver`) and import, calendar, timetable, i18n `resources/lang/id` (written fresh from `design-system.md` and `Parafrase_Teks_UI_Sigrak.xlsx`), Japa tests; built new, nothing ported (D-411) | planned | — | R0 gate | split when it starts |
| R2 | Staff console on `admin.`, built new (D-338…D-343 roles and scopes) | planned | — | R1 | — |
| R3 | Infrastructure per Fondasi and `docs/server/`: `deploy/compose.yaml` with replicas (D-415), nginx config (D-414), `deploy/server/sigrak-setup.sh` and `check-app` (D-416), tmux provisioning (D-418), cloudflared and Cloudflare Access (D-417), R2, backups with pgBackRest (D-404, D-405), GlitchTip (D-403), monitoring, DR runbook and standby VPS on Ubuntu 26.04 (D-413), Renovate or Dependabot (D-412), CalVer release workflow (D-420); proposals in `docs/server/rekomendasi-tambahan.md` only after the owner decides | planned | — | R0 gate | split when it starts |
| R4 | New stack docs replacing the removed ones (architecture, server setup, coding standards, export and localization, monitoring, local setup) + update the developer handbook, with Indonesian PDFs | planned | — | R1, R3 | — |
| R5 | Rebuild the Phase 5 slices on the new stack in D-392 order (content core, templates, Di Kelas, assessment, portals, business, chatbot D-393/D-394, TKA add-on last) | planned | — | R1, R2 | — |

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

- 2026-11-27 — PR #91 (R0-11) merged. R0-12: pnpm 12.23 replaces npm (D-422); `pnpm-workspace.yaml` denies `@swc/core`'s install script and holds new versions for one day. ProUI is dropped: shadcn/studio Pro replaces it.
- 2026-11-27 — PRs #86 (R0-10) and #87 (R0-05) merged. R0-11: owner confirmed the relayed proposals ("setuju semua"); D-412…D-421 recorded, app moved to Node 26 + PostgreSQL 19 (tests, lint, typecheck, build pass locally), handbook v3. `rekomendasi-tambahan.md` stays proposals until the owner fills the Keputusan boxes.
- 2026-11-27 — R0-10: owner clarified "legacy" = the Laravel build. D-411: nothing ported from it, tag `laravel-final` no longer a reference, Laravel-era technical decisions marked superseded; SIGRAK content (incl. D-252…D-328) stays for step-by-step review. P5-01/P5-02 task files removed. R0-05 branch received, PR next.
- 2026-11-27 — R0-02, R0-03, R0-04 merged (PRs #80…#84; PR body footers removed). R0-09: cloud environment setup script and settings doc for the owner (`docs/agent/cloud-environment.md`). R0-05 still running. Owner: delete merged remote branches (the session proxy cannot), the repository still showed public at 02:55 UTC.
- 2026-11-27 — R0-01 (branch `r0/r0-01-overhaul-decisions-plan`): owner interview recorded as D-388…D-410; Laravel app and stack docs removed (tag `laravel-final`); SK sample anonymised; `docs/fondasi-audit.md`, `docs/drafts/fondasi-uptake.md`, `docs/agent/fondasi-check.md`; phase R tasks R0-02…R0-08. Next: owner merges and makes both repos private; then R0-02…R0-05 and R0-07 can run in parallel.
