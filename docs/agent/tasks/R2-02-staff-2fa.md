# R2-02 — Staff 2FA with TOTP

- **Phase:** R2
- **Status:** todo
- **Owner:** —
- **Depends on:** R2-01
- **Can run in parallel with:** R2-03…R2-06, R2-08

## Goal

Two-factor sign-in for staff with a 6-digit authenticator code (D-343, D-411): required for Pemilik and Admin, optional for other staff, no recovery codes, reset by an admin and logged.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R2-00-console-plan.md`, the R2-01 Result (abilities and scope helpers)
- Decisions D-343, D-411, D-422 (dependency rules); `app/accounts/` staff sign-in, `start/routes/console.ts`

## Output

- A mature, maintained TOTP library (check D-422 supply-chain rules and pin it); secrets encrypted at rest; migration block `17645100xxxxx`.
- Enrolment page (QR code + manual key, confirm with a code), challenge step after password, remember nothing beyond the session, throttle wrong codes.
- Owner and admin are forced to enrol before any console page; others can enrol from their account page.
- Admin "Atur ulang 2FA" on the Staf page (not on themselves), logged; the user enrols again at next sign-in.
- Tests: enrol, challenge, wrong-code throttle, forced enrolment, reset and its log.

## Done when

- [ ] Tests (own database `sigrak_test_r202`), lint, typecheck, format check pass
- [ ] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
