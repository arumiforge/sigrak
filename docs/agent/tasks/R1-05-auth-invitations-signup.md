# R1-05 — Auth, invitations, self sign-up, flexible trial, role switch, minimal staff console

- **Phase:** R1
- **Status:** review
- **Owner:** r1/r1-05-auth
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

- [x] Tests (own test database `sigrak_test_r105`), lint and typecheck pass; IDOR test for every school-owned resource
- [x] Pages checked at 360 and 1280 px where the task has UI; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r1/r1-05-auth` (from `r1/r1-00-gate-split`). 153 tests pass on `sigrak_test_r105` (`REDIS_QUEUE_DB=15`, `REDIS_AI_DB=9`: DB 0 is the main Redis connection's database and the AI tests flush their database, so 9 was used instead). 34 tests are new, in `tests/functional/accounts/`. Lint, typecheck, format check and R1-02's translation tests pass. Screenshots of every new page at 360 and 1280 px were taken with Chromium at deviceScaleFactor 1, and no page scrolls sideways.

**Built**

- **Migrations** `1764330000001…4`:
  - `app_settings` (key → JSONB, seeded `trial.default_days = 7`) and `staff_activity_logs`.
  - `users.email_verified_at`, `users.trial_started_at`, `users.trial_days`, and `schools.trial_days`.
  - `invitations`: hash-only token, 7 days, one open row per school + email + role, RLS through `schoolRls`, plus the narrow `SECURITY DEFINER` function `invitation_school_id(token_hash)`.
  - `password_reset_tokens`: hash only, one per user, 60 min.
  - Membership public ids already existed in the skeleton.
- **`app/accounts/`** (import alias `#accounts/*`):
  - `tokens`: 32-byte base64url token, SHA-256, constant-time compare.
  - `invitations`: invite or renew, resend, cancel, find by token, accept.
  - `sign_up`, `password_reset`, `memberships` (the role list, read in a tenant transaction with the user only).
  - `trial` (rules), `settings` (default trial), `console` (trial changes, logged), `staff_access` (role → ability), `throttles`, `http` helpers.
- **Routes:**
  - `start/routes/auth.ts` (app.):
    - Without a session: `/masuk`, `/daftar`, `/lupa-kata-sandi`, `/kata-sandi-baru/:token`, `/undangan/:token`. The last one works with or without a session.
    - `/keluar`, `/akun` (+ `/akun/kata-sandi`), `/ganti-peran`.
    - Operator only: `/guru`, `/guru/undangan`, `…/:invitation/kirim-ulang`, `…/:invitation/batal`.
  - `start/routes/console.ts` (admin.): `/sekolah`, `/sekolah/:school` (+ invite, resend, cancel, `uji-coba`), `/pengguna` (+ `/:user/uji-coba`), `/pengaturan`.
- **Tenancy adoption (R1-01 decision 7):**
  - Every app. route now runs `auth` + `middleware.school()`. The middleware has a new `{ optional: true }` mode for a teacher without a school: the request runs with `schoolId = null` and only the user's own rows. `/guru` uses the required mode.
  - Calendar and Coba AI read `ctx.membership`. `User.currentMembership()` (an owner-connection read) is removed.
  - Shared Inertia prop `role` (the active membership's role, or null).
- **Mail:**
  - `@adonisjs/mail` 10.4.1 is added. `config/mail.ts` has `smtp` (Gmail, provider-neutral) and `json` (renders, sends nothing; the default outside production).
  - `start/mail.ts` sets a messenger that puts every `sendLater` on the `default` queue as job `send-mail` (`app/jobs/send_mail.ts`). `worker-default` now runs the default registry.
  - Both mails use one layout: `resources/views/emails/action_{html,text}.edge`, with all copy from lang files. Tests use `mail.fake()`. Nothing is ever sent.
- **Pages:**
  - `auth/{sign_up,forgot_password,reset_password,invitation}`.
  - `accounts/{account,switch_role,teachers}`.
  - `console/{schools,school,users,settings}`, a new `ConsoleLayout`, and the admin home moved onto it.
  - The login page links to Lupa kata sandi and Daftar.
  - The app layout gains Guru (operator only) and Akun (user icon).
- **Copy:** new `accounts.json` and `console.json`. `auth.json` is extended (sign-up, reset, links, reset mail), and the outdated `intro.invite_only` is removed. `nav.json` gets `teachers` and `switch_role`. `validation.json` gets a few field names and the password and NIP messages.
- **Tests:**
  - `guest_access`: every app. and admin. route, taken from the router, is closed to a guest except the five public ones.
  - `invitations`: hash only; renewal; resend and cancel; teacher and no-school get 403; an IDOR test over HTTP, the app scope and RLS; new account; expired, unknown and malformed links; a self sign-up joins and keeps its generation and AI key (RLS shows the work to the teacher in the school context, not to the principal); one-click join; another account is refused; password rule; console invite (support), second principal refused, content role 403.
  - `sign_up_and_reset`, `trial` (rules; a school extension reaches all its teachers; an ended personal trial reopens from today; default setting admin-only, logged), `role_switch`, `mail_queue` (job on the queue; worker-default renders and "sends" with the json mailer).
  - `auth_areas` and `calendar` now truncate instead of using a global transaction, because the school middleware reads memberships on the tenant connection.

**Shared files touched:**
- `start/routes.ts`: app. auth routes moved out, the new route files imported, and `auth` + `school({ optional })` on the app group.
- `start/kernel.ts`: not touched. `config/auth.ts`: not touched.
- `start/env.ts`, `.env.example`, `.env.test` (`MAIL_*`, `SMTP_*`), `adonisrc.ts` (mail provider, commands, `#start/mail` preload), `package.json` + `pnpm-lock.yaml` (`@adonisjs/mail`, `#accounts/*`).
- `app/services/queue/worker.ts` (default queue handler), `app/tenancy/school_context_middleware.ts` (optional mode), `app/middleware/inertia_middleware.ts` (`role` prop), `app/models/user.ts`, the calendar and AI demo controllers.
- `database/schema_rules.ts` (`token_hash` hidden, JSONB types), `database/schema.ts` (regenerated only), `.adonisjs/*` (generated).
- `inertia/layouts/app_layout.tsx`, `inertia/components/icon.tsx` (placeholder icons), `inertia/pages/auth/login.tsx`, `inertia/pages/admin/home.tsx`.
- `resources/lang/id/{nav,validation}.json`, `.prettierignore` (the plain-text mail template).
- `tests/functional/{auth_areas,calendar}.spec.ts`.
- Expect a conflict in `database/schema.ts` with R1-03 and R1-04: run the migrations again to fix it.

**Proposed decisions**

1. *Ownership when a self-signed-up teacher joins a school (D-459):* nothing moves or changes owner. Rows made without a school (`school_id` NULL: generations, steps, AI usage, later documents) stay the teacher's. RLS keeps them visible to the teacher in every school context and hidden from other members, the principal included. AI keys stay personal (D-012). Work made under the membership carries the school id; D-307 then applies on transfer. Bringing older work into the school is a later, explicit action.
2. *Trial rule:* the default length is the console setting `trial.default_days` (7). Schools and people may set their own length. When several are set, the longest wins, so a school extension reaches every teacher and is never cut short. The default counts only when nothing is set. The trial starts at sign-up or the first accepted invitation. "Tambah hari" for one person counts from the later of today and the current end, so an ended trial reopens. For a school, it adds days to the school's length. Every change is logged in `staff_activity_logs`.
3. *Invitation lookup before a session:* `invitation_school_id(token_hash)` is a `SECURITY DEFINER` function that answers only with a school id. The row is then read in a tenant transaction of that school, so RLS stays on and no app code bypasses the scope.
4. *Memberships on the tenant transaction:* the app reads and writes memberships only through `tenantTransaction` with an explicit client: active membership, role switch, acceptance, Guru. Staff use `staffTransaction`. `SchoolMembership` does not take the `withSchoolScope` mixin: its "own rows in any school" rule does not fit a fail-closed scope, and seeders and fixtures write it as the owner.
5. *Optional school context:* `middleware.school({ optional: true })` on app. routes lets a teacher without a school use Akun, Kalender (empty) and Coba AI on their own rows. Routes that need a school use the required mode.
6. *Mail through the queue:* the AdonisJS mail messenger sends every mail to the `default` queue (`worker-default`). The `json` mailer is the default outside production.
7. *Minimal console powers until D-339:* admin may do everything here. Support may view schools and members and manage invitations, and sees trials read-only. Content has no access.
8. *Sign-up answers plainly when an email is taken* (sign-up is not neutral; reset stays neutral, D-183).

**Open questions**

1. Should a school's "Tambah hari" also reopen trials of teachers whose trial ended long ago (count from today for all of them)? Today it adds to the school's length, counted from each teacher's own start. Per-person extension reopens from today.
2. What happens when a trial ends? View and download only (Uji coba row) is not enforced yet. It needs the plans and subscriptions slice.
3. Self sign-up leaves `email_verified_at` empty until an invitation or reset link is used. Do we need a confirmation mail at sign-up?
4. Should a joined teacher be able to copy older personal work into the school (so the principal can view it, D-019)?
5. D-431: mail settings from the console when env is empty. Today only env is read. This comes with the console's integration settings.
6. Console URLs use the school's and user's numeric id (staff only). Should schools and users get public ids too?
7. At 360 px the app. header nav already scrolls sideways inside the bar (Kalender, Coba AI, Guru, Akun). The bottom nav from the teacher menus slice should replace it.
8. Supervisors (pengawas) are not invitable yet. The role check stays `principal | operator | teacher` (D-184).
