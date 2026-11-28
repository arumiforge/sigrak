# R1-08 — Calendar on the layer model

- **Phase:** R1
- **Status:** todo
- **Owner:** —
- **Depends on:** R1-06, R1-07
- **Can run in parallel with:** R1-09

## Goal

The school calendar resolves national holidays, the official Jawa Tengah calendar and the school's own events through the layer model, with proposals, effective days and conflict checks.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- `docs/drafts/regional-layers.md` §10 (calendar migration); `docs/data/calendar/`; decisions D-252…D-261, D-274, D-323, D-379, D-380, D-466
- Existing skeleton calendar: `app/services/school_calendar.ts`, `app/controllers/school/calendar_controller.ts`, `inertia/pages/school/calendar.tsx`, `tests/functional/calendar.spec.ts`; `P5-03-foundation.md` P5-03i Result (rules only)

## Output

- Migrations (block `17643600xxxxx`) moving calendars onto layer packages (national line, Jawa Tengah official package with line `all`, school layer).
- `/kalender` for every role with source badges, impact notice for operators, shift preview for teachers (D-274), proposals (D-380), effective days per class, conflict checker; console for national holidays and region packages.
- Holiday import after the SKB check (D-254); tests.

## Done when

- [ ] Tests (own test database `sigrak_test_r108`), lint and typecheck pass; IDOR test for every school-owned resource
- [ ] Pages checked at 360 and 1280 px where the task has UI; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
