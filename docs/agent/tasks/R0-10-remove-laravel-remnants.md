# R0-10 — Remove the remaining Laravel material

- **Phase:** R0
- **Status:** review
- **Owner:** r0/r0-10-remove-laravel-remnants
- **Depends on:** R0-03
- **Can run in parallel with:** R0-05…R0-08

## Goal

The owner asked to "hapus semua terkait legacy app, mulai semua dari stack baru" and clarified that "legacy" means the Laravel build; SIGRAK product content stays and is reviewed or reworked step by step. R0-01 and R0-03 already removed the code and the stack docs (D-407). This task removes what was left: pointers that told later tasks to port from tag `laravel-final`, old file paths, Laravel task files, and unmarked Laravel-era decisions.

## Output

- `DECISIONS.md`: D-411; Laravel-era technical decisions marked superseded (D-003, D-013, D-048, D-049, D-053, D-055, D-056, D-064, D-068, D-073, D-081, D-100, D-101, D-116, D-134, D-137, D-163, D-164, D-166, D-167, D-253, D-316, D-343), stack-neutral rules kept as each marker says
- `CONTEXT.md`, `PROGRESS.md` (R1 "build", not "port"; R2 built new; P5-01/P5-02 closed), `cloud-environment.md`, `fondasi-audit.md` (old file paths removed), `tasks/R0-05-spike-skeleton.md`
- `docs/final/developer-handbook.md` + Indonesian source + PDF
- Deleted: `tasks/P5-01-project-scaffold.md`, `tasks/P5-02-server-setup.md`; `tasks/P5-03-foundation.md` kept as history with a note (it holds product defaults used by `open-questions.md`)

## Result

Done on 2026-11-27. Outside the repo, for the owner: tag `laravel-final` can be deleted on GitHub (the session proxy cannot delete tags); the code then remains only in old commits.
