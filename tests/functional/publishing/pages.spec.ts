import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Event from '#models/event'
import LegalDocument from '#models/legal_document'
import StaffActivityLog from '#models/staff_activity_log'
import Story from '#models/story'
import { currentVersion, publishDraft, startDraft, upcomingVersion } from '#publishing/legal'
import { inertiaPage, signIn } from '#tests/accounts'
import { createStaff, visit } from '#tests/helpers'
import { createAnnouncement, postJson, publicStatus, visitPublic } from '#tests/publishing'

/**
 * sigrak.com pages (R2-05, D-435) and the Acara, Cerita Sekolah and
 * legal page editors: only published content shows, public pages set
 * no cookie, every legal version stays readable and never changes.
 */

function adminCookie(sessionId: string) {
  return { name: 'sigrak_admin_session', sessionId }
}

test.group('Publishing | sigrak.com pages', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('Kabar list and page show public Kabar only, without a session cookie', async ({
    client,
    assert,
  }) => {
    const shown = await createAnnouncement('Kabar umum', {
      showPublic: true,
      body: '## Isi\n<script>alert(1)</script> [tautan](javascript:alert(1))',
    })
    await createAnnouncement('Hanya aplikasi')
    await createAnnouncement('Draf publik', { showPublic: true, status: 'draft' })
    await createAnnouncement('Nanti', {
      showPublic: true,
      startsAt: DateTime.now().plus({ days: 1 }),
    })

    const list = await visitPublic(client, '/kabar')
    assert.equal(list.status(), 200)
    assert.include(list.text(), 'Kabar umum')
    assert.notInclude(list.text(), 'Hanya aplikasi')
    assert.notInclude(list.text(), 'Draf publik')
    assert.notInclude(list.text(), 'Nanti')
    assert.isUndefined(list.header('set-cookie'))
    assert.equal(list.header('cache-control'), 'public, max-age=300')
    assert.include(list.header('content-security-policy') ?? '', "default-src 'self'")

    const page = await visitPublic(client, `/kabar/${shown.slug}`)
    assert.equal(page.status(), 200)
    assert.include(page.text(), '<h2>Isi</h2>')
    assert.include(page.text(), '&lt;script&gt;')
    assert.notInclude(page.text(), '<script>alert')
    assert.notInclude(page.text(), 'href="javascript')

    const app = await createAnnouncement('Rahasia aplikasi')
    assert.equal(await publicStatus(client, `/kabar/${app.slug}`), 404)
    assert.equal(await publicStatus(client, '/kabar/tidak-ada'), 404)
  })

  test('Acara lists upcoming and past published events; Cerita Sekolah its stories', async ({
    client,
    assert,
  }) => {
    const base = {
      body: 'Isi acara.',
      status: 'published' as const,
      publishedAt: DateTime.now(),
    }
    await Event.create({
      ...base,
      slug: 'webinar-rpm',
      title: 'Webinar RPM',
      startsAt: DateTime.fromISO('2099-01-10T08:00', { zone: 'Asia/Jakarta' }),
      endsAt: DateTime.fromISO('2099-01-10T10:00', { zone: 'Asia/Jakarta' }),
      onlineUrl: 'https://meet.example/rpm',
      registrationUrl: 'https://daftar.example/rpm',
    })
    await Event.create({
      ...base,
      slug: 'pelatihan-lalu',
      title: 'Pelatihan lalu',
      startsAt: DateTime.fromISO('2020-01-10T08:00'),
      place: 'Aula Uji',
    })
    await Event.create({
      body: '',
      slug: 'acara-draf',
      title: 'Acara draf',
      startsAt: DateTime.fromISO('2099-02-10T08:00'),
      place: 'Aula Uji',
      status: 'draft',
      publishedAt: null,
    })
    const events = await visitPublic(client, '/acara')
    assert.equal(events.status(), 200)
    const text = events.text()
    assert.include(text, 'Webinar RPM')
    assert.include(text, '10 Januari 2099, 08.00–10.00 WIB')
    assert.include(text, 'Pelatihan lalu')
    assert.notInclude(text, 'Acara draf')
    assert.isBelow(text.indexOf('Webinar RPM'), text.indexOf('Pelatihan lalu'))
    const event = await visitPublic(client, '/acara/webinar-rpm')
    assert.include(event.text(), 'https://daftar.example/rpm')
    assert.equal(await publicStatus(client, '/acara/acara-draf'), 404)

    await Story.create({
      slug: 'cerita-sd-uji',
      title: 'Guru SD Uji menyusun RPM',
      body: 'Cerita.',
      schoolName: 'SD Negeri Uji',
      consentNote: 'Kepala sekolah setuju lewat surat.',
      consentOn: DateTime.fromISO('2026-11-01'),
      status: 'published',
      publishedAt: DateTime.now(),
    })
    const stories = await visitPublic(client, '/cerita-sekolah')
    assert.include(stories.text(), 'SD Negeri Uji')
    assert.notInclude(stories.text(), 'Kepala sekolah setuju')
    assert.equal(await publicStatus(client, '/cerita-sekolah/cerita-sd-uji'), 200)
  })

  test('public pages answer only on the bare domain', async ({ client, assert }) => {
    await createAnnouncement('Kabar umum', { showPublic: true })
    const onAdmin = await visit(client, 'admin', '/syarat-penggunaan')
    assert.equal(onAdmin.status(), 404)
    const onPublic = await visitPublic(client, '/syarat-penggunaan')
    assert.equal(onPublic.status(), 200)
    assert.include(onPublic.text(), 'Halaman ini sedang disiapkan.')
  })
})

test.group('Publishing | legal versions', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('a draft starts from the placeholder, publishes once and never changes again', async ({
    client,
    assert,
  }) => {
    const admin = await createStaff(['admin'])
    const session = await signIn(client, 'admin', admin.email)

    const started = await postJson(client, session, '/halaman-legal/terms/versi-baru', {})
    assert.equal(started.status(), 302)
    const draft = await LegalDocument.findByOrFail('key', 'terms')
    assert.equal(started.header('location'), `/halaman-legal/versi/${draft.id}`)
    assert.equal(draft.version, 1)
    assert.include(draft.body, 'perlu ditinjau ahli hukum')

    // One draft per page.
    await postJson(client, session, '/halaman-legal/terms/versi-baru', {})
    assert.lengthOf(await LegalDocument.query().where('key', 'terms'), 1)

    await postJson(client, session, `/halaman-legal/versi/${draft.id}`, {
      title: 'Syarat penggunaan SIGRAK',
      body: '## Pasal 1\nIsi versi satu.',
      effective_on: '2026-01-01',
      change_note: 'Versi pertama.',
    })
    await postJson(client, session, `/halaman-legal/versi/${draft.id}/terbitkan`, {})
    await draft.refresh()
    assert.equal(draft.status, 'published')
    assert.equal(draft.effectiveOn.toISODate(), '2026-01-01')
    assert.equal(draft.publishedByStaffId, admin.id)

    // The console refuses to change it, and so does the database.
    await postJson(client, session, `/halaman-legal/versi/${draft.id}`, {
      title: 'Diubah',
      body: 'Diubah.',
      effective_on: '2026-02-01',
    })
    await draft.refresh()
    assert.equal(draft.title, 'Syarat penggunaan SIGRAK')
    await assert.rejects(
      () => db.from('legal_documents').where('id', draft.id).update({ body: 'x' }),
      /cannot change/
    )
    await assert.rejects(
      () => db.from('legal_documents').where('id', draft.id).delete(),
      /cannot change/
    )

    const page = await visitPublic(client, '/syarat-penggunaan')
    assert.include(page.text(), 'Versi 1')
    assert.include(page.text(), 'Berlaku sejak 1 Januari 2026')
    assert.include(page.text(), 'Isi versi satu.')

    const actions = await StaffActivityLog.query()
      .where('subject_type', 'legal_document')
      .orderBy('id')
    assert.deepEqual(
      actions.map((log) => log.action),
      ['legal_document.draft_started', 'legal_document.updated', 'legal_document.published']
    )
  })

  test('the page shows the version in force, notes the next one and keeps old ones', async ({
    client,
    assert,
  }) => {
    const admin = await createStaff(['owner'])
    const publish = async (body: string, effectiveOn: string) => {
      const draft = await startDraft(admin, 'privacy', { title: 'Kebijakan privasi', body })
      draft.merge({ body, effectiveOn: DateTime.fromISO(effectiveOn) })
      await draft.save()
      await publishDraft(admin, draft)
      return draft
    }
    await publish('Isi versi satu.', '2026-01-01')
    const second = await publish('Isi versi dua.', '2026-06-01')
    await publish('Isi versi tiga.', '2099-01-01')

    assert.equal((await currentVersion('privacy', '2026-11-28'))!.id, second.id)
    assert.equal((await upcomingVersion('privacy', '2026-11-28'))!.version, 3)
    assert.equal((await currentVersion('privacy', '2026-03-01'))!.version, 1)
    assert.isNull(await currentVersion('privacy', '2025-12-31'))

    const page = await visitPublic(client, '/kebijakan-privasi')
    const text = page.text()
    assert.include(text, 'Isi versi dua.')
    assert.include(text, 'Versi 3 berlaku mulai 1 Januari 2099.')
    assert.include(text, '/kebijakan-privasi?versi=1')

    const old = await visitPublic(client, '/kebijakan-privasi?versi=1')
    assert.include(old.text(), 'Isi versi satu.')
    assert.include(old.text(), 'Ini bukan versi yang berlaku sekarang.')
    assert.equal(await publicStatus(client, '/kebijakan-privasi?versi=9'), 404)
  })

  test('only owner and admin open the legal pages; a draft can be discarded', async ({
    client,
    assert,
  }) => {
    const marketing = await createStaff(['marketing'])
    const marketingSession = await signIn(client, 'admin', marketing.email)
    const forbidden = await visit(
      client,
      'admin',
      '/halaman-legal',
      adminCookie(marketingSession.sessionId)
    )
    assert.equal(forbidden.status(), 403)

    const admin = await createStaff(['admin'])
    const session = await signIn(client, 'admin', admin.email)
    const list = await inertiaPage(client, session, '/halaman-legal')
    const pages = (list.inertiaProps as { pages: { key: string }[] }).pages
    assert.deepEqual(
      pages.map((page) => page.key),
      ['terms', 'privacy', 'student_data']
    )
    await postJson(client, session, '/halaman-legal/student_data/versi-baru', {})
    const draft = await LegalDocument.findByOrFail('key', 'student_data')
    await postJson(client, session, `/halaman-legal/versi/${draft.id}/hapus`, {})
    assert.isNull(await LegalDocument.find(draft.id))
  })
})

test.group('Publishing | Acara and Cerita Sekolah editors', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('Pemasaran adds and publishes an Acara; a place or link is required', async ({
    client,
    assert,
  }) => {
    const marketing = await createStaff(['marketing'])
    const session = await signIn(client, 'admin', marketing.email)

    const missing = await postJson(client, session, '/acara', {
      title: 'Webinar tanpa tempat',
      event_start: '2026-12-10T08:00',
    })
    assert.equal(missing.header('location'), '/acara/baru')
    const backwards = await postJson(client, session, '/acara', {
      title: 'Webinar terbalik',
      event_start: '2026-12-10T08:00',
      event_end: '2026-12-10T07:00',
      place: 'Aula',
    })
    assert.equal(backwards.header('location'), '/acara/baru')
    assert.lengthOf(await Event.all(), 0)

    await postJson(client, session, '/acara', {
      title: 'Webinar Kurikulum',
      event_start: '2026-12-10T08:00',
      event_end: '2026-12-10T10:00',
      online_url: 'https://meet.example/k',
      publish: true,
    })
    const event = await Event.findByOrFail('title', 'Webinar Kurikulum')
    assert.equal(event.status, 'published')
    assert.equal(event.slug, 'webinar-kurikulum')
    assert.equal(event.startsAt.toUTC().toISO(), '2026-12-10T01:00:00.000Z')

    await postJson(client, session, `/acara/${event.id}/tarik`, {})
    await event.refresh()
    assert.equal(event.status, 'draft')

    const support = await createStaff(['support'])
    const supportSession = await signIn(client, 'admin', support.email)
    const denied = await visit(client, 'admin', '/acara', adminCookie(supportSession.sessionId))
    assert.equal(denied.status(), 403)
  })

  test('a story needs its consent note and date', async ({ client, assert }) => {
    const admin = await createStaff(['admin'])
    const session = await signIn(client, 'admin', admin.email)

    await postJson(client, session, '/cerita-sekolah', {
      title: 'Cerita tanpa persetujuan',
      body: 'Isi.',
      school_name: 'SD Negeri Uji',
    })
    assert.lengthOf(await Story.all(), 0)

    await postJson(client, session, '/cerita-sekolah', {
      title: 'Cerita SD Uji',
      body: 'Isi cerita.',
      school_name: 'SD Negeri Uji',
      consent_note: 'Kepala sekolah setuju lewat surat.',
      consent_on: '2026-11-01',
    })
    const story = await Story.findByOrFail('title', 'Cerita SD Uji')
    assert.equal(story.status, 'draft')
    assert.equal(await publicStatus(client, `/cerita-sekolah/${story.slug}`), 404)

    await postJson(client, session, `/cerita-sekolah/${story.id}/hapus`, {})
    assert.isNull(await Story.find(story.id))
  })
})
