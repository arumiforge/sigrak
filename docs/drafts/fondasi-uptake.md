# Fondasi uptake

What SIGRAK takes from `arumiforge/fondasi` and what the owner decides. SIGRAK keeps its own copies and adjustments; changes come in on a developer's request through [`docs/agent/fondasi-check.md`](../agent/fondasi-check.md) (D-401). Audit of the repository: [`docs/fondasi-audit.md`](../fondasi-audit.md).

**Last checked:** 2026-11-27, Fondasi `bc9e391` (F-001…F-034). No change since the previous check.

## Take from Fondasi

### Rules (apply in the rewrite; D-408)

| Fondasi | What SIGRAK does | Phase |
|---|---|---|
| F-002, F-004, F-008 server flow, one tunnel per VPS, labels | Main and standby VPS prepared with `setup.sh`/`check.sh`; failover moves hostnames between tunnels | R3 |
| App contract (`app-contract.md`) | `/opt/apps/sigrak/{src,staging,production}`, ports 8100–8199 on 127.0.0.1, one Compose project per environment, healthchecks, log rotation, `check-app` adapter, `PORTS` lines | R3 |
| F-005 settings | Standard env names, env wins over the panel, `stack.env` mode 600, "Coba koneksi", audit of panel changes | R1/R3 |
| F-006 storage | VPS disk default; R2 for non-personal files and encrypted backups (D-400) | R1/R3 |
| F-009 conventions | Commit-msg hook, commit-policy workflow, `AGENTS.md`, Conventional Commits | R0-02 |
| F-010, F-022 UI, decoration | "Never" list, all states at 360 px, skeletons, page usable before decoration (icons: exception D-402) | R0 spike, R1 |
| F-011 Codex visual assets | `ai/` from `templates/ai/` with SIGRAK's `style-guide.md` | R0-02 |
| F-012 Indonesian for users | UI, exports, file names, emails in plain Indonesian | all |
| F-013 web baseline | Security headers, cookies, CSRF, rate limits, staff 2FA, ownership checks, uploads, UU PDP, audit log in Indonesian, `/healthz`, closed staging | R1 |
| F-014 feedback tiers | Sonner toasts and undo per tier, error summary, dialogs only for irreversible actions | R1 |
| F-017 agent workflow | A `sigrak-session` skill adapted from `templates/repo/.claude/skills/app-session/` | R0-02 |
| F-018 assets | Hashed, self-hosted, minified served copies; originals kept | R0 spike |
| F-019 AI assistant | Provider rotation with failover, resting on errors, limits, masking (school chatbot: exception D-394) | R1/R2 |
| F-020 printing, QR | A4 default + F4; unique QR tokens with logo at level H | R0 spike (Typst), later slices |
| F-021 guides | `/panduan` per role in the GitHub Docs pattern | later slice |
| F-023 school data | Agreement versions, permissions per field group, audit of sensitive views (Buku Induk P4-01, school chatbot D-394) | later slices |
| Skills | `bahasa-indonesia-plain`, `fondasi-ui`, `fondasi-feedback`, `fondasi-web`, `fondasi-ai`, `fondasi-visual`, `fondasi-server` used by attaching Fondasi | all |

### Data sets SIGRAK keeps a copy of

| Fondasi set (version) | SIGRAK copy | State |
|---|---|---|
| `libur-nasional` (2026-09-15) | `docs/data/calendar/national-holidays-2026-2027.json` | match (Fondasi audit) |
| `kaldik-jateng` (2026-09-15) | `docs/data/calendar/region-jawa-tengah-2026-2027.json` | same source PDF, same reading |
| `kaldik-madrasah-jateng` (2026-06-29) | none | candidate: MI schools in Jawa Tengah follow the Kanwil calendar |
| `mapel` (2025-09-22) | `docs/data/regulations/curriculum-structure-permendikdasmen-13-2025.json`, `docs/data/curriculum/mi-allocation-kma-1503-2025.json` | Bahasa Inggris transition applied (D-410, R0-04); F-031 errata still to check |
| `capaian-pembelajaran` (2026-06-11) | `docs/data/curriculum/cp-*.json` | SD religion A–C identical; Fondasi adds special-education religion CP (D-155 can take it) |
| `kerangka-tka` (2026-03-06) | `docs/data/tka/kerangka-tka-sd.json` | Fondasi adds sample questions with attribution (F-033, F-034) and 2026 category limits marked secondary; candidate for the TKA add-on |
| `sekolah` (2026-11-26) | `docs/data/schools/{pati,kudus,jepara}.json` | subset; SIGRAK has coordinates Fondasi lacks (R-17 planned) |
| `wilayah` (2026-02-13), `kodepos` (2025-06-30) | none | candidate for school addresses (F-013 identity fields) |
| `tahun-ajaran` (2026-11-25) | none | candidate for academic-year rules |
| `skema-siswa` (2026-11-25) | none | candidate for Buku Induk (P4-01) |

## Owner must decide

| Item | Fondasi | SIGRAK | Status |
|---|---|---|---|
| Reference data delivery | F-003 `fondasi-sync` pinned in `fondasi.lock` | Own copies, check on request | decided: exception D-401 |
| Icons | F-010 Lucide | Hugeicons Pro | decided: exception D-402 |
| Local backup retention | 14 days | 7 days local + 30 off-site | decided: exception D-404 |
| AI assistant scope | F-019 app content only | School chatbot on school data under agreement | decided: exception D-394; parents use the public chatbot without AI (D-443) |
| Bahasa Inggris SD/MI | F-031 transition (compulsory from 2027/2028) | was D-387 | decided: follow Fondasi, D-410 |
| Encrypted backups outside Indonesia | F-006 personal data in Indonesia | Encrypted backups on R2 and a second provider (D-404) | handled offline by the developer with the relevant parties (D-444) |
| Fondasi repository visibility | `CLAUDE.md`: stays private | was public on 2026-11-27 | owner's action (D-409) |
| School chatbot data processors | F-013 / F-023: nothing sensitive to AI without terms | D-394 sends school data to the owner's OpenAI-compatible providers | open: which providers may receive it, under which data-processing terms, masking of names first |
| Ubuntu 26.04 on the servers (D-413) | `server/setup.sh` warns and `check.sh` fails on versions other than 24.04 | Ubuntu 26.04 LTS on production and standby | owner's own Fondasi work (D-421); SIGRAK's server notes cover 26.04 meanwhile |
| Staff console host and agent file layout | Fondasi templates: `/admin` path, `docs/progress.md`, `docs/decisions.md` | `admin.` hostname (D-010, D-388), `docs/agent/` files | open: record as exceptions (proposed) or move |
