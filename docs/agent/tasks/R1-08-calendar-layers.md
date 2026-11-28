# R1-08 — Calendar on the layer model

- **Phase:** R1
- **Status:** in-progress
- **Owner:** r1/r1-08-calendar
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

- [x] Tests (own test database `sigrak_test_r108`), lint and typecheck pass; IDOR test for every school-owned resource
- [x] Pages checked at 360 and 1280 px where the task has UI; all text in `resources/lang/id`
- [x] Result filled, open questions listed

## Result

Branch `r1/r1-08-calendar` (from `r1/r1-00-gate-split`). 312 tests pass on `sigrak_test_r108` (`REDIS_QUEUE_DB=3`, `REDIS_AI_DB=4`); 36 are new (`tests/functional/calendar/`, `tests/unit/calendar.spec.ts`), the 3 skeleton calendar tests are replaced. Lint, typecheck, format check and the EYD/translation tests pass. Screenshots of Kalender (operator and teacher: month, list, "Tidak dipakai", "Hari efektif") and the console at 360 and 1280 px: no page scrolls sideways.

**Built**

- **Migrations** `1764360000001…4`:
  - `…01` `calendar_items`, the calendar's layered table (`layeredColumns()` + `class_id`, `kind`, `exam_type`, `title`, `starts_on`, `ends_on`, `setting_value`); domain `calendar` in `layer_domains`. Kinds: `national_holiday`, `joint_leave` (national package only), `holiday`, `exam`, `school_event`, `no_lessons`, `note` (shown, never counted, D-379) and `setting` (frame keys `FRAME-starts_on`, `FRAME-even_semester_starts_on`, `FRAME-ends_on`, `FRAME-school_days_per_week`). Guard trigger: class events only in a school package and only for a class of that school; no frame settings in a school package. RLS and layer triggers from `layeredTableSql()`.
  - `…02` moves the skeleton tables and drops them: `national_holidays` → national base package `SIGRAK-KALENDER-NASIONAL` (draft); region `calendars` → one official package per area and year (line `all`, frame as mandatory settings, events mandatory, `joint_leave_school_days` → hides); school `calendars` → one school package (own events only; D-256 copies dropped; extra joint-leave school days → school hides). Checked on a hand-made data set. `down()` recreates the old tables empty.
  - `…03` `calendar_snapshots` (school-owned, RLS): per user and school year, what they last saw.
  - `…04` D-472 carry-over: trigger on `academic_years` AFTER INSERT copies the school's active local-agreement choices of its latest earlier school year (package still active, in the school's area and covering the new year), starting on the new year's first day, and writes one `package_carried_over` notice for the operator.
- **`app/calendar/`** (alias `#calendar/*`): `domain.ts` (layer adapter; `checkChange` runs the conflict checker), `conflict_checker.ts` (D-260: refuse outside the year and STS/SAS on a national holiday or active joint leave; warn on a day without lessons), `effective_days.ts` (D-259 per class; each day in one column: Libur → Asesmen → Kegiatan; weeks to one decimal), `frame.ts` (nearest frame setting, else academic year, else 1 July–30 June; 6 days unless set), `school_calendar.ts` (reads through `LayerResolver` inside the tenant transaction), `calendar_changes.ts` (impact notice and shift preview), `data_files.ts` (D-254 check, import, activation), `keys.ts`, `dates.ts`, controllers, validators. The skeleton service, controller and `Calendar`/`CalendarEvent`/`NationalHoliday` models are removed.
- **Routes** `start/routes/calendar.ts`: app. `GET /kalender` (every role; `?tahun=` academic year, `?kelas=` class for effective days), `POST /kalender/acara`, `/kalender/acara/:item/ubah`, `/kalender/acara/:item/hapus`, `/kalender/:item/tidak-dipakai`, `/kalender/:item/pakai-lagi` (operator), `/kalender/usulan` (teacher, principal), `/kalender/perubahan/dibaca`; admin. `GET /kalender`, `POST /kalender/impor`, `POST /kalender/paket/:package/aktifkan` (admin only).
- **Pages** `inertia/pages/school/calendar.tsx` (month grid, list, "Tidak dipakai", "Hari efektif" as a table on desktop and cards on phones, source badge and "Wajib" on every row, frame card, impact notice for operator/principal, shift preview for teachers, operator add/change/delete, proposal forms for others; calendar data deferred) and `inertia/pages/admin/calendar.tsx` (data files with their check, packages with items, import, activate). Copy in `resources/lang/id/calendar.json`.
- **Command** `node ace calendar:import [--activate]`; `reference_seeder` imports the holidays (draft); `demo_seeder` imports and activates both packages for the local demo.
- **Tests**: 254/134/120 for SD and MI in Jati, SD in Dawe and SD in Jepara without kecamatan (D-323; completes resolver case 5); month table; class events only for their class; a kept-open joint-leave day; national holidays and kaldik events cannot be hidden (app and database); frame fallbacks; D-254 check cases; import idempotent, draft invisible, activation, revisions and retirement; pages (deferred props, sources, IDOR over HTTP, add/change/delete, Sunday warning, conflict refusals, hide/unhide, proposals add/revise/retire approved through Usulan, foreign class, foreign year 404, RLS on `calendar_items`, school packages and `calendar_snapshots`, impact notice and shift preview, user without school); console (check, import, path refusal, support cannot activate); carry-over.

**Shared files touched:** `app/layers/domains/domain_adapter.ts` (optional `checkChange` hook), `app/layers/domains/registry.ts`, `app/layers/school_layer.ts` (`checkChange` on add; new `revise`), `app/layers/proposals.ts` (`revise` school proposals; `checkChange` at send and approval), `app/layers/presenters.ts` (`SourceProps`/`HiddenByProps` as type aliases so Inertia props type-check), `app/layers/notices.ts`, `app/layers/types.ts`, `inertia/pages/school/layers/packages.tsx` (carry-over notice), `resources/lang/id/layers.json`, `app/models/school.ts`, `start/routes.ts`, `package.json`, `tests/helpers.ts` (`createCalendar()` writes a school package), `tests/functional/tenancy/rls.spec.ts` and `rls_coverage.spec.ts`, both seeders, regenerated `database/schema.ts` and `.adonisjs/server/*`.

**Deviations from the draft**

1. One layered table `calendar_items` for every layer; `national_holidays`, `calendars`, `calendar_events` are dropped instead of gaining layered columns (frame values are `setting` items, area notes `note` items).
2. Match key = dates + kind + class + title (not date + kind), so two events of one day stay two items.
3. A school without an official frame uses its `academic_years` row as frame; with an official frame, effective days use the official dates and the operator sees when the academic year differs.
4. Impact notice and shift preview are diffs against a per-user snapshot, not notices written at publish time; RPM meetings and Batalkan wait for P5-04 and can read the same diff.
5. The D-254 check runs on repository data only: the file must carry a dated check with `go.id` sources naming every cited decree.
6. School days per week come from the frame (6 by default) until the timetable gives each class its days.

**Proposed decisions**

1. Calendar on one layered table `calendar_items`; skeleton calendar tables dropped after their rows move into packages.
2. Calendar match key: dates, kind, class and normalised title.
3. A school's own frame is its academic year; an official frame wins and the difference is shown to the operator.
4. Impact notice (operator, principal) and shift preview (teachers) from per-user snapshots, marked as read per user.
5. Calendar data stays draft after import (command or console) until an admin activates it after Tim Validasi's sign-off; any console role may import.
6. D-472 carry-over as a database trigger on `academic_years`, so every path that creates a year copies the choices.
7. Conflict checker: refusals block; warnings ride on the success toast.

**Open questions**

1. Effective days per class need each class's lesson days from the timetable (R1-09); `effectiveDays({ weekdays })` is the hook. Who wires it after R1-09 merges?
2. Should R1-06's Tahun ajaran form suggest the official frame (13 July–19 June for Jawa Tengah) instead of 1 July–30 June when one exists?
3. Should the principal also see the teachers' shift preview (now: area impact only)?
4. Provisional fixed-date holidays for years without an SKB (D-253) are not generated yet; add them to the import or wait for the SKB file?
5. The console has no menu link to `/kalender`; who adds console navigation?
6. Published area calendars change through Usulan wilayah (add, hide); frame values change only by import. Enough, or does the console need a frame editor?
7. TKA and AN dates as mandatory national items still have no dataset (§11.1); the Jawa Tengah file carries TKA as an estimated province event.
