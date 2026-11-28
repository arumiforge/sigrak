# R1-06 — Academic year, classes, teaching assignments, copy classes

- **Phase:** R1
- **Status:** done
- **Owner:** r1/r1-06-school-year
- **Depends on:** R1-03, R1-05
- **Can run in parallel with:** R1-08 (after its layer part), R1-09

## Goal

The operator sets up the school year, classes and teaching assignments, with defaults from the curriculum and copying classes into a new year.

## Read first

- `CLAUDE.md`, `docs/agent/CONTEXT.md`, `docs/agent/tasks/R1-00-foundation-plan.md`
- `docs/final/data-model.md` (school year); decisions D-032, D-240…D-246, D-383, D-464 (art branch per class)
- `P5-03-foundation.md` P5-03d and P5-03h Results (rules only)

## Output

- Migrations (block `17643400xxxxx`): `academic_years`, `classes` (with the chosen Seni dan Budaya branch), `teaching_assignments`.
- Operator pages Tahun Ajaran and Kelas (`/tahun-ajaran`, `/kelas`), copy classes one grade up, default assignments from `SubjectsForGrade`.
- Tests as listed in the old P5-03d/h Results, rewritten for Japa.

## Done when

- [x] Tests (own test database `sigrak_test_r106`), lint and typecheck pass; IDOR test for every school-owned resource
- [x] Pages checked at 360 and 1280 px where the task has UI; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r1/r1-06-school-year` (from `r1/r1-00-gate-split`). 219 tests pass on `sigrak_test_r106` (`REDIS_QUEUE_DB=1`, `REDIS_AI_DB=2`); 26 are new, in `tests/functional/school_year/`. Lint, typecheck, format check and the R1-02 translation tests pass. Screenshots of every page at 360 and 1280 px (Chromium, scale 1): no page scrolls sideways.

**Built**

- **Migrations** `1764340000001…3`, all school-owned with `schoolRls()`; the RLS coverage test picks them up:
  - `academic_years`: `public_id`, `name` (CHECK: follows the start year), `starts_on < even_semester_starts_on < ends_on`, at most 12 months (CHECK), `closed_at` (D-318), unique `(school_id, name)`. Years of a school never overlap: exclusion constraint on `daterange` (needs `btree_gist`, created with `IF NOT EXISTS`).
  - `classes`: `grade` 1–6, `name` ≤ 20 characters, trimmed, unique per year ignoring case. `art_branch` ∈ music/visual_art/dance/theatre or NULL (D-458, D-464). `homeroom_teacher_id` (SET NULL). The year must be of the same school (composite FK `(academic_year_id, school_id)`, RESTRICT).
  - `teaching_assignments`: unique `(class_id, subject_id)`, `teacher_id` NOT NULL (D-240). The class must be of the same school (composite FK, CASCADE). Subject FK is RESTRICT; a deleted user removes their rows.
- **`app/school_year/`** (alias `#school_year/*`):
  - Models `AcademicYear`, `SchoolClass` (table `classes`), `TeachingAssignment`, with `withSchoolScope`, plus `withPublicId` on the first two.
  - `academic_years.ts`: name, suggested dates, current year (D-241), save, delete, closed check.
  - `classes.ts`: save and delete, with a row lock on the year.
  - `assignments.ts`: D-240 defaults, homeroom change, grade change, set teachers.
  - `copy_classes.ts`: `planCopy`/`movedUpName` (pure) and `copyClasses` (D-242…D-246).
  - `class_subjects.ts`: `ClassSubjects` over `SubjectsForGrade.forLevel()` plus the resolver's level term.
  - `teachers.ts`: active teacher memberships; the browser sees only membership public ids.
  - Controllers, validators and `http.ts` (rule errors back to the form field or a toast).
- **Routes** `start/routes/school_year.ts`, operator only, `middleware.school()`. Another school's row is a 404:
  - `/tahun-ajaran` (+ `POST`), `/tahun-ajaran/:academicYear/ubah` (GET/POST), `…/hapus`, `…/salin-kelas`.
  - `/kelas?tahun=…` (+ `POST`), `/kelas/:class`, `…/ubah`, `…/hapus`, `…/guru-mapel`.
- **Pages** `inertia/pages/school_year/{academic_years,academic_year_edit,classes,class}.tsx`, with parts in `inertia/components/school_year/`.
  - Tahun Ajaran: the name is shown live from the start date. Adding a year has "Salin kelas dari tahun ajaran …" on by default, with the grade 1 checkbox and a preview of the names. An empty year has a "Salin kelas" panel.
  - Kelas: year chips, an add form, and classes by grade with "x dari y mapel sudah ada guru".
  - The class page has the details form (name, grade, art branch, homeroom) and one teacher select per subject. Subjects no longer taught are shown as "Tidak diajarkan lagi". A teacher who has left shows "(sudah tidak aktif)" and is kept on save (form value `current`).
  - "Guru kelas"/"Wali kelas" comes from the Profil Jenjang `homeroom_teacher_term` through `useLevelTerms` (D-383). Tari/Teater are labelled "(topik dari SIGRAK belum ada)" and stay selectable.
- **Copy** `resources/lang/id/classes.json`.
- **Tests:**
  - `academic_years.spec.ts` (8): add and name, field errors, DB checks, rename and delete rules, current/suggested year, closed year read-only, role 403s, IDOR over HTTP, app scope and RLS.
  - `classes.spec.ts` (12): defaults, unique names, homeroom takeover and removal, grade change, set/change/clear and refusals, teacher who left and stale subject, art branch, MI "Wali kelas", delete cascade, current year and bad `tahun`, role 403s, IDOR for classes and assignments, composite FK.
  - `copy_classes.spec.ts` (6): name rules, plan, HTTP copy, refusal and hidden button, source choice, copy while adding a year.

**Shared files touched:**
- `package.json` (`#school_year/*` alias) and `start/routes.ts` (one import line).
- `inertia/layouts/app_layout.tsx` (Tahun Ajaran and Kelas menu items for the operator).
- `resources/lang/id/nav.json` (`school_years`, `classes`) and `resources/lang/id/validation.json` (field names `even_semester_starts_on`, `class_name`, `grade`, `art_branch`, `homeroom`, `assignments`).
- `tests/functional/accounts/guest_access.spec.ts` (sample params `academicYear`, `class`).
- `database/schema.ts` (regenerated only) and `.adonisjs/server/pages.d.ts` (generated).

**Proposed decisions**

1. *Years never overlap, also in the database:* an exclusion constraint with `btree_gist` (a trusted extension, so the database owner can create it), not just an app check.
2. *Same-school foreign keys:* `classes → academic_years` and `teaching_assignments → classes` use composite keys with `school_id`, so a row can never point at another school's parent, even through raw SQL.
3. *Class names are unique ignoring case* (`4A` = `4a`), and stored trimmed.
4. *Class subjects for now:* the compulsory subjects of `SubjectsForGrade.forLevel()`; all six religion subjects are listed. `school_subjects` (R1-03 design) was not built here because no page here switches subjects on. `ClassSubjects` is the one place where it and the region's local content plug in later.
5. *A copy keeps the class's Seni dan Budaya branch* where the new grade offers it, also for the recreated grade 1 classes. Homeroom and assignments stay empty (D-242).
6. *A teacher who has left* (membership ended) stays on their rows until the operator changes them. The form shows them as "(sudah tidak aktif)" and keeps them on save, instead of dropping them silently.
7. *Copy clashes:* ` <grade>` is added, then ` <grade>-2`… if that still clashes, cut to 20 characters (D-245 extended).
8. *Closed years:* `closed_at` exists and every change is refused for a closed year. Closing a year (Arsip, D-318) comes with its own slice.

**Open questions**

1. Should Bahasa Inggris (elective in grades 3–6), Bahasa Jawa / local content and the optional subjects appear on the class page now? That needs `school_subjects` and operator switches (plus the D-232 cap warning). Proposed: a follow-up task after R1-07 (local content from the layers).
2. The "x dari y mapel" count includes all six religion subjects, so a school with pupils of one religion never reaches "all set". Should religions count as one row, or count only religions with pupils (needs students)?
3. R1-04's `nextSchoolYearStart()` still assumes 1 July. Should it now read the school's next `academic_years` row when one exists (D-470 "until R1-06 stores school years")?
4. The resolver input `regionProvince` is filled with the province region's name. No profile entry uses `region_province` yet; confirm name or Kemendagri code when the first one does.
5. Principals and teachers have no read view of classes yet (Kelas Saya, principal views come later); all routes are operator only.
6. Calendars (R1-08) still carry `academic_year` as text; R1-08 may link `calendars` to `academic_years`.
