import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { sessionCookieNames } from '#config/session'
import HelpRequest from '#help/models/help_request'
import Region from '#models/region'
import { seedRegionList } from '#regions/region_list'
import type { StaffRole } from '#models/staff_user'
import { logStaffActivity } from '#accounts/activity_log'
import { attentionFor } from '#staff/console_home'
import { loadStaffAccess } from '#staff/access'
import { collectCache, collectMail } from '#system_health/services'
import { createSchool, createStaff, createTeacher, enrolTwoFactor, visit } from '#tests/helpers'
import { createStaffWithRole, inertiaPage, signIn, type Session } from '#tests/accounts'

/**
 * R2-09 console pass: the console home counts per role, the 2FA column
 * on Staf, named subjects on Log aktivitas, and the cache Redis and
 * mail checks of Kesehatan sistem.
 */

function homeAttention(client: Parameters<typeof visit>[0], session: Session) {
  return visit(client, 'admin', '/', {
    name: sessionCookieNames.admin,
    sessionId: session.sessionId,
  })
    .withInertia()
    .withInertiaPartialReload('admin/home', ['attention'])
}

async function signInAs(client: Parameters<typeof visit>[0], role: StaffRole) {
  const staff = await createStaffWithRole(role)
  return { staff, session: await signIn(client, 'admin', staff.email) }
}

async function helpRequest(schoolId: number, userId: number, status: 'new' | 'done') {
  return HelpRequest.create(
    {
      schoolId,
      userId,
      membershipRole: 'teacher',
      category: 'other',
      message: 'Permintaan uji untuk ringkasan konsol.',
      pageUrl: '/kalender',
      status,
      statusChangedAt: DateTime.now(),
    },
    { connection: 'pg' }
  )
}

async function problem(status: string, title = 'Masalah uji') {
  const recorder = await createStaff(['support'])
  const now = new Date()
  const [row] = await db
    .table('problems')
    .insert({
      title,
      description: 'Uraian masalah uji.',
      source: 'other',
      status,
      recorded_by_staff_id: recorder.id,
      status_changed_at: now,
      created_at: now,
      updated_at: now,
    })
    .returning('id')
  return Number(row.id ?? row)
}

test.group('Console pass | home', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('the home counts only what the role acts on, deferred', async ({ client, assert }) => {
    const school = await createSchool('SD Uji')
    const teacher = await createTeacher(school)
    await helpRequest(school.id, teacher.id, 'new')
    await helpRequest(school.id, teacher.id, 'new')
    await helpRequest(school.id, teacher.id, 'done')
    await problem('new')
    await problem('triaged')

    const support = await signInAs(client, 'support')
    const first = await inertiaPage(client, support.session, '/')
    first.assertStatus(200)
    assert.equal(first.inertiaComponent, 'admin/home')
    assert.notProperty(first.inertiaProps, 'attention')

    const reload = await homeAttention(client, support.session)
    const items = (reload.inertiaProps as { attention: { key: string; count: number }[] }).attention
    const byKey = Object.fromEntries(items.map((item) => [item.key, item.count]))
    assert.equal(byKey.help_new, 2)
    assert.equal(byKey.problems_new, 1)
    assert.notProperty(byKey, 'curriculum_signoff')
    assert.notProperty(byKey, 'failed_jobs')

    const researcher = await signInAs(client, 'researcher')
    const researcherReload = await homeAttention(client, researcher.session)
    const researcherItems = (
      researcherReload.inertiaProps as { attention: { key: string; count: number }[] }
    ).attention
    assert.deepEqual(
      researcherItems.map((item) => [item.key, item.count]),
      [['problems_triaged', 1]]
    )
  })

  test('help counts follow the area scope', async ({ assert }) => {
    const school = await createSchool('SD Uji')
    const teacher = await createTeacher(school)
    await helpRequest(school.id, teacher.id, 'new')
    await seedRegionList(db.connection(), {
      kemendagriCode: '34',
      name: 'DI Yogyakarta',
      children: [{ kemendagriCode: '34.99', name: 'Jauh', regencyKind: 'kabupaten' }],
    })
    const far = await Region.findByOrFail('kemendagriCode', '34.99')
    const scoped = await createStaff(['support'], { regionIds: [far.id] })
    await loadStaffAccess(scoped)
    const items = await attentionFor(scoped)
    assert.equal(items.find((item) => item.key === 'help_new')?.count, 0)
  })
})

test.group('Console pass | Staf and Log aktivitas', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('the staff list shows 2FA per member', async ({ client, assert }) => {
    const { staff: owner, session } = await signInAs(client, 'owner')
    const enrolled = await createStaff(['support'])
    await enrolTwoFactor(enrolled)
    const plain = await createStaff(['content'])
    const page = await inertiaPage(client, session, '/staf')
    const rows = page.inertiaProps.staff as {
      id: number
      twoFactor: { enabled: boolean; required: boolean }
    }[]
    const of = (id: number) => rows.find((row) => row.id === id)!.twoFactor
    assert.deepEqual(of(owner.id), { enabled: true, required: true })
    assert.deepEqual(of(enrolled.id), { enabled: true, required: false })
    assert.deepEqual(of(plain.id), { enabled: false, required: false })
  })

  test('Log aktivitas names R2 subjects', async ({ client, assert }) => {
    const { staff, session } = await signInAs(client, 'owner')
    const problemId = await problem('new', 'Kalender belum memuat libur daerah')
    const now = new Date()
    const [version] = await db
      .table('curriculum_versions')
      .insert({
        code: 'UJI-SD-2026-R1',
        name: 'Kurikulum Uji SD',
        kind: 'cp',
        status: 'draft',
        applies_from_school_year: '2026/2027',
        meta: JSON.stringify({}),
        created_at: now,
        updated_at: now,
      })
      .returning('id')
    await logStaffActivity(staff, 'problem.update', 'problem', problemId, {})
    await logStaffActivity(staff, 'setting.updated', 'setting', 'trial.extend_max_days', {})
    await logStaffActivity(staff, 'ai_model.updated', 'ai_model', 'document_short', {})
    await logStaffActivity(staff, 'integration.updated', 'integration', 'mail', {})
    await logStaffActivity(
      staff,
      'curriculum.signoff',
      'curriculum_version',
      Number(version.id),
      {}
    )

    const page = await inertiaPage(client, session, '/log-aktivitas')
    const names = (page.inertiaProps.entries as { subjectType: string; subjectName: string }[])
      .filter((entry) => entry.subjectType !== 'staff')
      .map((entry) => entry.subjectName)
    assert.include(
      names,
      'BM-' + String(problemId).padStart(4, '0') + ' Kalender belum memuat libur daerah'
    )
    assert.include(names, 'Batas tambah hari uji coba')
    assert.include(names, 'Dokumen pendek')
    assert.include(names, 'Email')
    assert.include(names, 'Kurikulum Uji SD (UJI-SD-2026-R1)')
  })
})

test.group('Console pass | Kesehatan sistem services', () => {
  test('a cache that does not answer is a warning, not an error', async ({ assert }) => {
    assert.deepEqual(await collectCache(async () => null), {
      reachable: false,
      usedBytes: null,
      maxBytes: null,
    })
    assert.deepEqual(
      await collectCache(async () => ({ info: 'used_memory:1048576\r\nmaxmemory:0\r\n' })),
      { reachable: true, usedBytes: 1_048_576, maxBytes: null }
    )
    assert.deepEqual(
      await collectCache(async () => ({ info: 'used_memory:2048\r\nmaxmemory:4096\r\n' })),
      { reachable: true, usedBytes: 2048, maxBytes: 4096 }
    )
  })

  test('the real cache connection answers in tests', async ({ assert }) => {
    const cache = await collectCache()
    assert.isTrue(cache.reachable)
  })

  test('mail that sends nothing warns only in production', async ({ assert }) => {
    const none = async () => ({ source: 'none' as const, sends: false })
    const json = async () => ({ source: 'env' as const, sends: false })
    const smtp = async () => ({ source: 'console' as const, sends: true })
    const productionNone = await collectMail({ production: true, delivery: none })
    const productionJson = await collectMail({ production: true, delivery: json })
    const developmentNone = await collectMail({ production: false, delivery: none })
    assert.isTrue(productionNone.warn)
    assert.isTrue(productionJson.warn)
    assert.isFalse(developmentNone.warn)
    assert.deepEqual(await collectMail({ production: true, delivery: smtp }), {
      source: 'console',
      sends: true,
      warn: false,
    })
  })
})
