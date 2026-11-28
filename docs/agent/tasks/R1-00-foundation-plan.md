# R1-00 — Foundation plan and split

- **Phase:** R1
- **Status:** done
- **Owner:** r1/r1-00-gate-split
- **Depends on:** R0 gate (D-468)

## Goal

Build the foundation every later phase uses, fresh on the phase R stack (D-411): tenancy with row-level security, auth and invitations, schools and roles, school year and classes, curriculum and the policy-profile resolver, the layer model (D-456, D-466), calendar, timetable, the Indonesian copy base, and the runtime settings from R0-08.

## Split and order

| Wave | ID | Task | Depends on |
|---|---|---|---|
| 1 | R1-01 | Tenancy core and RLS | — |
| 1 | R1-02 | Indonesian copy base (`resources/lang/id`) and translation checks | — |
| 1 | R1-03 | Curriculum tables, import, Profil Jenjang, policy-profile resolver | — (school-owned tables after R1-01) |
| 1 | R1-10 | Runtime settings: `worker-ai` concurrency, queue-wait alert, `worker_threads` pool | — |
| 2 | R1-04 | Regions and school directory (NPSN → region) | R1-01 |
| 2 | R1-05 | Auth, invitations, self sign-up and flexible trial, role switch, minimal staff console | R1-01, R1-02 |
| 2 | R1-07 | Layer model core and resolver | R1-01, R1-04 |
| 3 | R1-06 | Academic year, classes, teaching assignments, copy classes | R1-03, R1-05 |
| 3 | R1-08 | Calendar on the layer model | R1-06, R1-07 |
| 3 | R1-09 | Timetable and draft generator | R1-06 |
| 4 | R1-11 | Load re-measure with a real page and RLS (D-467) | R1-08 |
| 4 | R1-12 | UI shell: layouts, navigation, icons, tokens, SPA feel (D-473) | R1-08, R1-09 |

Product rules for the old build's equivalent tasks are in `P5-03-foundation.md` (history only: rules and defaults apply, class names and paths do not).

## Rules for parallel work (D-442, D-468)

- Module code under `app/<module>/` (for example `app/tenancy/`, `app/curriculum/`); each task adds its routes in its own file `start/routes/<module>.ts`, imported from `start/routes.ts` with one line.
- Migration timestamp blocks: R1-01 `17643000xxxxx`, R1-03 `17643100xxxxx`, R1-04 `17643200xxxxx`, R1-05 `17643300xxxxx`, R1-06 `17643400xxxxx`, R1-07 `17643500xxxxx`, R1-08 `17643600xxxxx`, R1-09 `17643700xxxxx`, R1-10 `17643800xxxxx`, follow-ups `17643900xxxxx`/`17644000xxxxx`, R1-12 `17644100xxxxx`.
- Tests side by side: `DB_DATABASE=sigrak_test_<task>` (for example `sigrak_test_r101`) and distinct `REDIS_QUEUE_DB`/`REDIS_AI_DB` numbers; CI keeps `sigrak_test`.
- Lang files are per module (`resources/lang/id/<module>.json`); R1-02 owns the shared ones (`common`, `validation`, `errors`, `nav`).
- Every school-owned table: `school_id`, RLS policy, IDOR test (school A never reads school B).

## Done when

- [ ] R1-01…R1-12 done and merged; CI green
- [ ] Owner sees the foundation on staging or in screenshots at 360 and 1280 px

## Result

Filled in as waves finish.
