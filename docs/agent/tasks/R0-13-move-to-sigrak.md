# R0-13 — Move to `arumiforge/sigrak` with a clean history

- **Phase:** R0
- **Status:** review (PR #1)
- **Owner:** r0/r0-13-rename-sigrak
- **Depends on:** —

## Goal

Move SIGRAK into the private repository `arumiforge/sigrak` without the old git history (D-423) and remove every reference to the old repository name.

## Output

- `main`: one import commit, an exact copy of the previous repository's `main` at `4bce398`.
- PR #1: cloud setup script finds its own repository root; cloud environment doc, Codex starter prompt, deploy key alias `github-sigrak`, image `ghcr.io/arumiforge/sigrak`, `REPOSITORY` variable in CI; D-409, `PROGRESS.md`, handbook and owner sources name the new repository only; three developer PDFs rebuilt (their link targets carried the old checkout path).

## Result

A case-insensitive grep for the old name and a byte search of all PDFs find nothing. The owner made the previous repository and Fondasi private; the cloud environment uses a transition setup-script line until the move is finished, then the plain `sigrak` line in `docs/agent/cloud-environment.md`.
