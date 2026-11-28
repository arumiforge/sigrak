# R2-02 — Staff 2FA with TOTP

- **Phase:** R2
- **Status:** review
- **Owner:** r2/r2-02-staff-2fa
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

- [x] Tests (own database `sigrak_test_r202`), lint, typecheck, format check pass
- [x] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r2/r2-02-staff-2fa` (from `r2/r2-00-split`). Full suite 402 tests (393 before + 9 new). Lint, both typechecks, `prettier --check .` and `node ace build` pass.

### Built

- **Libraries** (D-422, pinned exactly, both MIT, both published more than a day ago): `otpauth@9.6.0` (RFC 6238, one dependency `@noble/hashes@2.4.0`) and `qrcode-generator@2.0.4` (no dependencies). Neither has an install script.
- **Migration** `1764510000001_add_two_factor_to_staff_users`: `staff_users.two_factor_secret` (encrypted with the app key through `encryption`, never serialized), `two_factor_confirmed_at`, `two_factor_last_step` (replay guard), plus a check that a confirmed account has a secret.
- **`app/staff/two_factor.ts`**: SHA-1, 6 digits, 30 s, ±1 step. A code is used once: the accepted step is stored in one `UPDATE … WHERE last_step < step`, so two requests cannot both use it. Wrong codes are throttled per account, whatever the IP: 5 in 5 minutes block codes for 15 minutes. The functions are `enrolmentFor` (the secret is made on the first visit and kept until confirmed; the QR code is sent as one SVG path, not as HTML), `confirmEnrolment`, `disableTwoFactor` (optional staff only, needs a code), `resetTwoFactor` and `resetTwoFactorFromServer`. Log actions are `staff.two_factor_enable|disable|reset`, subject `staff`.
- **Sign-in**: with 2FA on, a right password only stores a pending sign-in in the session (session id regenerated, 5 minutes) and goes to `/masuk/kode`. The account is signed in only after a right code. Nothing is remembered beyond the session. If the code step finds the pending sign-in expired, the account disabled or the 2FA reset, it sends the person back to `/masuk`.
- **Forced enrolment**: `AuthMiddleware` sends an owner or admin without 2FA to `/akun/verifikasi-dua-langkah` from every admin. route. Only the enrolment form and Keluar are allowed (checked by route name).
- **Pages** (R1-12 shell; lang `two_factor.json`):
  - `/masuk/kode`: the code step (auth layout).
  - `/akun`: the new staff account page, linked from the account menu. It shows the account data and the 2FA status, with "Aktifkan 2FA", or "Matikan 2FA" with a code dialog for optional roles.
  - `/akun/verifikasi-dua-langkah`: enrolment with QR code (always dark on white), manual key with "Salin kunci", and a confirmation code.
  - Staf member page: a "Verifikasi dua langkah" card with "Atur ulang 2FA" (confirm dialog).
  - Log aktivitas: labels for the new actions.
- **`node ace staff:reset-2fa --email`**: server-side reset for when no other owner can do it. It is logged with no staff member (`from: server`).
- **Tests** in `tests/functional/staff/two_factor.spec.ts`: enrolment and encrypted storage, the code step and replay, no or invalid pending sign-in, wrong-code throttle (also across new sign-ins), forced enrolment (pages and a POST blocked, Keluar allowed, optional staff not stopped), turning 2FA off, reset and its log, reset guards, server reset.
- **Test helpers**: `setStaffRoles` gives owner and admin accounts a known authenticator. `login()`/`signIn()` complete the code step on their own, so the existing tests run through the real 2FA flow. `passwordStep`, `currentCode`, `enrolTwoFactor` and `submitTwoFactorCode` are new.
- **Checked with Playwright** at 360 and 1280 px, with no horizontal scroll: forced enrolment, wrong code, Akun on and off, the disable dialog, the code step, the staff page before and after reset, and Log aktivitas.

### Team choices (deviations to review)

- **Reset of Pemilik/Admin accounts needs `staff.manage_high`** (owner only), the same rule as their roles. The task says "Admin … not on themselves". I added this so an admin cannot weaken an owner's sign-in. An admin resets the other ten roles. If the only owner is locked out, use `staff:reset-2fa` on the server.
- **Optional staff can turn 2FA off themselves** with a current code (logged). The task did not cover this case.
- **A reset does not end the staff member's open sessions.** They enrol again at their next sign-in. An owner or admin is sent to enrolment on their next request anyway.
- The demo seeder's owner (`admin@sigrak.test`) now has to enrol on its first sign-in.
- The new runtime dependencies are not listed in `THIRD_PARTY_NOTICES.md`, matching the other npm dependencies, none of which are listed there.
- Small edits to shared files: `start/routes.ts` (one import), `start/routes/staff.ts` (`two_factor` lang namespace), `staff.json` (3 log labels), `staff_controller.ts` (`twoFactor` prop), `console_layout.tsx` (Akun link), `.adonisjs/server/pages.d.ts` (generated).

### Missing ability keys

None. `staff.reset_2fa` (owner, admin) and `staff.manage_high` cover it.

### Open questions

- **Owner:** the wrong-code throttle is per account (5 wrong codes in 5 minutes block for 15 minutes). Someone who knows the password can use it to lock the real person out for 15 minutes at a time. Keep it, or count per account and IP?
- **Owner:** should "Atur ulang 2FA" also sign the staff member out of open sessions? It matters if a device was stolen rather than lost.
- **Owner:** is it acceptable to name example apps in the copy (Google Authenticator, Microsoft Authenticator, 2FAS)?
- **Team (R2-09):** put the new `/akun` page and the 2FA status in the screenshot set. Consider a 2FA column on the Staf list.
- **Team:** the QR code was checked visually only; no QR decoder is installed in the container. A scan with a real phone before release is advised.
