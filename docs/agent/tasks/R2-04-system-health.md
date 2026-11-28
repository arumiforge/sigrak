# R2-04 — Kesehatan Sistem page

- **Phase:** R2
- **Status:** review
- **Owner:** r2/r2-04-system-health
- **Depends on:** R2-01
- **Can run in parallel with:** R2-02, R2-03, R2-05, R2-06, R2-08

## Goal

One console page for the system's state (D-316 content, rebuilt on the new stack): queue sizes and waits, failed jobs with retry, free disk, generations and AI errors per day, last backup time.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R2-00-console-plan.md`, the R2-01 Result (abilities and scope helpers)
- Decisions D-316, D-426, D-451, D-463, D-467; R1-10 Result (`/healthz/queues`, queue-wait alerts, Piscina pool); `app/jobs/`, `start/` queue setup

## Output

- `app/system_health/`: collectors for BullMQ queues (waiting, active, delayed, failed, oldest wait), failed-job list with retry and remove (engineer and owner), disk free on the data volume, generations and AI errors per day (from existing tables), last backup time (read a marker the backup job writes later; show "belum ada" until then).
- Page `/kesehatan-sistem` with deferred sections and auto refresh every 30 s; no alerts here (server monitoring does that).
- Abilities from R2-01 (engineer full, owner full, admin read).
- Tests for each collector with fakes and the retry action's log row.

## Done when

- [x] Tests (own database `sigrak_test_r204`), lint, typecheck, format check pass
- [x] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r2/r2-04-system-health` (from `r2/r2-00-split`). Full suite 413 tests (393 before + 20 new), lint, both typechecks, `prettier --check .` and `node ace build` pass. No migration, no new dependency.

### Built

- **`app/system_health/`** (`#system_health/*`), each collector takes its I/O as a parameter so tests pass fakes:
  - `queues.ts`: per queue waiting (with prioritised), active, delayed, failed, oldest ready wait, threshold and `ok`/`slow` (same rule and thresholds as `/healthz/queues`, D-469).
  - `failed_jobs.ts`: newest failed jobs per queue (25 each), merged newest first; `retryFailedJob` / `removeFailedJob` check the job is still failed, act, and log `job.retry` / `job.remove` (subject `job`, id `<queue>:<job id>`, changes: queue, job name, reason). The page never gets job data: only name, id, attempts, times and the first line of the reason (200 chars, e-mail addresses masked).
  - `disk.ts`: `statfs` of the data volume; a missing folder is measured at its nearest existing parent; tone `ok` / `low` (<15 %) / `critical` (<5 %), colour only, no alert.
  - `daily_activity.ts`: generations (total, succeeded, failed) and AI attempts and errors (`outcome <> 'success'`) per WIB day for 14 days, plus AI error classes over the window; read across schools in `staffReadTransaction` (counts only).
  - `backup.ts`: reads the marker file; JSON `{ "finishedAt": … }` (or `finished_at`), or a bare ISO time, else the file time; no file → "Belum ada".
  - `controllers/system_health_controller.ts`: page plus the two actions.
- **Config** `config/system_health.ts`; env `SYSTEM_DATA_PATH` (default `<app>/storage`) and `BACKUP_MARKER_PATH` (default `<data path>/backup/last-backup.json`), both optional, in `start/env.ts` and `.env.example`.
- **Page** `/kesehatan-sistem` (`start/routes/system_health.ts`): disk and backup cards, queue cards, failed-job table with "Coba lagi" / "Hapus" (confirm dialog; buttons only with `system_health.manage`, a note for view-only staff), daily table with totals and AI error kinds. Every section is a deferred prop (three groups: queues, server, activity) with a skeleton; `usePoll` reloads them every 30 s, plus "Perbarui sekarang". A section that cannot be read (Redis down, missing mount) shows a plain note and is logged at warn level; the rest of the page still loads. Menu item "Kesehatan sistem" under Sistem (`system_health.view`), icon cardiogram (Hugeicons). Copy in `resources/lang/id/system_health.json`; log labels added to `staff.audit.actions.job.*`.
- Abilities as in R2-01: owner and engineer see and act, admin sees only; everyone else gets 403.
- **Tests**: `tests/unit/system_health.spec.ts` (12: queue counts and slow rule with delay, failed list order and per-queue limit, reason summary, disk tones and parent fallback and errors, backup marker formats and fallbacks); `tests/functional/system_health.spec.ts` (8: page per role and deferred props, partial reload with real Redis and no job data leaking, per-WIB-day counts across schools, retry and remove with log rows, admin 403 without change, not-failed or missing job refused without a log row, unknown queue 404). Redis use is limited to the queue DB of the run (5 here).
- Checked with Playwright at 360 and 1280 px, light and dark: no horizontal scroll, confirm dialog as a bottom sheet on phones, retry works end to end, the 30 s poll reloads all sections.

### Deviations

- No `system_health` lang key for role names: the view-only note names "Teknis" and "Pemilik" in its sentence.
- Default `SYSTEM_DATA_PATH` is the app's `storage` folder (it does not exist yet, so the app volume is measured). R3 should set it to the mounted data volume.
- The "recent starts" percentiles stay on `/healthz/queues` only; the page shows sizes and the live oldest wait.
- Screenshots were not added to `docs/screenshots/r2/` (left to R2-09).

### Missing ability keys

None.

### Open questions

- **Team (R3):** the backup job should write `BACKUP_MARKER_PATH` (JSON `{ "finishedAt": "<ISO>" }`) after each successful backup, on a path the `web` container can read; set `SYSTEM_DATA_PATH` to the data volume.
- **Team:** retrying a failed generation step job re-runs a step whose generation is already marked failed; the runner should treat it as stale. Should the page hide "Coba lagi" for `ai` jobs and point to the teacher's own "Coba lagi" instead?
- **Owner:** 14 days of daily numbers and the 15 % / 5 % disk tones are first guesses. Do you want other values?

