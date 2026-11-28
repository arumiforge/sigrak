# R2-04 — Kesehatan Sistem page

- **Phase:** R2
- **Status:** todo
- **Owner:** —
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

- [ ] Tests (own database `sigrak_test_r204`), lint, typecheck, format check pass
- [ ] Pages checked at 360 and 1280 px; all text in `resources/lang/id`
- [ ] Result filled, open questions listed

## Result
