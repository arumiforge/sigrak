# R1-05 — Auth, invitations, self sign-up, flexible trial, role switch, minimal staff console

- **Phase:** R1
- **Status:** todo
- **Owner:** —
- **Depends on:** R1-01, R1-02
- **Can run in parallel with:** R1-04, R1-07

## Goal

People sign in on `app.`, `admin.` and `ujian.` with their own guards; operators invite teachers; a teacher can sign up alone and later join their school by invitation of the same email without losing documents; the trial length is a setting per user or per school (D-459).

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- `docs/final/product-concept.md` (roles, access model), `docs/final/data-model.md` (accounts, invitations); decisions D-182, D-183, D-339…D-343, D-459, D-149
- Existing auth in `app/controllers/*/session_controller.ts`, `app/middleware/`, `config/auth.ts`, `tests/functional/auth_areas.spec.ts`

## Output

- Routes in `start/routes/auth.ts`: `/masuk`, `/keluar`, `/lupa-kata-sandi`, `/kata-sandi-baru/{token}`, `/daftar`, `/undangan/{invitation}`, `/akun`, `/ganti-peran`; operator page Guru (invite, resend, cancel).
- Migrations (block `17643300xxxxx`): invitations, trial settings (per user, per school, default from settings), membership public ids.
- Staff console (`admin.`): schools, members, invitations, extend trial; mail through the queue (D-110, D-431).
- Tests: only sign-in, sign-up, reset and invitation acceptance work without a session; joining keeps documents; trial extension per school applies to all its teachers.

## Done when

- [ ] Tests (own test database `sigrak_test_r105`), lint and typecheck pass; IDOR test for every school-owned resource
- [ ] Pages checked at 360 and 1280 px where the task has UI; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
