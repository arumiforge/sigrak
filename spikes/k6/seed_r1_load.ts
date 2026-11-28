/*
 * R1-11 load data: a realistic R1 data set for the k6 re-measure. Local and
 * test databases only; never run against production. See README.md.
 *
 * Needs `node ace migration:run`, `node ace db:seed` (regions, directory, demo
 * school, national and Jawa Tengah calendar packages), `node ace curriculum:import`
 * and `node ace layers:import-catalog --activate` first.
 *
 *   node --import=@poppinss/ts-exec spikes/k6/seed_r1_load.ts [users-file.json]
 *
 * Writes, idempotently by e-mail and NPSN:
 * - SCHOOLS (300) schools from the NPSN directory of Kudus, Jepara and Pati
 *   (region and kecamatan from the directory row, as a claimed school gets);
 * - in the first LOAD_SCHOOLS (20) of them: academic year 2026/2027 on the Jawa
 *   Tengah kaldik frame, 12 classes (grades 1–6, A and B), 15 load teachers
 *   (12 homeroom teachers, 3 subject teachers) and one operator, default and
 *   subject-teacher assignments, a saved timetable draft for every class (the
 *   real generator and the real save path), three school calendar events, one
 *   kept-open joint-leave day, one own extracurricular and one hidden one;
 * - the users file: e-mail → school name and the school's own extracurricular,
 *   read by the k6 scripts to check that every page shows the signed-in user's
 *   own school (tenant leak check under load).
 *
 * Load users keep the R0-08 names: beban001…beban300@sd-contoh.test (teachers,
 * 15 per school in school order), operator-beban01…20@sd-contoh.test, all with
 * the demo password.
 */
import 'reflect-metadata'
import { writeFileSync } from 'node:fs'
import { Ignitor } from '@adonisjs/core/ignitor'

const APP_ROOT = new URL('../../', import.meta.url)
const SCHOOLS = Number(process.env.SCHOOLS ?? 300)
const LOAD_SCHOOLS = Number(process.env.LOAD_SCHOOLS ?? 20)
const TEACHERS_PER_SCHOOL = 15
const SCHOOL_YEAR = '2026/2027'
const usersFile = process.argv[2] ?? null

const ignitor = new Ignitor(APP_ROOT, {
  importer: (filePath: string) =>
    import(
      filePath.startsWith('./') || filePath.startsWith('../')
        ? new URL(filePath, APP_ROOT).href
        : filePath
    ),
})
const app = ignitor.createApp('console')
app.booting(async () => {
  await import('#start/env')
})
await app.init()
await app.boot()
await app.start(async () => {})

const { default: db } = await import('@adonisjs/lucid/services/db')
const { default: hash } = await import('@adonisjs/core/services/hash')
const { DateTime } = await import('luxon')
const { SchoolContext } = await import('#tenancy/school_context')
const { tenantTransaction } = await import('#tenancy/tenant_transaction')
const { ensureAppLoginRole } = await import('#tenancy/database_roles')
const { default: env } = await import('#start/env')
const { default: SchoolMembership } = await import('#models/school_membership')
const { saveAcademicYear } = await import('#school_year/academic_years')
const { saveClass } = await import('#school_year/classes')
const { setTeachers } = await import('#school_year/assignments')
const { ClassSubjects, schoolPolicyInput } = await import('#school_year/class_subjects')
const { default: AcademicYear } = await import('#school_year/models/academic_year')
const { createDraft, generatorInput, saveDraft } = await import('#timetable/drafts')
const { generateDraft } = await import('#timetable/draft_generator')
const { loadSettings } = await import('#timetable/settings')
const { loadYearState } = await import('#timetable/year_state')
const { SchoolLayer } = await import('#layers/school_layer')
const { LayerResolver } = await import('#layers/resolver/layer_resolver')

const inSchool = <T>(schoolId: number, userId: number | null, work: () => Promise<T>) =>
  SchoolContext.run({ schoolId, userId }, () => tenantTransaction(work))

// The app's login user for the tenant connection (R1-01), as the test setup makes it.
await ensureAppLoginRole(db.connection(), {
  user: env.get('DB_APP_USER', 'sigrak_app_user'),
  password: env.get('DB_APP_PASSWORD')!.release(),
})

// 1. Schools from the directory, spread over the three regencies.
const entries = (await db
  .from('school_directory_entries')
  .whereNotNull('region_id')
  .whereNull('removed_at')
  .orderByRaw("CASE WHEN level = 'sd' THEN 0 ELSE 1 END")
  .orderBy('npsn')
  .select('npsn', 'name', 'level', 'address', 'region_id', 'district_id', 'district_name')) as {
  npsn: string
  name: string
  level: 'sd' | 'mi'
  address: string
  region_id: number
  district_id: number | null
  district_name: string
}[]
// Every n-th row, so all regencies and both levels appear; the load schools are
// spread over that list the same way, 4 MI among them.
const step = Math.max(1, Math.floor(entries.length / SCHOOLS))
const picked = entries.filter((_, index) => index % step === 0).slice(0, SCHOOLS)
const sdPicked = picked.filter((entry) => entry.level === 'sd')
const miPicked = picked.filter((entry) => entry.level === 'mi')
const spread = <T>(list: T[], count: number) =>
  list
    .filter((_, index) => index % Math.max(1, Math.floor(list.length / count)) === 0)
    .slice(0, count)
const loadEntries = [
  ...spread(sdPicked, LOAD_SCHOOLS - Math.min(4, LOAD_SCHOOLS)),
  ...spread(miPicked, Math.min(4, LOAD_SCHOOLS)),
]
const now = new Date()
for (const entry of picked) {
  await db
    .table('schools')
    .insert({
      name: entry.name,
      npsn: entry.npsn,
      level: entry.level,
      region_id: entry.region_id,
      district_id: entry.district_id,
      district: entry.district_name,
      address: entry.address,
      region_source: 'npsn_directory',
      region_checked_at: now,
      created_at: now,
      updated_at: now,
    })
    .onConflict('npsn')
    .ignore()
}
console.log(`schools from the directory: ${picked.length} (load schools ${loadEntries.length})`)

// 2. Users: one scrypt hash for all (the demo password), written directly.
const passwordHash = await hash.make('sigrak-demo-2026')
async function user(email: string, name: string) {
  const found = (await db.from('users').where('email', email).select('id').first()) as {
    id: number
  } | null
  if (found) return found.id
  const [row] = (await db
    .table('users')
    .insert({
      name,
      email,
      password: passwordHash,
      nip: null,
      email_verified_at: now,
      created_at: now,
      updated_at: now,
    })
    .returning('id')) as { id: number }[]
  return row.id
}

const usersMap: Record<string, { school: string; own: string }> = {}
const classSubjects = new ClassSubjects()

for (const [schoolIndex, entry] of loadEntries.entries()) {
  const school = (await db
    .from('schools')
    .where('npsn', entry.npsn)
    .select('id', 'name')
    .first()) as {
    id: number
    name: string
  }
  const teacherIds: number[] = []
  for (let t = 0; t < TEACHERS_PER_SCHOOL; t++) {
    const n = schoolIndex * TEACHERS_PER_SCHOOL + t + 1
    const email = `beban${String(n).padStart(3, '0')}@sd-contoh.test`
    teacherIds.push(await user(email, `Guru Uji Beban ${n}`))
    usersMap[email] = { school: school.name, own: `Hadroh ${schoolIndex + 1}` }
  }
  const operatorEmail = `operator-beban${String(schoolIndex + 1).padStart(2, '0')}@sd-contoh.test`
  const operatorId = await user(operatorEmail, `Operator Uji Beban ${schoolIndex + 1}`)
  usersMap[operatorEmail] = { school: school.name, own: `Hadroh ${schoolIndex + 1}` }

  const done = await inSchool(school.id, operatorId, async () => {
    const members = [
      ...teacherIds.map((id) => ({ userId: id, role: 'teacher' as const })),
      { userId: operatorId, role: 'operator' as const },
    ]
    for (const member of members) {
      await SchoolMembership.firstOrCreate(
        { schoolId: school.id, userId: member.userId, role: member.role },
        { status: 'active', startedOn: DateTime.fromISO('2026-07-01') }
      )
    }
    return AcademicYear.query().where('name', SCHOOL_YEAR).first()
  })
  if (done) {
    console.log(`${school.name}: already seeded`)
    continue
  }

  const deps = { classSubjects, school: await schoolPolicyInput(school.id) }

  // Year on the Jawa Tengah frame, 12 classes, assignments.
  const year = await inSchool(school.id, operatorId, async () => {
    const created = await saveAcademicYear({
      startsOn: DateTime.fromISO('2026-07-13'),
      evenSemesterStartsOn: DateTime.fromISO('2027-01-02'),
      endsOn: DateTime.fromISO('2027-06-19'),
    })
    const homerooms = await SchoolMembership.query()
      .whereIn('user_id', teacherIds.slice(0, 12))
      .where('role', 'teacher')
    const membershipOf = new Map(homerooms.map((row) => [row.userId, row.publicId]))
    let c = 0
    for (let grade = 1; grade <= 6; grade++) {
      for (const letter of ['A', 'B']) {
        const homeroom = membershipOf.get(teacherIds[c])!
        const schoolClass = await saveClass(deps, created, {
          name: `${grade}${letter}`,
          grade,
          artBranch: null,
          homeroom,
        })
        // Subject-teacher subjects: three subject teachers, by subject; religions
        // other than Islam stay without a teacher ("Belum ada guru"), as in many schools.
        const list = await classSubjects.forGrade(deps.school, SCHOOL_YEAR, grade)
        const changes = new Map<number, number | null>()
        let s = 0
        for (const subject of list.subjects) {
          if (subject.defaultTeacher !== 'subject_teacher') continue
          if (subject.religion && subject.religion !== 'islam') continue
          changes.set(subject.subjectId, teacherIds[12 + (s++ % 3)])
        }
        if (changes.size > 0) await setTeachers(schoolClass, changes)
        c++
      }
    }
    return created
  })

  // Timetable: one draft for all classes with the real generator, saved through
  // the real save path (rules checked again).
  await inSchool(school.id, operatorId, async () => {
    const settings = await loadSettings()
    const state = await loadYearState(deps, year)
    const classIds = [...state.classes.keys()]
    const draft = await createDraft(year, classIds, settings, 1000 + schoolIndex, operatorId)
    const result = generateDraft(generatorInput(state, classIds, settings, draft.seed))
    draft.merge({ status: 'ready', result })
    await draft.save()
    await saveDraft(deps, draft, year)
    console.log(
      `${school.name}: ${classIds.length} classes, timetable saved (${result.unplacedJp} JP left over)`
    )
  })

  // Calendar: three own events and one kept-open joint-leave day.
  const actor = { schoolId: school.id, userId: operatorId }
  await inSchool(school.id, operatorId, async () => {
    const events = [
      {
        kind: 'exam',
        exam_type: 'sts',
        title: 'Sumatif Tengah Semester Gasal',
        starts_on: '2026-09-21',
        ends_on: '2026-09-26',
      },
      {
        kind: 'school_event',
        title: 'Rapat Komite Sekolah',
        starts_on: '2026-11-28',
        ends_on: '2026-11-28',
      },
      {
        kind: 'exam',
        exam_type: 'sas',
        title: 'Sumatif Akhir Semester Gasal',
        starts_on: '2026-12-07',
        ends_on: '2026-12-12',
      },
    ]
    for (const event of events) await SchoolLayer.add(actor, 'calendar', SCHOOL_YEAR, event)
    const calendar = await LayerResolver.resolve('calendar', school.id, SCHOOL_YEAR, {
      fresh: true,
    })
    const jointLeave = calendar.items.find(
      (item) =>
        (item.value as { kind?: string }).kind === 'joint_leave' && item.force !== 'mandatory'
    )
    if (jointLeave) {
      try {
        await SchoolLayer.hide(actor, 'calendar', SCHOOL_YEAR, jointLeave.itemKey, 'Masuk sekolah')
      } catch {
        // A mandatory joint-leave day cannot be kept open; fine for the data set.
      }
    }
  })

  // Extracurricular: one own item and one hidden item.
  await inSchool(school.id, operatorId, async () => {
    await SchoolLayer.add(actor, 'extracurricular', SCHOOL_YEAR, {
      label: `Hadroh ${schoolIndex + 1}`,
      category: 'arts_culture',
      description: 'Ekstrakurikuler pilihan sekolah.',
    })
    const list = await LayerResolver.resolve('extracurricular', school.id, SCHOOL_YEAR, {
      fresh: true,
    })
    for (const item of list.items) {
      if (item.force === 'mandatory' || item.source.layer === 'school' || item.groupKey) continue
      try {
        await SchoolLayer.hide(actor, 'extracurricular', SCHOOL_YEAR, item.itemKey, null)
        break
      } catch {
        // Try the next one.
      }
    }
  })
}

await db.rawQuery('ANALYZE')
if (usersFile) {
  writeFileSync(usersFile, JSON.stringify(usersMap, null, 1))
  console.log(`users file: ${usersFile} (${Object.keys(usersMap).length} users)`)
}
const counts = await db.rawQuery(`
  SELECT (SELECT count(*) FROM schools) AS schools,
         (SELECT count(*) FROM users WHERE email LIKE '%beban%') AS load_users,
         (SELECT count(*) FROM classes) AS classes,
         (SELECT count(*) FROM teaching_assignments) AS assignments,
         (SELECT count(*) FROM timetable_slots) AS slots,
         (SELECT count(*) FROM calendar_items) AS calendar_items,
         (SELECT count(*) FROM layer_hides) AS hides,
         (SELECT count(*) FROM catalog_items) AS catalog_items`)
console.log(counts.rows[0])
await app.terminate()
