# R0-02 — Fondasi base setup

- **Phase:** R0
- **Status:** review
- **Owner:** R0-02 agent
- **Depends on:** R0-01
- **Can run in parallel with:** R0-03, R0-04, R0-05

## Goal

Set up the Fondasi base (D-408): the pieces from Fondasi `templates/repo/` and `templates/ai/`, adapted to SIGRAK.

## Read first

- Fondasi `docs/adopting.md` §4, `docs/app-pointer.md`, `docs/visual-assets.md`, `templates/repo/`, `templates/ai/` (attach Fondasi per `docs/agent/fondasi-check.md` §1)
- `docs/fondasi-audit.md`

## Output

- `CLAUDE.md`: Fondasi pointer block, adjusted for D-401 (own copies, check on request; no `fondasi-sync`)
- `AGENTS.md` from the template (keep the pointer to `CLAUDE.md`), `.githooks/commit-msg`, `.github/workflows/commit-policy.yml`, `.claude/hooks/session-start.sh` also sets `core.hooksPath .githooks`
- `.claude/skills/sigrak-session/` from `templates/repo/.claude/skills/app-session/`, pointing at `docs/agent/` (SIGRAK keeps its own file layout)
- `ai/` from `templates/ai/` with `ai/style-guide.md` for SIGRAK (Indonesian SD/MI teachers and pupils, madrasah, Bhinneka, real classrooms; respect rules for religion and dress)

## Done when

- [x] Hook rejects a commit message with AI attribution; workflow passes on the PR (run locally on the branch range; on GitHub once the PR is opened)
- [x] `ai/README.md` queue has the first briefs (login illustration, empty states, loaders)

## Result

Done on branch `r0/r0-02-fondasi-base-setup` (Fondasi commit bc9e391).

- `CLAUDE.md`: Fondasi pointer block adjusted for D-401 (own copies in `docs/data/`, check on request with `docs/agent/fondasi-check.md`, no `fondasi-sync` or `fondasi.lock`), exceptions D-394, D-401, D-402, D-404; section on Conventional Commits and "agents open PRs and never merge unless the owner asks"; UI text row now says `resources/lang/id` instead of Laravel; pointer to the `sigrak-session` skill. Every earlier hard rule kept.
- `AGENTS.md` from the Fondasi template (Codex scope, git rules), keeping the pointer to `CLAUDE.md`.
- `.githooks/commit-msg` from the template, also checking author and committer through `git var` (catches `--author` and `GIT_AUTHOR_*` overrides). `.github/workflows/commit-policy.yml` as in the template. `.claude/hooks/session-start.sh` also sets `core.hooksPath .githooks`.
- `.claude/skills/sigrak-session/SKILL.md` from `app-session`, pointing at `docs/agent/`.
- `ai/` from `templates/ai/`: `README.md` (queue: 001 login painting, 002 empty-state set of six, 003 loaders), `CODEX.md`, `style-guide.md` (SD/MI teachers and pupils, madrasah and public schools, Bhinneka, disabilities, respect rules for religion and dress, cast, base prompt blocks), brief templates, `generated/README.md`, `tools/check_assets.py` (no dark or green variants, painting sets with several names, SIGRAK brand colours).
- `LICENSE` (proprietary, © Arumi Studios, Fondasi text) and `THIRD_PARTY_NOTICES.md` (Noto Naskh Arabic under OFL 1.1, Hugeicons Pro under the owner's licence, docs-pdf tools).

Tested: hook rejects `Co-Authored-By: Claude`, `Claude-Session:` and "Generated with [Claude Code]" messages and a wrong author or committer, accepts a clean message (directly and through a real `git commit`); the workflow's check script passes on `origin/main..HEAD`; `check_assets.py` parses the three briefs and passes on dummy deliveries.

Open questions for the owner:
- The audit lists the `admin.` host as an exception to Fondasi's "admin under `/admin`", but D-408 names only D-394, D-401, D-402, D-404; add it to D-408 or record it separately.
- SIGRAK keeps `docs/agent/PROGRESS.md` and `DECISIONS.md` instead of Fondasi's `docs/progress.md` and `docs/decisions.md`; written in `CLAUDE.md` as SIGRAK's own layout, not yet as a decision.
- The app's asset folders (where `ai/generated/install/img/…` and `css/…` are copied) are fixed in R0-05.
- Making `commit-policy` a required check on `main` is a GitHub setting only the owner can turn on.
