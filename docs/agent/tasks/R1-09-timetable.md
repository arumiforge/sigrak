# R1-09 — Timetable and draft generator

- **Phase:** R1
- **Status:** review
- **Owner:** r1/r1-09-timetable
- **Depends on:** R1-06
- **Can run in parallel with:** R1-08

## Goal

The operator builds each class's timetable within the allocation, and can generate a draft timetable that never breaks hard limits.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- Decisions D-247…D-251, D-262, D-381; `P5-03-foundation.md` P5-03e and P5-03j Results (rules only)

## Output

- Migrations (block `17643700xxxxx`): `timetable_slots`, `timetable_settings`, `timetable_drafts`.
- Operator Jadwal per class, teacher Kelas Saya > Jadwal, Susun Jadwal draft on the `default` queue (pure seeded generator; CPU-heavy runs may use the R1-10 pool).
- Property tests for hard limits; IDOR tests.

## Done when

- [x] Tests (own test database `sigrak_test_r109`), lint and typecheck pass; IDOR test for every school-owned resource
- [x] Pages checked at 360 and 1280 px where the task has UI; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r1/r1-09-timetable` (from `r1/r1-00-gate-split`). 299 tests pass on `sigrak_test_r109` (`REDIS_QUEUE_DB=5`, `REDIS_AI_DB=6`). 20 of them are new: 4 property and unit tests in `tests/unit/timetable_generator.spec.ts`, and 16 in `tests/functional/timetable/`. Lint, typecheck, format check and the EYD and translation tests pass. Every page was checked at 360 and 1280 px (Chromium, scale 1), and none scrolls sideways.

**Built**

- **Migrations** `1764370000001…3`. All three tables are school-owned with `schoolRls()`, and the RLS coverage test picks them up.
  - `timetable_slots`: `public_id`, class (composite FK `(class_id, school_id)`, CASCADE), `weekday` 1–6, `period_no`, `starts_at < ends_at` (`time`), `kind` ∈ lesson/break/ceremony/activity, `label` (non-lesson only), `subject_id` (RESTRICT), `jp` and `is_locked`.
    - CHECK: a lesson has a subject and 1–4 JP; every other kind has no subject and 0 JP (D-247).
    - No `teacher_id`: the teacher comes from the teaching assignment (D-249).
    - `UNIQUE (class_id, weekday, period_no) DEFERRABLE INITIALLY DEFERRED`, so renumbering a day inside one transaction works.
  - `timetable_settings`: one row per school. Holds `days` (start, JP count, optional Upacara/Kegiatan opening) and `breaks` (after JP n, minutes) as JSONB, plus the five D-262 switches as booleans.
  - `timetable_drafts`: year (composite FK), `class_ids bigint[]`, `seed`, `status` (queued/running/ready/failed/saved, with `saved_at` set exactly when saved), `input` (frame and switches), `result` and `created_by_id`. The last 10 drafts per school are kept.
- **`app/timetable/`** (alias `#timetable/*`):
  - Pure core, with no database: `types.ts`, `time.ts` (minutes ↔ `07:35`, shown as `07.35`), `random.ts` (seeded mulberry32), `frame.ts` (day frame → periods and break rows) and `rules.ts`. `rules.ts` holds `checkRows()`, the one hard-limit check shared by the manual form, the draft save, the Kelas page and the property tests. It covers row validity, class overlap except lessons of different religions (D-251), subject taken and with a teacher (D-249), allocation (D-250), and teacher clashes across the whole year (D-248). Rows outside the focus are context only, so an old row whose teacher was cleared stays without an error.
  - `draft_generator.ts`: pure and seeded. It works out a gap-free target set of periods per class, then places one JP at a time, most-constrained teachers first. Religion groups run in parallel, with one teacher per group. A lesson with no free period may swap with one already placed, and a local search then improves the soft score. The best of 40 attempts wins (fewest JP left, then lowest penalty). The five switches only change the score, and locked rows and the periods they cover are never touched. Frame rows (opening, breaks) are kept only where a lesson follows them. Unplaced JP get a reason: `no_teacher`, `no_room` or `teacher_busy`.
  - DB layer: `year_state.ts` (classes, subjects with allocation from `ClassSubjects`/`SubjectsForGrade`, assignments, every row of the year), `slots.ts` (save, delete and lock under a lock on the year row, renumbering, the JP summary and completeness, warnings), `settings.ts` (defaults and frame validation), `drafts.ts` (create, generator input, save over unlocked rows after `checkRows`, refused as a whole when the draft no longer fits), `messages.ts` (messages that name the class, day and time), and `assignment_clashes.ts`.
  - `draft_job.ts`: the `default` queue job `generate-timetable-draft`. It reads the year in the school's tenant transaction (`SchoolContext.runFor(job.schoolId)`) and runs the generator in the **R1-10 CPU pool** (task `timetableDraft`). A 12-class SD school takes about 1.6 s per draft on one core, so it does not block worker-default's event loop. If shutdown cuts the job off, it goes back to the queue.
- **Routes** in `start/routes/timetable.ts` (`app.timetable.*`, `middleware.school()`). Another school's row is a 404.
  - Operator: `/jadwal` (overview), `/kelas/:class/jadwal` (+ POST, `/:slot/ubah`, `/:slot/hapus`, `/:slot/kunci`), `/jadwal/susun-draf` (+ POST, `/pengaturan`), and `/jadwal/draf/:draft` (+ `/acak-ulang`, `/simpan`).
  - Teacher: `/kelas-saya/jadwal`.
- **Pages** in `inertia/pages/timetable/{index,class,compose,draft,mine}.tsx`, with parts in `inertia/components/timetable/parts.tsx`:
  - Jadwal overview: each class's state (complete, x of y subjects, warnings).
  - Jadwal of a class: rows per day with the teacher or "Belum ada guru", one form for add and edit with a JP suggestion from the row's length, lock/unlock, delete, JP per subject against the allocation, and warnings.
  - Susun draf jadwal: the frame form, the switches, a draft for one class or all, and the latest drafts.
  - Draft page: polls while the draft is waiting, shows the draft (locked rows included) next to the current rows, lists the JP left over with the reason, and offers Simpan draf (confirm dialog) and Acak ulang.
  - Jadwal mengajar (teacher): own lessons with the total JP, plus the full timetable of their homeroom classes.
- **Copy** in `resources/lang/id/timetable.json`, written to EYD: times as `07.00`, ranges with "sampai", first word capitalised (D-472), and "Belum berhasil" instead of "gagal".
- **Tests:**
  - `slots.spec.ts` (12): rows and numbering, field errors, overlap and parallel religions, allocation and completeness (religion without a teacher not counted), teacher clash across classes but not across years, the Kelas page refusal and the homeroom-change warning, edit/delete/lock and renumbering, closed year, teacher view, role 403s, IDOR (HTTP 404, app scope, RLS read and write, composite FK), and DB checks.
  - `drafts.spec.ts` (4): settings and frame errors; draft → queue → worker handler → ready → comparison → save (locked row kept, unlocked rows replaced, no violations, both classes complete, a second save refused); a stale draft refused with nothing changed; Acak ulang; IDOR for drafts and settings, including a job run with the wrong school.
  - `timetable_generator.spec.ts`: a property test over 300 random schools (random frames, switches, shared teachers, religions, teachers missing, locked rows, a class outside the draft). No hard limit is broken, locked rows are untouched, no day ends with a break, and every allocated JP is either placed or reported. Also: determinism, a full SD week, and the unplaced reasons.

**Shared files touched**

- `inertia/layouts/app_layout.tsx`: menu "Jadwal" for the operator and "Jadwal mengajar" for the teacher (`teacherOnly`).
- `resources/lang/id/nav.json`: `timetable`, `my_timetable`.
- `resources/lang/id/validation.json`: field names `weekday`, `starts_at`, `ends_at`, `kind`, `subject`, `label`, `jp`, `target`, `lessons`.
- `resources/lang/id/classes.json` and `inertia/pages/school_year/class.tsx`: a "Jadwal kelas" button on the class page.
- `app/school_year/controllers/classes_controller.ts`: one call, `refuseAssignmentClashes()`, before saving guru mapel (D-248 on the Kelas page).
- `tests/functional/accounts/guest_access.spec.ts`: sample params `slot`, `draft`.
- `app/jobs/default_registry.ts`: the job, plus an optional `signal` on the handler type.
- `app/services/queue/worker.ts`: default jobs get the same CPU-pool interruption handling as exports (back to the queue), and the default worker closes the pool on shutdown.
- `app/services/cpu_pool/tasks.ts`: the `timetableDraft` task.
- `package.json` (`#timetable/*`) and `start/routes.ts` (one import).
- Generated: `database/schema.ts`, `.adonisjs/server/pages.d.ts` and `routes.d.ts`. `routes.d.ts` also picked up admin routes that were missing from the committed copy.

**Proposed decisions**

1. *One rule check for every path:* manual rows, draft saves and the Kelas page all go through the pure `checkRows()`. It reports only violations that involve the rows being changed; older broken rows show as warnings (D-248).
2. *Writes serialise per year:* every timetable write, and every guru mapel pick, takes a row lock on the academic year first, so two saves can never race past a teacher clash.
3. *Frame shape:* per weekday a start time, a JP count (0 = no school) and an optional opening row; breaks are school-wide (after JP n, 5–60 minutes, at most 3); a day ends by 18.00. The defaults are Monday–Thursday 7 JP, Friday 5, Saturday 6, from 07.00, Upacara on Monday, and breaks after JP 3 and 6. One frame per school, not per grade: lower grades simply end earlier, because the generator trims each class's days from the end and never leaves holes.
4. *Draft rows:* consecutive periods of one subject become one row (up to 4 JP). Parallel religions get one row each at the same times. Frame rows are added only where a lesson of the class follows.
5. *Draft runs in the CPU pool* from worker-default (task `timetableDraft`). It is not run inline, because a large school takes 1–3 s of pure CPU.
6. *Acak ulang* makes a new draft for the same classes with the school's current frame and switches and a new seed. The old draft stays in the list. Ten drafts are kept per school.
7. *Locked rows* can still be changed by hand; the lock only protects them from a draft save (D-381).
8. *Interpretation of "at most 2 consecutive JP per subject per day":* a subject's JP on one day above 2 (3 for PJOK) are penalised. "Spread over the week" penalises a subject appearing in two separate runs on one day.

**Open questions**

1. Should a draft rebuild 2-JP blocks more strongly? With "spread over the week" on, the generator often picks single JP on more days (for example Matematika 1 JP on five days). Default now: valid and spread, with no bonus for 2-JP blocks. An owner choice could add a switch "prefer 2-JP blocks". (Owner)
2. One frame per school: do schools need a frame per grade or per class, for example a shorter grade 1–2 day with its own breaks? Default now: one frame, with days trimmed per class. (Owner)
3. Religions without a teacher are listed on the draft page as "Belum ada guru" but not counted as missing JP. Should a class also be able to mark which religions it has (needs students)? See R1-06 open question 2. (Owner)
4. JP per week for MI comes from `SubjectsForGrade.jpPerWeek`, the intracurricular structure row. Cocurricular JP (KMA 1503) are not scheduled. Confirm cocurricular hours stay off the timetable. (Team)
5. Teacher clashes are checked within one school only. A teacher who works at two schools (two memberships) is not checked across schools, because RLS hides the other school. (Owner)
6. Principal view of timetables and copying a day or a class timetable remain later work, as in P5-03e.
