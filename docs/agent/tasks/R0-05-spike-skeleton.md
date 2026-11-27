# R0-05 — Spike: AdonisJS 7 + Inertia React skeleton

- **Phase:** R0
- **Status:** review
- **Owner:** agent session (branch `r0/r0-05-spike-skeleton`)
- **Depends on:** R0-01
- **Can run in parallel with:** R0-02, R0-03, R0-04, R0-07

## Goal

Prove the stack (D-388, D-389, D-390, D-398) at the repository root with one real page.

## Read first

- `docs/agent/CONTEXT.md`, D-388…D-399
- `docs/final/data-model.md` (calendar and school tables), `docs/final/design-system.md`
- Calendar behaviour from `docs/final/developer-handbook.md` (Kaldik) and `docs/final/data-model.md`; nothing is ported from the removed first build (D-411)
- Fondasi `ui.md`, `feedback.md`, `web-baseline.md`, `assets.md`

## Output

- AdonisJS 7 app at the root (Node 24, TypeScript strict, React 19 + Inertia, React Compiler, Tailwind 4, shadcn/ui), `compose.yaml` for local PostgreSQL 18 + Redis
- Three guards on three hostnames: `app.` (school users), `admin.` (staff), `ujian.` (exam participants), each with its own session cookie
- One real page: the school calendar (`/kalender`), read-only list + month view, Indonesian copy from `resources/lang/id`, works at 360 px
- CI: lint, typecheck, Japa tests, build

## Done when

- [x] Login on each hostname reaches only its own area (Japa tests)
- [x] `/kalender` renders with seeded data and a skeleton while loading

## Result

Built at the root on branch `r0/r0-05-spike-skeleton` (6 commits); setup and commands in `README.md`.

- **Stack:** AdonisJS 7.7 (starter kit `inertia-react`, trimmed), Node 24, TypeScript `strict`, Inertia 3 + React 19 with the React Compiler (Babel preset, confirmed in the build output), Vite 8, Tailwind 4 with the design-system tokens (`inertia/css/tokens.css`, light and dark), shadcn/ui `button` (44 px sizes), `card`, `skeleton`, `sonner` (Fondasi toast placement). `inertia/components/icon.tsx` is the single icon wrapper with placeholder glyphs until Hugeicons Pro arrives (D-402); no icon library is installed. Lucid on PostgreSQL, Redis (sessions, limiter), i18n with `resources/lang/id/*.json`.
- **Hosts:** `config/hosts.ts` (`APP_DOMAIN`, local `sigrak.test`), domain-scoped route groups, guards `web` / `staff` / `exam` on `users` / `staff_users` / `exam_participants`, and `AreaSessionMiddleware` choosing cookie `sigrak_app_session` / `sigrak_admin_session` (SameSite=Strict, 60 min) / `sigrak_exam_session` by hostname. `/masuk` on each host; failed logins throttled per area, account and IP (5 per minute, 5-minute block) plus 30 POSTs per minute per IP. Shield CSP with nonce, HSTS, X-Frame-Options SAMEORIGIN, nosniff; Referrer-Policy, Permissions-Policy and `Cache-Control: no-store` on pages; CSRF via the XSRF cookie; `/healthz` answered before routing on every host (DB + Redis, no cookie).
- **Data:** forward-only migrations for regions, schools, users, school_memberships, staff_users, calendars, calendar_events, national_holidays, and spike subsets of exam_sessions and exam_participants (CHECKs from the data model, partial unique index for one active principal, lower(email) unique). Seeders: national holidays 2026/2027 and the Jawa Tengah region calendar from `docs/data/calendar`, copied into two invented schools; demo users, staff and an exam card.
- **Kalender:** `/kalender` on `app.` shows the signed-in user's school calendar (copied region events, school events, national holidays, joint leave kept as school day) as a month view and a list. The month grid renders at once; the entries are a deferred prop with skeleton rows. Checked with Chromium at 360 px and 1280 px (no horizontal scroll).
- **Tests (Japa, 17 passing locally on PostgreSQL 16 + Redis 7):** guests are sent to `/masuk` on every host; each host's login reaches its own area; staff, school and exam session ids are rejected on the other hosts even when sent under that host's cookie name; credentials of one area fail on another; a closed exam session refuses its card; each host sets only its own cookie; CSRF; login throttle; `/kalender` defers entries and returns only the own school's events; `/healthz`; security headers and cookie flags; unknown host 404.
- **CI:** `.github/workflows/ci.yml` (lint, Prettier check, typecheck, `npm audit --omit=dev --audit-level=high`, tests on `pgvector/pgvector:pg18` + `redis:8-alpine`, build). Not yet run on GitHub.

Open points for the owner and later tasks:

- Exam tables are spike subsets (no student_id, package, token, proctor); the proctor token check is not in the login. Before the first deploy either extend them with new migrations or squash the R0 migrations once (D-085 is forward-only).
- `calendar_events.class_id` waits for the classes table; row-level security (D-398) is not set up yet; a school switcher for users of several schools is not built (the earliest active membership is used).
- Dark-mode status colours (`--ok`, `--warn`, `--danger`, `--info`) are not given in the design system; placeholders were chosen and need a contrast check.
- Staff TOTP (D-343) and staff inactivity logout beyond the 60-minute session age are not built.

