# Profil Jenjang (draft)

One file per school level (`sd.json`, `mi.json`), read by `App\Curriculum\Policy\LevelProfiles` (D-356). Code reads the profile and never checks the level itself; a new level (SDLB, later SMP/MTs) is a new file. Status `draft` until Tim Validasi SIGRAK signs it off (D-113).

Each file holds `versions[]`. A version applies from `applies_from_school_year` until a later version takes over (D-354), so a profile change never rewrites an earlier school year.

| Key | Meaning | Source |
|---|---|---|
| `ministry` | Ministry the level answers to | §8 of `docs/drafts/policy-innovation-layers.md` |
| `rule_sets` | Per domain, the rule sets (curriculum version codes) with `effective_on` and `applies_from_school_year`. `curriculum:import` copies these dates to `curriculum_versions` (D-355). An entry may carry `region_province` to apply in one province only. An entry may carry `borrowed_from` (a level code) when the level uses another level's rule set: MI lists `SIGRAK-SD-2026-R1` for the general subjects next to `SIGRAK-MI-2026-R1` (PAI subjects and Bahasa Arab from KMA 1503/2025), D-469; the import checks a borrowed version's semester targets only against its own level's structure, and a grade only lists subjects of its level or of both levels (`subjects.school_level`), so the six SD religions do not reach MI. `cp` lists the general-subject CP `CP-UMUM-SD-BSKAP-046-2025` (Kepka BSKAP 046/H/KR/2025) for SD and for MI's subjects outside the Kemenag set, next to the religion CP of each level | D-354, D-355, D-452, D-469 |
| `religion_subjects` | Which religion subject set the level uses | D-251, `subjects.school_level` |
| `character_frameworks` | `dpl_8`, `kaih_7`, and `kbc` for MI | D-356, D-359 |
| `cocurricular_jp_source` | Which subjects give JP to kokurikuler | §8 (C4) |
| `rpm_extra_fields` | RPM fields beyond the core. KBC: on for MI (D-126), off for SD and switchable by a SIGRAK admin (D-368), which narrows KMA 512/2026 Diktum KESATU (it also covers religion teachers in general schools) | D-126, D-368 |
| `report_export_target` | e-Rapor SD or RDM | D-218 |
| `homeroom_teacher_term` | UI and print term for the teacher who holds one class: "Guru kelas" for SD, "Wali kelas" for MI | D-383 |
| `homeroom_jtm_default` | Wali kelas JTM: 2 for SD, 6 for MI; a school may change it | D-212 |
| `external_assessments` | AN and TKA for SD and MI; AKMI for MI still to verify. AN covers final-grade murid of SD/MI, including madrasah under the Ministry of Religious Affairs (Permendikdasmen 9/2026 Pasal 5 ayat (3) huruf a, Pasal 6 ayat (1)); Kepmendikdasmen 56/2026 runs TKA and AN | §8, D-452 |
| `calendar_source`, `data_of_record` | Provincial kaldik or Kanwil calendar; Dapodik or EMIS | D-256, D-161 |

Subject status by school year is not in the profiles: a subject phased in by a regulation carries `transition` in `docs/data/curriculum/subjects.json` (Bahasa Inggris SD/MI grades 3–6, D-410).

Dates: `effective_on` is filled where the decree states it: Permendikdasmen 13/2025 (15 July 2025, Pasal II), Kepka BSKAP 046/H/KR/2025 (16 July 2025, Diktum KEDELAPAN), Kepka BKPDM 020/2026 (11 June 2026, Diktum KEDUA), KMA 1503/2025 (22 September 2025, Diktum KEDELAPAN) and SK Dirjen Pendis 9941/2025 (28 November 2025, Diktum KETIGA); each of the last four applies from the day it was set. SIGRAK's own TP/ATP defaults keep `null`. `applies_from_school_year` follows D-354 (a rule set from mid-year applies from the next school year); 13/2025 and 046/H/KR/2025, set in the first days of 2025/2026, apply from that school year.
