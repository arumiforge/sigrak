# Project Context

Compact reference for agents. Update when the stack or a convention changes; record the reason in `DECISIONS.md`.

## Product

**SIGRAK** (working name): a web app for SD/MI teachers and school leaders. It does AI-assisted content creation (RPM, Bank Soal, LKPD, Quiz Battle, Paket Soal TKA) through one dedicated template per content type (no generic generator), plus school administration and a TKA practice exam (CBT). Teachers never write prompts. Students are records, never users. They only touch the separate exam site, with per-session exam cards. The app is login-only; the public marketing site on `sigrak.com` is server-rendered by the same app (D-435). Each teacher brings their own Gemini **free-tier** keys (several, rotated, at their own risk). No student personal data in prompts (assessment AI too: names are read on the device, essay text goes without student data, D-347).

- Product: `docs/final/product-concept.md`
- Content engine: `docs/final/content-engine.md` · AI layer: `docs/final/ai-provider-engine.md`
- Data model: `docs/final/data-model.md` · Design and UI copy: `docs/final/design-system.md`
- Overhaul (phase R): decisions D-388…D-441 (repository and ops decisions of 2026-11-27: D-423…D-441); Fondasi audit `docs/fondasi-audit.md`, uptake `docs/drafts/fondasi-uptake.md`, update check `docs/agent/fondasi-check.md`. Stack docs (architecture, server setup, coding standards, export and localization, monitoring) are rewritten in R4.
- Religious education (SD six religions, MI Kemenag subjects): `docs/final/religious-education.md` · prepared data: `docs/data/`
- Official rules and guides, SD/MI extract: `docs/data/regulations/` (draft, D-203): 2025 curriculum (structure and JP, deep learning, KKA, kokurikuler, KSP, assessment) and the national standards (SKL 10/2025, Isi 12/2025, Pengelolaan 26/2025, Penilaian 21/2022, Budaya Sekolah Aman 6/2026, CP decree index BSKAP 046/H/KR/2025)
- Master taxonomy (facets A–H) and the regulation registry with relations: `docs/data/taxonomy/` (draft, D-357; Peta Asesmen in P4-19 reuses facet E codes)
- Profil Jenjang per level: `docs/data/profiles/` (read by the policy-profile resolver, D-356, D-378) · calendar data (national holidays, region reference calendars): `docs/data/calendar/` (draft, D-254, D-323)
- Curriculum data: one SIGRAK format, `SIGRAK-SD-2026-R1` / `SIGRAK-MI-2026-R1` in `docs/data/curriculum/sigrak-*.json`; only `curated` subjects are active for teachers; old codes only in the team crosswalk; SD allocation only from Permendikdasmen 13/2025 (D-363…D-366) · SIGRAK catalogs: `docs/data/catalogs/` (D-367)
- Owner's original material: `docs/sources/` (input only; drafts win where they differ)
- Developer handbook (whole process, start here): `docs/final/developer-handbook.md`, PDF `docs/pdf/developer-handbook.pdf` (D-361) · Research digest (check before any research, add after): `docs/final/research-digest.md` (D-362)
- Policy foundation: national policy first, innovation on top; rule strengths, versioned rule sets, Profil Jenjang, master taxonomy (D-352…D-358, `docs/drafts/policy-innovation-layers.md`). Code reads one policy-profile resolver, never config pointers or `if level == mi`; Cek Keselarasan comes with the content core
- The owner's previous app is "the legacy app" / "aplikasi lama"; never use its old brand name (D-360)

Do not invent features beyond these documents.

## Stack (phase R target, D-388…D-405, versions D-412)

Everything is built fresh on this stack at the repository root (R0-05 onwards); nothing is ported from the removed first build (D-407, D-411). Product rules in `docs/final/` and the decision log stay and are reviewed step by step.

- **Backend:** AdonisJS 7, Node 26 LTS, TypeScript strict, modular monolith; one image with process roles `web` (`app.` + `admin.`), `exam` (`ujian.`), `worker-ai`, `worker-exports`, `worker-default`, `scheduler` (D-388). BullMQ on Redis; SSE through Transmit for AI progress and chatbot streaming. Tests in Japa.
- **Database:** PostgreSQL 19 with pgvector, JSONB, row-level security as a second tenancy wall; WAL archiving to R2 for point-in-time recovery (D-398, D-412). PgBouncer in transaction pooling: set the RLS tenant context with `SET LOCAL` inside each transaction, never per session (D-429).
- **Versions:** always the latest LTS or stable, pinned exactly, updated by bot PRs; x.0 only in development (D-412). Package manager pnpm 12, pinned in `package.json`; install scripts only for allowed packages, new versions wait one day (D-422). App releases use CalVer `YYYY.M.PATCH` (D-420).
- **Frontend:** React 19 + Inertia (AdonisJS adapter), React Compiler; no SSR for the app, public pages server-rendered; SPA feel (persistent layouts, prefetch, deferred props + skeletons, optimistic updates with undo, view transitions) (D-389).
- **UI:** Tailwind 4 + shadcn/ui (Radix) + Motion, Sonner, Vaul, cmdk, TanStack Table + Virtual (Query only for chatbot/search). Hugeicons Pro, Rounded Stroke and Rounded Solid only (D-402, D-434); shadcn/studio Pro blocks (`radix` variants only, restyled), no ProUI, no Aceternity (D-434). Rich identity with Codex-made assets in `ai/` (D-390, F-011, F-022). Fondasi `ui.md` and `feedback.md` apply.
- **AI:** content generation on teachers' own Gemini free-tier keys (D-023, `docs/final/ai-provider-engine.md`); chatbot on the owner's OpenAI-compatible keys, two modes: system Q&A and the school chatbot under the school–parent agreement (D-393, D-394).
- **Documents:** PDF with Typst if the R0-07 spike passes (Gotenberg fallback), A4 default + F4 (D-399, F-020). Excel/CSV/Word exports keep Indonesian labels (D-150, F-012).
- **Exam site:** `ujian.` with its own guard, low-priority add-on (D-392).
- **Python:** only when needed (data processing), in its own folder with pinned dependencies.

## Infrastructure (D-391, D-400, D-403…D-405, D-413…D-418, D-423…D-432, D-436, D-440)

- Production VPS 12 vCPU / 32 GB / SSD 200 GB, Ubuntu 26.04 (D-413), Docker for everything, NAT without public IP, Cloudflare Tunnel (`cloudflared`), SSH and `admin.` behind Cloudflare Access (D-088). Staging is its own Compose project on the same VPS. Cold standby VPS of the same spec, restored from backups (Fondasi `setup.sh`/`check.sh`, one tunnel per VPS).
- nginx 1.30 in front of the app, one per environment (D-414). One `deploy/compose.yaml` for production and staging; replicas per process role, one Node process per container (D-415). Setup flow, SSH keys, Cloudflare Access and tmux rules: D-416…D-418 and the Indonesian guides in `docs/server/` (D-419).
- Repository: `arumiforge/sigrak` (private, clean history, D-423); image `ghcr.io/arumiforge/sigrak`.
- Domains: `sigrak.com` marketing served by the app (D-435), `app.sigrak.com` one app for all levels, `ujian.`, `admin.`, `status.` (Better Stack), `note.` (private notes on Cloudflare Workers, D-436); ops hostnames one level deep behind one Access application "SIGRAK ops" (D-425); first scope SD/MI only, SMP/MTs scoped after SD/MI is finished (D-396).
- Ops (R3): Ubuntu Pro (D-424); Portainer CE for view/restart/logs only (D-425); Better Stack outside + heartbeats, Uptime Kuma inside, Netdata, alerts to Telegram and Slack (D-426); CrowdSec, WAF rules, Lynis, auditd (D-427); Renovate, Trivy, gitleaks, SHA-pinned Actions (D-428); PgHero, pgtune (D-429); Backrest, bucket locks, monthly restore drill (D-430); Plane CE as switchable `sigrak-plane` (D-440).
- Files with pupils' personal data on the VPS disk in Indonesia; R2 for non-personal files and encrypted backups (D-400). Backups 7 days local, 30 days on R2, monthly copies to the owner's disk and a second provider (D-404). RPO ≤ 5 min, RTO ≤ 1 h (D-405). Errors in self-hosted GlitchTip (D-403).
- Claude cloud sessions: `.claude/cloud/setup.sh` and `docs/agent/cloud-environment.md` (Node 26, PostgreSQL 19, Redis, Typst, k6).
- Secrets: `stack.env` on the server + password manager, never in git (F-005). Mail: Gmail SMTP, transactional only, provider-neutral code (D-110, D-431). Integrations are set in the admin panel when env is empty (F-005, D-431); core secrets stay in env. No Firebase; Web Push (D-397).

## Conventions

- Naming in English: classes, methods, variables, tables, columns, route names, config keys.
- URL paths people see are Indonesian, plain and kebab-case (`/masuk`, `/dokumen/{document}`); route names stay English (`login`, `documents.show`) (D-149).
- Database: plural snake_case tables and columns in English.
- Exports (Excel/CSV/Word/PDF) and generated PDFs: Indonesian labels. Map English field names to Indonesian through translation keys, e.g. `export.columns.created_at` → "Tanggal Dibuat". Imports read the same Indonesian headings and labels back (D-150).
- Dates/numbers in exports and UI: Indonesian format (`d/m/Y`, `1.234.567,89`, `Rp`). App timezone is `Asia/Jakarta` (WIB) for storage and display (D-165).
- Maps: MapLibre + PMTiles; pupils at desa level at most, counts under 5 shown as "<5" outside the school's own view (D-437).
- Tests: **Japa** (D-388), run by **GitHub Actions** on every PR to `main` (D-084). Code rules come with R4.
- Migrations are forward-only (D-085).
- No AI attribution anywhere (see `CLAUDE.md`). Commits are authored by the owner; only `main` stays as a branch (D-148).
