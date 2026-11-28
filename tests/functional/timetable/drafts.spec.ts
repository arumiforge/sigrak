import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import type School from '#models/school'
import { defaultJobFor } from '#jobs/default_registry'
import { closeCpuPool } from '#services/cpu_pool/main'
import { queue } from '#services/queue/queues'
import { createSchool, visit } from '#tests/helpers'
import { assertRlsHides, assertSchoolCannotRead, asSchool } from '#tests/tenancy'
import { cookieOf, inertiaPage, postForm, type Session } from '#tests/accounts'
import { ClassSubjects, schoolPolicyInput } from '../../../app/school_year/class_subjects.js'
import type AcademicYear from '../../../app/school_year/models/academic_year.js'
import type SchoolClass from '../../../app/school_year/models/school_class.js'
import { runDraft } from '../../../app/timetable/draft_job.js'
import TimetableDraft from '../../../app/timetable/models/timetable_draft.js'
import TimetableSetting from '../../../app/timetable/models/timetable_setting.js'
import { checkRows } from '../../../app/timetable/rules.js'
import { loadYearState, ruleRowOf } from '../../../app/timetable/year_state.js'
import {
  createClass,
  createTeacher,
  createYear,
  sdSubjects,
  signInAs,
  useCurriculum,
} from '../school_year/fixtures.js'
import { assign, createSlot, rowsOf } from './fixtures.js'

/**
 * Susun Jadwal (D-262, D-381): the frame and switches, a draft made by
 * the `default` queue job in the CPU pool, the comparison page, saving
 * over the unlocked rows, a draft that no longer fits, Acak ulang, and
 * IDOR for drafts and settings.
 */

type Client = Parameters<typeof postForm>[0]

/** Two grade 4 classes with every subject's teacher; PJOK and PAI shared. */
async function schoolWithClasses(name: string) {
  const school = await createSchool(name)
  const year = await createYear(school)
  const pe = await createTeacher(school, 'Pak Olahraga')
  const english = await createTeacher(school, 'Miss Inggris')
  const islam = await createTeacher(school, 'Pak Islam')
  const kristen = await createTeacher(school, 'Bu Kristen')
  const { classTeacher } = await sdSubjects(4)
  const classes: SchoolClass[] = []
  for (const className of ['4A', '4B']) {
    const homeroom = await createTeacher(school, `Wali ${className}`)
    const schoolClass = await createClass(school, year, {
      name: className,
      grade: 4,
      homeroomTeacherId: homeroom.user.id,
    })
    for (const subject of classTeacher) {
      await assign(school, schoolClass, subject.code, homeroom.user.id)
    }
    await assign(school, schoolClass, 'PJOK', pe.user.id)
    await assign(school, schoolClass, 'BIG', english.user.id)
    await assign(school, schoolClass, 'PAI', islam.user.id)
    if (className === '4A') await assign(school, schoolClass, 'PAKR', kristen.user.id)
    classes.push(schoolClass)
  }
  return { school, year, classes }
}

async function violationsOf(school: School, year: AcademicYear) {
  const deps = { classSubjects: new ClassSubjects(), school: await schoolPolicyInput(school.id) }
  return asSchool(school, async () => {
    const state = await loadYearState(deps, year)
    return checkRows(state.slots.map(ruleRowOf), state.context)
  })
}

async function requestDraft(client: Client, operator: Session, year: AcademicYear, target = 'all') {
  const { response } = await postForm(
    client,
    operator,
    '/jadwal/susun-draf',
    { year: year.publicId, target },
    '/jadwal/susun-draf'
  )
  const location = response.header('location') as string
  const publicId = location.split('/').pop()!
  const draft = await db.from('timetable_drafts').where('public_id', publicId).first()
  return { response, location, draft }
}

test.group('Timetable | Susun Jadwal and drafts', (group) => {
  useCurriculum(group)
  group.teardown(async () => {
    await closeCpuPool(2_000)
    await queue('default').obliterate({ force: true })
  })

  test('the frame and switches start from the defaults and are saved per school', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Kerangka')
    await createYear(school)
    const operator = await signInAs(client, school)

    const page = await inertiaPage(client, operator, '/jadwal/susun-draf')
    const props = page.inertiaProps
    assert.isFalse(props.settingsSaved)
    assert.lengthOf(props.frame.days, 6)
    assert.deepInclude(props.frame.days[0], { weekday: 1, startsAt: '07:00', lessons: 7 })
    assert.isTrue(props.preferences.pjokMorning)

    const form: Record<string, string | number> = {
      'breaks[0][after_lesson]': 3,
      'breaks[0][minutes]': 20,
      'max_consecutive': 'on',
      'core_early': 'on',
    }
    for (let index = 0; index < 6; index++) {
      form[`days[${index}][weekday]`] = index + 1
      form[`days[${index}][starts_at]`] = '07:15'
      form[`days[${index}][lessons]`] = index === 5 ? 0 : 6
    }
    form['days[0][opening_kind]'] = 'activity'
    form['days[0][opening_label]'] = 'Senam'
    form['days[0][opening_minutes]'] = 30
    const { response } = await postForm(
      client,
      operator,
      '/jadwal/susun-draf/pengaturan',
      form,
      '/jadwal/susun-draf'
    )
    assert.equal(response.header('location'), '/jadwal/susun-draf')

    const saved = await asSchool(school, () => TimetableSetting.query().firstOrFail())
    assert.deepEqual(saved.days[0], {
      weekday: 1,
      starts_at: '07:15',
      lessons: 6,
      opening: { kind: 'activity', label: 'Senam', minutes: 30 },
    })
    assert.equal(saved.days[5].lessons, 0)
    assert.deepEqual(saved.breaks, [{ after_lesson: 3, minutes: 20 }])
    assert.isTrue(saved.prefMaxConsecutive)
    assert.isFalse(saved.prefPjokMorning)

    // A day that ends after 18.00 is refused on its field.
    const { session } = await postForm(
      client,
      operator,
      '/jadwal/susun-draf/pengaturan',
      { ...form, 'days[1][starts_at]': '11:00', 'days[1][lessons]': 12 },
      '/jadwal/susun-draf'
    )
    const refused = await inertiaPage(client, session, '/jadwal/susun-draf')
    assert.equal(
      refused.inertiaProps.errors['days.1.lessons'],
      'Hari ini selesai lewat pukul 18.00. Kurangi JP atau istirahatnya.'
    )
    const again = await postForm(
      client,
      operator,
      '/jadwal/susun-draf/pengaturan',
      { ...form, 'breaks[1][after_lesson]': 3, 'breaks[1][minutes]': 10 },
      '/jadwal/susun-draf'
    )
    const twice = await inertiaPage(client, again.session, '/jadwal/susun-draf')
    assert.equal(
      twice.inertiaProps.errors['breaks.1.after_lesson'],
      'Sudah ada istirahat sesudah JP itu.'
    )
  })

  test('a draft for all classes runs on the default queue, keeps the hard limits and replaces only unlocked rows', async ({
    client,
    assert,
  }) => {
    const { school, year, classes } = await schoolWithClasses('SD Draf')
    const [classA, classB] = classes
    const locked = await createSlot(school, classA, {
      weekday: 2,
      startsAt: '07:00',
      endsAt: '08:10',
      subject: 'MTK',
      jp: 2,
      isLocked: true,
    })
    await createSlot(school, classA, {
      weekday: 6,
      startsAt: '12:00',
      endsAt: '12:35',
      subject: 'SB',
      jp: 1,
    })
    const operator = await signInAs(client, school)

    const { location, draft } = await requestDraft(client, operator, year)
    assert.match(location, /^\/jadwal\/draf\//)
    assert.equal(draft.status, 'queued')
    const waiting = await queue('default').getJobs(['waiting', 'delayed'])
    assert.isTrue(
      waiting.some(
        (job) =>
          job.name === 'generate-timetable-draft' &&
          job.data.draftId === draft.id &&
          job.data.schoolId === school.id
      )
    )
    const pending = await inertiaPage(client, operator, location)
    assert.equal(pending.inertiaProps.draft.status, 'queued')
    assert.lengthOf(pending.inertiaProps.classes, 0)

    // The worker's handler, as worker-default runs it.
    const handler = defaultJobFor('generate-timetable-draft')!
    const outcome = (await handler.handle({
      data: { draftId: draft.id, schoolId: school.id },
    } as never)) as {
      unplacedJp: number
    }
    assert.equal(outcome.unplacedJp, 0)
    const ready = await asSchool(school, () => TimetableDraft.findOrFail(draft.id))
    assert.equal(ready.status, 'ready')
    assert.sameMembers(ready.classIds, [classA.id, classB.id])

    const page = await inertiaPage(client, operator, location)
    const shown = page.inertiaProps.classes.find((row: { name: string }) => row.name === '4A')
    assert.lengthOf(shown.kept, 1)
    assert.isAbove(shown.draft.length, 20)
    assert.lengthOf(shown.current, 2)
    // A religion without a teacher in 4B is reported, not placed.
    const fourB = page.inertiaProps.classes.find((row: { name: string }) => row.name === '4B')
    assert.deepInclude(fourB.unplaced, {
      subjectName: 'Pendidikan Agama Kristen dan Budi Pekerti',
      jp: 3,
      reason: 'no_teacher',
    })

    const { response, session } = await postForm(
      client,
      operator,
      `${location}/simpan`,
      {},
      location
    )
    assert.equal(response.header('location'), location)
    const after = await inertiaPage(client, session, location)
    assert.match(after.body().flash?.success ?? '', /^Draf sudah disimpan: \d+ baris di 2 kelas\.$/)
    assert.equal(after.inertiaProps.draft.status, 'saved')

    const rowsA = await rowsOf(classA)
    assert.isTrue(rowsA.some((row) => row.is_locked && row.code === 'MTK' && row.weekday === 2))
    assert.isFalse(rowsA.some((row) => row.weekday === 6 && row.starts_at === '12:00:00'))
    assert.equal(rowsA.filter((row) => row.is_locked).length, 1)
    const lockedRow = await db.from('timetable_slots').where('id', locked.id).first()
    assert.equal(lockedRow.starts_at, '07:00:00')
    assert.deepEqual(await violationsOf(school, year), [])

    // Every allocated subject with a teacher is complete in both classes.
    for (const schoolClass of classes) {
      const jadwal = await inertiaPage(client, operator, `/kelas/${schoolClass.publicId}/jadwal`)
      assert.isTrue(jadwal.inertiaProps.summary.complete, schoolClass.name)
    }
    // Saving twice is refused.
    const twice = await postForm(client, operator, `${location}/simpan`, {}, location)
    const twicePage = await inertiaPage(client, twice.session, location)
    assert.equal(twicePage.body().flash?.error, 'Draf ini belum siap disimpan.')
  })

  test('a draft that no longer fits is refused and changes nothing; Acak ulang makes a new draft', async ({
    client,
    assert,
  }) => {
    const { school, year, classes } = await schoolWithClasses('SD Basi')
    const [, classB] = classes
    const operator = await signInAs(client, school)
    const { location, draft } = await requestDraft(client, operator, year, classB.publicId)
    await runDraft(draft.id, school.id)
    const ready = await asSchool(school, () => TimetableDraft.findOrFail(draft.id))
    assert.deepEqual(ready.classIds, [classB.id])
    const first = ready.result!.classes[0].rows.find((row) => row.kind === 'lesson')!

    // Meanwhile the operator locks a row at the same time in 4B.
    const hh = (minutes: number) =>
      `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
    await createSlot(school, classB, {
      weekday: first.weekday,
      startsAt: hh(first.start),
      endsAt: hh(first.end),
      kind: 'activity',
      label: 'Literasi',
      isLocked: true,
    })
    const { session } = await postForm(client, operator, `${location}/simpan`, {}, location)
    const page = await inertiaPage(client, session, location)
    assert.match(
      page.body().flash?.error ?? '',
      /^Draf tidak cocok lagi dengan jadwal sekarang di kelas 4B: Bertabrakan dengan Literasi/
    )
    assert.lengthOf(await rowsOf(classB), 1)
    assert.equal(page.inertiaProps.draft.status, 'ready')

    const { response } = await postForm(client, operator, `${location}/acak-ulang`, {}, location)
    const next = (response.header('location') as string).split('/').pop()!
    assert.notEqual(next, draft.public_id)
    const fresh = await db.from('timetable_drafts').where('public_id', next).first()
    assert.equal(fresh.status, 'queued')
    assert.deepEqual(fresh.class_ids.map(Number), [classB.id])
  })

  test('another school’s drafts and settings: 404 over HTTP, hidden by the app and RLS', async ({
    client,
    assert,
  }) => {
    const schoolA = await createSchool('SD A')
    const yearA = await createYear(schoolA)
    const { school: schoolB, year: yearB, classes } = await schoolWithClasses('SD B')
    const operatorB = await signInAs(client, schoolB)
    const { location, draft } = await requestDraft(client, operatorB, yearB)
    const settingB = await asSchool(schoolB, () =>
      TimetableSetting.create({
        days: [],
        breaks: [],
        prefMaxConsecutive: true,
        prefPjokMorning: true,
        prefCoreEarly: true,
        prefSpreadWeek: true,
        prefNoSplitBreak: true,
      })
    )
    const operatorA = await signInAs(client, schoolA)

    const show = await visit(client, 'app', location, cookieOf(operatorA))
    assert.equal(show.status(), 404)
    for (const path of [`${location}/simpan`, `${location}/acak-ulang`]) {
      const { response } = await postForm(client, operatorA, path, {}, '/jadwal/susun-draf')
      assert.equal(response.status(), 404, path)
    }
    const other = await postForm(
      client,
      operatorA,
      '/jadwal/susun-draf',
      { year: yearB.publicId, target: 'all' },
      '/jadwal/susun-draf'
    )
    assert.equal(other.response.status(), 404)
    const foreignClass = await postForm(
      client,
      operatorA,
      '/jadwal/susun-draf',
      { year: yearA.publicId, target: classes[0].publicId },
      '/jadwal/susun-draf'
    )
    const page = await inertiaPage(client, foreignClass.session, '/jadwal/susun-draf')
    assert.equal(
      page.inertiaProps.errors.target,
      'Kelas tidak ditemukan. Muat ulang halaman, lalu coba lagi.'
    )
    // School A's compose page shows its own defaults, not B's settings.
    assert.isFalse(page.inertiaProps.settingsSaved)
    assert.lengthOf(page.inertiaProps.drafts, 0)
    assert.lengthOf(await db.from('timetable_drafts').where('school_id', schoolA.id), 0)

    await assertSchoolCannotRead(assert, schoolA, () => TimetableDraft.find(draft.id))
    await assertSchoolCannotRead(assert, schoolA, () => TimetableSetting.find(settingB.id))
    await assertRlsHides(assert, schoolA, 'timetable_drafts', [draft.id])
    await assertRlsHides(assert, schoolA, 'timetable_settings', [settingB.id])

    // The job for B's draft never runs in A's context: it uses the school on the job.
    await runDraft(draft.id, schoolA.id)
    const still = await db.from('timetable_drafts').where('id', draft.id).first()
    assert.equal(still.status, 'queued')
  })
})
