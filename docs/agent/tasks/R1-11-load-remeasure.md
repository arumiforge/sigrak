# R1-11 — Load re-measure with a real page and RLS

- **Phase:** R1
- **Status:** todo
- **Owner:** —
- **Depends on:** R1-08
- **Can run in parallel with:** —

## Goal

Repeat the R0-08 measurement with the first real R1 page (calendar on the layer model) behind RLS and `SET LOCAL`, as D-467 requires.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- `docs/drafts/r0-gate.md`, `spikes/k6/README.md`; decisions D-429, D-467

## Output

- Updated k6 scripts for the R1 pages; results appended to `docs/drafts/r0-gate.md` (new section "R1 re-measure") with a comparison table and any regressions.

## Done when

- [ ] Tests (own test database `sigrak_test_r111`), lint and typecheck pass; IDOR test for every school-owned resource
- [ ] Pages checked at 360 and 1280 px where the task has UI; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
