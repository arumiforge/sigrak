---
name: sigrak-session
description: Start and end every work session in the SIGRAK repository the same way across Claude accounts — sync, git identity and hooks, read CLAUDE.md, docs/agent/CONTEXT.md and docs/agent/PROGRESS.md, claim a task on its own branch, record decisions, hand off by updating PROGRESS.md and the task file. Use at the start of every session and before ending one (or when the context is getting long).
---

# Session start and handoff

Follows Fondasi `docs/agent-workflow.md`, adapted to SIGRAK's own layout in `docs/agent/` (`WORKFLOW.md` has the details).

## Start
1. `git fetch origin && git status && git log --oneline -5 origin/main`
2. Git identity and hooks (`.claude/hooks/session-start.sh` does this; check before the first commit):
   `git config --local user.name "Arumi Studios"`, `git config --local user.email "arumiforge@gmail.com"`,
   `git config --local core.hooksPath .githooks`
3. Environment: Node 24 for the app at the repository root (set up in R0-05; commands in `CLAUDE.md` once they exist);
   `scripts/docs-pdf/` only for developer PDFs. Fondasi only when the work needs it (`docs/agent/fondasi-check.md` §1).
4. Read `CLAUDE.md` → `docs/agent/CONTEXT.md` → `docs/agent/PROGRESS.md` → your task file in `docs/agent/tasks/`.
   Read `docs/agent/DECISIONS.md` only when a choice touches an earlier decision.
5. Claim the task in `PROGRESS.md` (`in-progress`, owner label), on a branch `<phase>/<task-id>-<slug>` unless you were
   given one; never use another session's branch. Commit and push the claim first.
6. Tell the user where things stand and what you will do. Never check repository visibility or ask the owner
   to confirm it (D-441).

## During
- Task list for multi-step work; decisions recorded in `DECISIONS.md` as they happen (and `CONTEXT.md` if the stack or a
  convention changes); ask the owner for choices that are theirs.
- Two tasks never edit the same file; shared agent files get small line-level edits.
- Conventional Commits, small and often, pushed often; no AI attribution anywhere. Verify (tests, lint, build,
  screenshots at 360 and 1280 px for UI) before claiming done. PRs into `main`; never merge unless the owner asks.
- Right after opening a PR, set its body again without the tool-added AI footer and read it back (`CLAUDE.md`).

## End
Fill *Result* in the task file and set its status (`review` or `done`); add a short handoff note in `PROGRESS.md`
(trim stale notes); commit, push, open or update the PR. After the merge, delete the task branch on the remote and
locally (D-148). No emails, names, IPs or tokens in the repository.
