import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Announcement from '#models/announcement'
import StaffActivityLog from '#models/staff_activity_log'
import User from '#models/user'
import { markRead, unreadCount, visibleInApp, visiblePublicly } from '#publishing/announcement_feed'
import { loadPlaces, refusalFor, type AnnouncementDraft } from '#publishing/announcement_rules'
import { inertiaPage, memberUser, signIn } from '#tests/accounts'
import { PASSWORD, createStaff, visit } from '#tests/helpers'
import { createAnnouncement, postJson, schoolIn, twoRegencies } from '#tests/publishing'
import type StaffUser from '#models/staff_user'

/**
 * Kabar (R2-05, D-319, D-477): who sees which Kabar in the app and on
 * sigrak.com, the date window, unread counts, and which staff role may
 * write which Kabar to whom.
 */

async function titlesFor(userId: number) {
  const rows = (await visibleInApp(userId).select('a.title').orderBy('a.title')) as {
    title: string
  }[]
  return rows.map((row) => row.title)
}

async function publicTitles() {
  const rows = (await visiblePublicly().select('a.title').orderBy('a.title')) as {
    title: string
  }[]
  return rows.map((row) => row.title)
}

async function loneTeacher() {
  return User.create({
    name: 'Guru Mandiri',
    email: `mandiri-${Date.now().toString(36)}@uji.test`,
    password: PASSWORD,
    nip: null,
  })
}

/** Two kabupaten, an SD in each, an MI in the first, and members. */
async function world() {
  const places = await twoRegencies()
  const sdA = await schoolIn('SD Uji A', places.regency, places.district, 'sd')
  const miA = await schoolIn('MI Uji A', places.regency, places.district, 'mi')
  const sdB = await schoolIn('SD Uji B', places.otherRegency, places.otherDistrict, 'sd')
  const teacherA = await memberUser(sdA, 'teacher')
  const principalA = await memberUser(sdA, 'principal')
  const teacherMi = await memberUser(miA, 'teacher')
  const teacherB = await memberUser(sdB, 'teacher')
  return { ...places, sdA, miA, sdB, teacherA, principalA, teacherMi, teacherB }
}

test.group('Kabar | who sees it in the app', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('a Kabar without targets reaches every school user, also without a school', async ({
    assert,
  }) => {
    const w = await world()
    const lone = await loneTeacher()
    await createAnnouncement('Untuk semua')
    for (const user of [w.teacherA, w.principalA, w.teacherMi, w.teacherB, lone]) {
      assert.deepEqual(await titlesFor(user.id), ['Untuk semua'])
    }
  })

  test('region targets: kabupaten, kecamatan and province', async ({ assert }) => {
    const w = await world()
    await createAnnouncement('Kabupaten A', { targetRegionIds: [w.regency.id] })
    await createAnnouncement('Kecamatan B', { targetRegionIds: [w.otherDistrict.id] })
    await createAnnouncement('Provinsi', { targetRegionIds: [w.province.id] })

    assert.deepEqual(await titlesFor(w.teacherA.id), ['Kabupaten A', 'Provinsi'])
    assert.deepEqual(await titlesFor(w.teacherB.id), ['Kecamatan B', 'Provinsi'])
    // A teacher without a school is outside every region.
    const lone = await loneTeacher()
    assert.deepEqual(await titlesFor(lone.id), [])
  })

  test('school, level and role targets must all match one place', async ({ assert }) => {
    const w = await world()
    await createAnnouncement('Sekolah B', { targetSchoolIds: [w.sdB.id] })
    await createAnnouncement('Hanya MI', { targetLevels: ['mi'] })
    await createAnnouncement('Kepala sekolah', { targetRoles: ['principal'] })
    await createAnnouncement('Kepala sekolah MI di A', {
      targetRegionIds: [w.regency.id],
      targetLevels: ['mi'],
      targetRoles: ['principal'],
    })

    assert.deepEqual(await titlesFor(w.teacherB.id), ['Sekolah B'])
    assert.deepEqual(await titlesFor(w.teacherMi.id), ['Hanya MI'])
    assert.deepEqual(await titlesFor(w.principalA.id), ['Kepala sekolah'])
    assert.deepEqual(await titlesFor(w.teacherA.id), [])
    const lone = await loneTeacher()
    assert.deepEqual(await titlesFor(lone.id), [])
  })

  test('a teacher without a school gets teacher Kabar without places', async ({ assert }) => {
    await world()
    const lone = await loneTeacher()
    await createAnnouncement('Untuk guru', { targetRoles: ['teacher'] })
    await createAnnouncement('Untuk operator', { targetRoles: ['operator'] })
    assert.deepEqual(await titlesFor(lone.id), ['Untuk guru'])
  })

  test('a pengawas is reached through an approved assignment', async ({ assert }) => {
    const w = await world()
    const supervisor = await loneTeacher()
    // Owner connection: the assignment belongs to school B (RLS, D-309).
    await db.table('supervisor_assignments').insert({
      user_id: supervisor.id,
      school_id: w.sdB.id,
      status: 'approved',
      started_on: '2026-07-01',
      decided_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    })
    await createAnnouncement('Untuk pengawas', { targetRoles: ['supervisor'] })
    await createAnnouncement('Pengawas di A', {
      targetRoles: ['supervisor'],
      targetRegionIds: [w.regency.id],
    })
    await createAnnouncement('Untuk guru', { targetRoles: ['teacher'] })
    assert.deepEqual(await titlesFor(supervisor.id), ['Untuk pengawas'])

    // An ended assignment no longer counts (and the user is not a lone teacher either).
    await db
      .from('supervisor_assignments')
      .where('user_id', supervisor.id)
      .update({ ended_on: '2026-08-01' })
    assert.deepEqual(await titlesFor(supervisor.id), ['Untuk guru'])
  })

  test('date window, drafts and app-only versus public-only', async ({ assert }) => {
    const w = await world()
    const now = DateTime.now()
    await createAnnouncement('Sekarang', {
      startsAt: now.minus({ hours: 1 }),
      endsAt: now.plus({ hours: 1 }),
    })
    await createAnnouncement('Nanti', { startsAt: now.plus({ days: 1 }) })
    await createAnnouncement('Sudah lewat', { endsAt: now.minus({ minutes: 1 }) })
    await createAnnouncement('Draf', { status: 'draft' })
    await createAnnouncement('Hanya situs', { showInApp: false, showPublic: true })
    await createAnnouncement('Keduanya', {
      showPublic: true,
      targetRegionIds: [w.otherRegency.id],
    })

    assert.deepEqual(await titlesFor(w.teacherA.id), ['Sekarang'])
    assert.deepEqual(await titlesFor(w.teacherB.id), ['Keduanya', 'Sekarang'])
    // Targets never apply on sigrak.com; the window does.
    assert.deepEqual(await publicTitles(), ['Hanya situs', 'Keduanya'])
    assert.deepEqual(
      (
        (await visibleInApp(w.teacherA.id, now.plus({ days: 2 }).toJSDate()).select('a.title')) as {
          title: string
        }[]
      ).map((row) => row.title),
      ['Nanti']
    )
  })

  test('unread count and marking read', async ({ assert }) => {
    const w = await world()
    const first = await createAnnouncement('Satu')
    await createAnnouncement('Dua')
    await createAnnouncement('Bukan untuk A', { targetRegionIds: [w.otherRegency.id] })

    assert.equal(await unreadCount(w.teacherA.id), 2)
    await markRead(w.teacherA.id, [first.id])
    await markRead(w.teacherA.id, [first.id])
    assert.equal(await unreadCount(w.teacherA.id), 1)
    assert.equal(await unreadCount(w.teacherB.id), 3)
  })
})

test.group('Kabar | app pages', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('a teacher sees the badge, the list, opens a Kabar and marks all read', async ({
    client,
    assert,
  }) => {
    const w = await world()
    const one = await createAnnouncement('Kabar satu', { body: '**Penting** <script>x</script>' })
    const two = await createAnnouncement('Kabar dua')
    const other = await createAnnouncement('Untuk B', { targetSchoolIds: [w.sdB.id] })
    const session = await signIn(client, 'app', w.teacherA.email)

    const list = await inertiaPage(client, session, '/kabar')
    assert.equal(list.status(), 200)
    assert.equal(list.inertiaComponent, 'announcements/index')
    const props = list.inertiaProps as {
      kabarUnread: number
      announcements: { slug: string; unread: boolean }[]
    }
    assert.equal(props.kabarUnread, 2)
    assert.sameMembers(
      props.announcements.map((item) => item.slug),
      [one.slug, two.slug]
    )

    const shown = await inertiaPage(client, session, `/kabar/${one.slug}`)
    const announcement = (shown.inertiaProps as { announcement: { html: string } }).announcement
    assert.include(announcement.html, '<strong>Penting</strong>')
    assert.notInclude(announcement.html, '<script')
    assert.equal((shown.inertiaProps as { kabarUnread: number }).kabarUnread, 1)

    const hidden = await visit(client, 'app', `/kabar/${other.slug}`, {
      name: 'sigrak_app_session',
      sessionId: session.sessionId,
    })
    assert.equal(hidden.status(), 404)

    const done = await postJson(client, session, '/kabar/tandai-dibaca', {}, '/kabar')
    assert.equal(done.status(), 302)
    assert.equal(await unreadCount(w.teacherA.id), 0)
  })
})

/** A draft for the rules: app Kabar of a kind to some targets. */
function draft(fields: Partial<AnnouncementDraft> = {}): AnnouncementDraft {
  return {
    kind: 'general',
    showInApp: true,
    showPublic: false,
    targetRegionIds: [],
    targetSchoolIds: [],
    targetLevels: [],
    ...fields,
  }
}

async function refusal(staff: StaffUser, value: AnnouncementDraft) {
  return refusalFor(staff, value, await loadPlaces(value.targetRegionIds, value.targetSchoolIds))
}

test.group('Kabar | who may write what', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('Kurator kurikulum writes only curriculum notices, Teknis only maintenance', async ({
    assert,
  }) => {
    const curator = await createStaff(['curriculum'])
    const engineer = await createStaff(['engineer'])
    assert.isNull(await refusal(curator, draft({ kind: 'curriculum' })))
    assert.equal(await refusal(curator, draft({ kind: 'general' })), 'kind')
    assert.equal(await refusal(curator, draft({ kind: 'maintenance' })), 'kind')
    assert.isNull(await refusal(engineer, draft({ kind: 'maintenance' })))
    assert.equal(await refusal(engineer, draft({ kind: 'curriculum' })), 'kind')
    assert.equal(await refusal(engineer, draft({ kind: 'event' })), 'kind')
    // Neither may show a Kabar on sigrak.com.
    assert.equal(
      await refusal(engineer, draft({ kind: 'maintenance', showPublic: true })),
      'public'
    )
  })

  test('a curator limited to MI writes only to MI', async ({ assert }) => {
    const curator = await createStaff(['curriculum'], { levels: ['mi'] })
    assert.equal(await refusal(curator, draft({ kind: 'curriculum' })), 'targets')
    assert.equal(
      await refusal(curator, draft({ kind: 'curriculum', targetLevels: ['sd', 'mi'] })),
      'targets'
    )
    assert.isNull(await refusal(curator, draft({ kind: 'curriculum', targetLevels: ['mi'] })))
  })

  test('area roles write only inside their area; Pemasaran also on sigrak.com', async ({
    assert,
  }) => {
    const w = await world()
    const marketing = await createStaff(['marketing'], { regionIds: [w.regency.id] })
    assert.isNull(await refusal(marketing, draft({ targetRegionIds: [w.regency.id] })))
    assert.isNull(await refusal(marketing, draft({ targetRegionIds: [w.district.id] })))
    assert.isNull(await refusal(marketing, draft({ targetSchoolIds: [w.sdA.id] })))
    assert.equal(await refusal(marketing, draft()), 'targets', 'every school is outside')
    assert.equal(await refusal(marketing, draft({ targetRegionIds: [w.province.id] })), 'targets')
    assert.equal(
      await refusal(marketing, draft({ targetRegionIds: [w.regency.id, w.otherDistrict.id] })),
      'targets'
    )
    assert.equal(await refusal(marketing, draft({ targetSchoolIds: [w.sdB.id] })), 'targets')
    assert.equal(await refusal(marketing, draft({ kind: 'curriculum' })), 'kind')
    // Public only: no targets, so no area check.
    assert.isNull(await refusal(marketing, draft({ showInApp: false, showPublic: true })))

    const noArea = await createStaff(['marketing'])
    assert.equal(await refusal(noArea, draft({ targetRegionIds: [w.regency.id] })), 'targets')
  })

  test('Penjualan writes to its own schools; Dukungan without an area everywhere', async ({
    assert,
  }) => {
    const w = await world()
    const sales = await createStaff(['sales'], { schoolIds: [w.sdA.id] })
    assert.isNull(await refusal(sales, draft({ targetSchoolIds: [w.sdA.id] })))
    assert.equal(await refusal(sales, draft({ targetSchoolIds: [w.sdB.id] })), 'targets')
    assert.equal(await refusal(sales, draft({ targetRegionIds: [w.regency.id] })), 'targets')

    const support = await createStaff(['support'])
    assert.isNull(await refusal(support, draft()))
    assert.equal(await refusal(support, draft({ showPublic: true })), 'public')
    const supportB = await createStaff(['support'], { regionIds: [w.otherRegency.id] })
    assert.isNull(await refusal(supportB, draft({ targetSchoolIds: [w.sdB.id] })))
    assert.equal(await refusal(supportB, draft()), 'targets')
  })

  test('one role must cover the whole Kabar', async ({ assert }) => {
    const w = await world()
    // Curriculum kinds everywhere, general news only in kabupaten A.
    const both = await createStaff(['curriculum'])
    await both.related('roleAssignments').create({
      role: 'marketing',
      regionIds: [w.regency.id],
      schoolIds: [],
      levels: [],
      fields: [],
    })
    await both.load('roleAssignments')
    assert.isNull(await refusal(both, draft({ kind: 'curriculum' })))
    assert.isNull(await refusal(both, draft({ targetRegionIds: [w.regency.id] })))
    assert.equal(await refusal(both, draft()), 'targets')
  })

  test('admin and owner write anything; other roles have no Kabar at all', async ({
    client,
    assert,
  }) => {
    const w = await world()
    for (const role of ['admin', 'owner'] as const) {
      const staff = await createStaff([role])
      assert.isNull(
        await refusal(
          staff,
          draft({ kind: 'maintenance', showPublic: true, targetSchoolIds: [w.sdB.id] })
        )
      )
    }
    for (const role of ['finance', 'validator', 'content', 'researcher'] as const) {
      const staff = await createStaff([role])
      const session = await signIn(client, 'admin', staff.email)
      const page = await visit(client, 'admin', '/kabar', {
        name: 'sigrak_admin_session',
        sessionId: session.sessionId,
      })
      assert.equal(page.status(), 403, role)
    }
  })
})

test.group('Kabar | console editor', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('an admin writes, publishes, takes back and removes a Kabar; each step is logged', async ({
    client,
    assert,
  }) => {
    const w = await world()
    const admin = await createStaff(['admin'])
    const session = await signIn(client, 'admin', admin.email)

    const created = await postJson(
      client,
      session,
      '/kabar',
      {
        title: 'Libur akhir semester',
        body: 'Isi **penting**.',
        kind: 'general',
        show_in_app: true,
        show_public: true,
        target_region_ids: [w.regency.id],
        target_levels: ['sd'],
        target_roles: ['teacher'],
        show_from: '2026-12-01T08:00',
        show_until: '2026-12-31T17:00',
      },
      '/kabar/baru'
    )
    assert.equal(created.status(), 302)
    const announcement = await Announcement.findByOrFail('title', 'Libur akhir semester')
    assert.equal(created.header('location'), `/kabar/${announcement.id}`)
    assert.equal(announcement.status, 'draft')
    assert.equal(announcement.slug, 'libur-akhir-semester')
    assert.deepEqual(announcement.targetRegionIds, [w.regency.id])
    assert.equal(announcement.startsAt!.toUTC().toISO(), '2026-12-01T01:00:00.000Z')

    const page = await inertiaPage(client, session, `/kabar/${announcement.id}`)
    const props = page.inertiaProps as {
      announcement: { showFrom: string; regions: { name: string }[] }
    }
    assert.equal(props.announcement.showFrom, '2026-12-01T08:00')
    assert.equal(props.announcement.regions[0].name, 'Uji')

    const published = await postJson(client, session, `/kabar/${announcement.id}`, {
      title: 'Libur akhir semester 2026',
      body: 'Isi **penting**.',
      kind: 'general',
      show_in_app: true,
      show_public: false,
      target_region_ids: [w.regency.id],
      publish: true,
    })
    assert.equal(published.status(), 302)
    await announcement.refresh()
    assert.equal(announcement.status, 'published')
    assert.isNotNull(announcement.publishedAt)
    assert.equal(announcement.slug, 'libur-akhir-semester-2026')
    assert.deepEqual(announcement.targetLevels, [])
    assert.isNull(announcement.startsAt)

    // Once published the address stays.
    await postJson(client, session, `/kabar/${announcement.id}`, {
      title: 'Judul baru',
      body: 'Isi.',
      kind: 'general',
      show_in_app: true,
      show_public: false,
    })
    await announcement.refresh()
    assert.equal(announcement.slug, 'libur-akhir-semester-2026')

    await postJson(client, session, `/kabar/${announcement.id}/tarik`, {})
    await announcement.refresh()
    assert.equal(announcement.status, 'draft')
    await postJson(client, session, `/kabar/${announcement.id}/hapus`, {})
    assert.isNull(await Announcement.find(announcement.id))

    const actions = await StaffActivityLog.query()
      .where('subject_type', 'announcement')
      .orderBy('id')
      .select('action')
    assert.deepEqual(
      actions.map((log) => log.action),
      [
        'announcement.created',
        'announcement.published',
        'announcement.updated',
        'announcement.unpublished',
        'announcement.deleted',
      ]
    )
  })

  test('the server refuses a kind, target or place the role may not use', async ({
    client,
    assert,
  }) => {
    const w = await world()
    const curator = await createStaff(['curriculum'])
    const curatorSession = await signIn(client, 'admin', curator.email)
    const general = await postJson(client, curatorSession, '/kabar', {
      title: 'Kabar umum',
      body: 'Isi.',
      kind: 'general',
      show_in_app: true,
      show_public: false,
    })
    assert.equal(general.status(), 302)
    assert.equal(general.header('location'), '/kabar/baru')
    assert.lengthOf(await Announcement.all(), 0)

    const marketing = await createStaff(['marketing'], { regionIds: [w.regency.id] })
    const marketingSession = await signIn(client, 'admin', marketing.email)
    await postJson(client, marketingSession, '/kabar', {
      title: 'Webinar di B',
      body: 'Isi.',
      kind: 'event',
      show_in_app: true,
      show_public: false,
      target_region_ids: [w.otherRegency.id],
    })
    await postJson(client, marketingSession, '/kabar', {
      title: 'Tanpa tempat',
      body: 'Isi.',
      kind: 'event',
      show_in_app: false,
      show_public: false,
    })
    const ok = await postJson(client, marketingSession, '/kabar', {
      title: 'Webinar di A',
      body: 'Isi.',
      kind: 'event',
      show_in_app: true,
      show_public: true,
      target_region_ids: [w.regency.id],
      publish: true,
    })
    assert.equal(ok.status(), 302)
    const saved = await Announcement.query().select('title')
    const titles = saved.map((row) => row.title)
    assert.deepEqual(titles, ['Webinar di A'])
  })

  test('staff see and open only the Kabar they may hold', async ({ client, assert }) => {
    const w = await world()
    const inA = await createAnnouncement('Di A', { targetRegionIds: [w.regency.id] })
    const inB = await createAnnouncement('Di B', { targetRegionIds: [w.otherRegency.id] })
    await createAnnouncement('Kurikulum', { kind: 'curriculum' })
    const marketing = await createStaff(['marketing'], { regionIds: [w.regency.id] })
    const session = await signIn(client, 'admin', marketing.email)

    const list = await inertiaPage(client, session, '/kabar')
    const rows = (list.inertiaProps as { announcements: { title: string }[] }).announcements
    assert.deepEqual(
      rows.map((row) => row.title),
      ['Di A']
    )
    const cookie = { name: 'sigrak_admin_session', sessionId: session.sessionId }
    const own = await visit(client, 'admin', `/kabar/${inA.id}`, cookie)
    assert.equal(own.status(), 200)
    const foreign = await visit(client, 'admin', `/kabar/${inB.id}`, cookie)
    assert.equal(foreign.status(), 403)
    const changed = await postJson(client, session, `/kabar/${inB.id}/tarik`, {})
    assert.equal(changed.status(), 403)
    await inB.refresh()
    assert.equal(inB.status, 'published')
  })

  test('target search offers only places inside the scope', async ({ client, assert }) => {
    const w = await world()
    const marketing = await createStaff(['marketing'], { regionIds: [w.regency.id] })
    const session = await signIn(client, 'admin', marketing.email)
    const cookie = { name: 'sigrak_admin_session', sessionId: session.sessionId }

    const regions = await visit(client, 'admin', '/kabar/pilihan-sasaran?wilayah=Uji', cookie)
    const regionIds = (regions.body() as { regions: { id: number }[] }).regions.map((r) => r.id)
    assert.sameMembers(regionIds, [w.regency.id, w.district.id])

    const schools = await visit(client, 'admin', '/kabar/pilihan-sasaran?sekolah=SD%20Uji', cookie)
    const schoolNames = (schools.body() as { schools: { name: string }[] }).schools.map(
      (s) => s.name
    )
    assert.deepEqual(schoolNames, ['SD Uji A'])

    const admin = await createStaff(['admin'])
    const adminSession = await signIn(client, 'admin', admin.email)
    const all = await visit(client, 'admin', '/kabar/pilihan-sasaran?wilayah=Uji', {
      name: 'sigrak_admin_session',
      sessionId: adminSession.sessionId,
    })
    assert.lengthOf((all.body() as { regions: unknown[] }).regions, 4)
  })
})
