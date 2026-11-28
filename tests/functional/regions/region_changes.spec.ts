import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { hosts } from '#config/hosts'
import { sessionCookieNames } from '#config/session'
import RegionChangeReview from '#models/region_change_review'
import School from '#models/school'
import type StaffUser from '#models/staff_user'
import { RegionChangeQueue, ReviewNotPendingException } from '#regions/region_change_queue'
import { importSchoolDirectory } from '#regions/school_directory_importer'
import { PASSWORD, createStaff, login, visit } from '#tests/helpers'
import {
  createSchoolIn,
  region,
  seedJawaTengah,
  smallKudusFile,
  writeDirectoryFile,
} from '#tests/regions'
import { assertRlsHides, assertSchoolCannotRead, asSchool } from '#tests/tenancy'
import { SchoolContext } from '#tenancy/school_context'

/**
 * A school in Kecamatan Jati whose directory row (NPSN `npsn`) says
 * `district`; the import queues one pending review for it. Committed
 * data: the staff and tenant connections must see it.
 */
async function pendingChange(name: string, npsn: string, district = 'Bae') {
  const school = await createSchoolIn(name, npsn, '33.19.03')
  const file = smallKudusFile()
  file.schools = [{ ...file.schools[0], npsn, name, district }]
  file.source = `https://referensi.data.kemendikdasmen.go.id/pendidikan/dikdas/031900/2?uji=${npsn}`
  await importSchoolDirectory(await writeDirectoryFile(file))
  const review = await RegionChangeReview.withoutSchoolScope({ connection: 'pg' })
    .where('school_id', school.id)
    .where('status', 'pending')
    .firstOrFail()
  return { school, review, file }
}

async function staffSession(client: ApiClient, role: StaffUser['role'] = 'support') {
  const staff = await createStaff()
  staff.role = role
  await staff.save()
  const { sessionId } = await login(client, 'admin', { email: staff.email, password: PASSWORD })
  const page = await visit(client, 'admin', '/', {
    name: sessionCookieNames.admin,
    sessionId: sessionId!,
  })
  return { staff, sessionId: sessionId!, csrf: page.cookie('XSRF-TOKEN')?.value as string }
}

function post(
  client: ApiClient,
  session: { sessionId: string; csrf: string },
  path: string,
  body: Record<string, unknown> = {}
) {
  return client
    .post(path)
    .header('host', hosts.admin)
    .header('x-csrf-token', session.csrf)
    .withCookie(sessionCookieNames.admin, session.sessionId)
    .form(body)
    .redirects(0)
}

/** Reads a review on the owner connection (outside any school context). */
const reload = (review: RegionChangeReview) =>
  RegionChangeReview.withoutSchoolScope({ connection: 'pg' }).where('id', review.id).firstOrFail()

const districtOf = async (id: number) => {
  const row = await schoolRow(id)
  return row.district as string | null
}
const districtIdOf = async (id: number) => {
  const row = await schoolRow(id)
  return row.district_id as number | null
}

const statusOf = async (review: RegionChangeReview) => {
  const row = await reload(review)
  return row.status
}

const schoolRow = (id: number) =>
  db
    .from('schools')
    .where('id', id)
    .select('region_id', 'district_id', 'district', 'region_source', 'region_checked_at')
    .firstOrFail()

test.group('Regions | change queue', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => seedJawaTengah())

  test('accepted from tomorrow, the change applies on that day only', async ({ assert }) => {
    const { school, review } = await pendingChange('MI Uji Dua', '90000002')
    const staff = await createStaff()

    const accepted = await RegionChangeQueue.accept(
      review.publicId,
      staff,
      'next_day',
      '2026-11-28'
    )
    assert.equal(accepted.status, 'accepted')
    assert.equal(accepted.effectiveOn!.toISODate(), '2026-11-29')
    assert.equal(accepted.decidedByStaffId, staff.id)

    assert.equal(await RegionChangeQueue.applyDue('2026-11-28'), 0)
    assert.equal(await districtOf(school.id), 'Jati')

    assert.equal(await RegionChangeQueue.applyDue('2026-11-29'), 1)
    const bae = await region('33.19.07')
    const moved = await schoolRow(school.id)
    assert.include(moved, {
      region_id: bae.parentId,
      district_id: bae.id,
      district: 'Bae',
      region_source: 'npsn_directory',
    })
    assert.isNotNull(moved.region_checked_at)
    assert.equal(await RegionChangeQueue.applyDue('2026-11-30'), 0)

    // The directory and the school agree now: the next import queues nothing.
    const again = await importSchoolDirectory(await writeDirectoryFile(smallKudusFile()))
    assert.equal(again.reviewsQueued, 0)
  })

  test('accepted from the next school year, it waits until 1 July', async ({ assert }) => {
    const { review } = await pendingChange('MI Uji Dua', '90000002')
    const accepted = await RegionChangeQueue.accept(
      review.publicId,
      await createStaff(),
      'next_school_year',
      '2026-11-28'
    )
    assert.equal(accepted.effectiveOn!.toISODate(), '2027-07-01')
    assert.equal(await RegionChangeQueue.applyDue('2027-06-30'), 0)
    assert.equal(await RegionChangeQueue.applyDue('2027-07-01'), 1)
  })

  test('a review is decided once; rejecting keeps the school', async ({ assert }) => {
    const { school, review } = await pendingChange('MI Uji Dua', '90000002')
    const staff = await createStaff()

    const rejected = await RegionChangeQueue.reject(review.publicId, staff, 'Data lama')
    assert.equal(rejected.status, 'rejected')
    assert.equal(rejected.note, 'Data lama')
    await assert.rejects(
      () => RegionChangeQueue.accept(review.publicId, staff, 'next_day'),
      ReviewNotPendingException
    )
    assert.equal(await RegionChangeQueue.applyDue('2099-01-01'), 0)
    assert.equal(await districtOf(school.id), 'Jati')
  })

  test('a newer accepted change replaces one still waiting for its date', async ({ assert }) => {
    const { school, review, file } = await pendingChange('MI Uji Dua', '90000002')
    const staff = await createStaff()
    await RegionChangeQueue.accept(review.publicId, staff, 'next_school_year', '2026-11-28')

    // The directory moves the school again before 1 July.
    file.schools[0].district = 'Dawe'
    await importSchoolDirectory(await writeDirectoryFile(file))
    const next = await RegionChangeReview.withoutSchoolScope({ connection: 'pg' })
      .where('status', 'pending')
      .firstOrFail()
    const bae = await region('33.19.07')
    const dawe = await region('33.19.09')
    assert.equal(next.fromDistrictId, bae.id)
    assert.equal(next.toDistrictId, dawe.id)

    await RegionChangeQueue.accept(next.publicId, staff, 'next_day', '2026-11-28')
    assert.equal(await statusOf(review), 'superseded')
    assert.equal(await RegionChangeQueue.applyDue('2026-11-29'), 1)
    assert.equal(await districtIdOf(school.id), dawe.id)
  })

  test('IDOR: a school sees only its own region changes and writes none', async ({ assert }) => {
    const a = await pendingChange('SD Uji A', '90000011')
    const b = await pendingChange('SD Uji B', '90000012')

    await assertSchoolCannotRead(assert, a.school, () => RegionChangeReview.find(b.review.id))
    await assertSchoolCannotRead(assert, a.school, () =>
      RegionChangeReview.withoutSchoolScope().where('id', b.review.id)
    )
    await assertRlsHides(assert, a.school, 'region_change_reviews', [b.review.id])

    const own = await asSchool(a.school, () => RegionChangeReview.query())
    assert.deepEqual(
      own.map((row) => row.id),
      [a.review.id]
    )

    // The school may read its row but not decide it or add one.
    const updated = await asSchool(a.school, async () => {
      const trx = SchoolContext.current()!.trx!
      return trx
        .from('region_change_reviews')
        .where('id', a.review.id)
        .update({ status: 'accepted' })
    })
    assert.equal(Number(updated), 0)
    await assert.rejects(
      () =>
        asSchool(a.school, async () => {
          const trx = SchoolContext.current()!.trx!
          await trx.table('region_change_reviews').insert({
            school_id: a.school.id,
            from_region_id: a.review.fromRegionId,
            to_region_id: a.review.toRegionId,
            to_district_id: a.review.toDistrictId,
            detected_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          })
        }),
      /row-level security/
    )
  })
})

test.group('Regions | console pages', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => seedJawaTengah())

  test('only admin and support open the region pages', async ({ client, assert }) => {
    for (const path of [
      '/perubahan-wilayah',
      '/direktori-sekolah',
      '/direktori-sekolah/90000001',
    ]) {
      const guest = await visit(client, 'admin', path)
      guest.assertStatus(302)
      assert.equal(guest.header('location'), '/masuk')
    }

    const content = await staffSession(client, 'content')
    const cookie = { name: sessionCookieNames.admin, sessionId: content.sessionId }
    for (const path of [
      '/perubahan-wilayah',
      '/direktori-sekolah',
      '/direktori-sekolah/90000001',
    ]) {
      const response = await visit(client, 'admin', path, cookie)
      response.assertStatus(403)
    }
    const { review } = await pendingChange('MI Uji Dua', '90000002')
    const refused = await post(client, content, `/perubahan-wilayah/${review.publicId}/terima`, {
      apply_from: 'next_day',
    })
    refused.assertStatus(403)
    assert.equal(await statusOf(review), 'pending')

    // A school session never reaches the console.
    const onApp = await visit(client, 'app', '/perubahan-wilayah')
    onApp.assertStatus(404)
  })

  test('support sees the queue and accepts or rejects from it', async ({ client, assert }) => {
    const first = await pendingChange('MI Uji Dua', '90000002')
    const second = await pendingChange('SD Uji Tiga', '90000003', 'Dawe')
    const session = await staffSession(client)
    const cookie = { name: sessionCookieNames.admin, sessionId: session.sessionId }

    const page = await visit(client, 'admin', '/perubahan-wilayah', cookie).withInertia()
    page.assertStatus(200)
    page.assertInertiaComponent('admin/region_changes')
    const props = page.inertiaProps as {
      pending: { id: string; to: { district: { name: string; kind: string } } }[]
      messages: Record<string, string>
    }
    assert.lengthOf(props.pending, 2)
    assert.deepInclude(props.pending[0].to.district, { name: 'Bae', kind: 'district' })
    assert.equal(props.messages['regions.changes.title'], 'Perubahan Wilayah')

    const accepted = await post(
      client,
      session,
      `/perubahan-wilayah/${first.review.publicId}/terima`,
      {
        apply_from: 'next_school_year',
      }
    )
    accepted.assertStatus(302)
    assert.equal(accepted.header('location'), '/perubahan-wilayah')
    const firstReview = await reload(first.review)
    assert.include(firstReview.$attributes, {
      status: 'accepted',
      applyFrom: 'next_school_year',
    })

    const rejected = await post(
      client,
      session,
      `/perubahan-wilayah/${second.review.publicId}/tolak`,
      {
        note: 'Sudah dicek ke sekolah',
      }
    )
    rejected.assertStatus(302)
    assert.equal(await statusOf(second.review), 'rejected')

    // A second decision on the same row is refused with a message.
    const late = await post(
      client,
      session,
      `/perubahan-wilayah/${second.review.publicId}/terima`,
      {
        apply_from: 'next_day',
      }
    )
    late.assertStatus(302)
    assert.equal(await statusOf(second.review), 'rejected')
    const after = await visit(client, 'admin', '/perubahan-wilayah', cookie).withInertia()
    const flash = (after.body() as { flash?: { error?: string } }).flash
    assert.equal(
      flash?.error,
      'Perubahan ini sudah diputuskan atau tidak ada lagi. Muat ulang halaman.'
    )

    const bad = await post(client, session, `/perubahan-wilayah/${first.review.publicId}/terima`, {
      apply_from: 'kapan-saja',
    })
    bad.assertStatus(302)
    const school = await School.findOrFail(first.school.id)
    assert.equal(school.district, 'Jati')
  })

  test('the NPSN lookup returns what the school form fills', async ({ client, assert }) => {
    await importSchoolDirectory(await writeDirectoryFile(smallKudusFile()))
    await createSchoolIn('SD Uji Satu', '90000001', '33.19.03')
    const session = await staffSession(client)
    const cookie = { name: sessionCookieNames.admin, sessionId: session.sessionId }

    const json = await visit(client, 'admin', '/direktori-sekolah/90000002', cookie)
    json.assertStatus(200)
    assert.containSubset(json.body(), {
      npsn: '90000002',
      name: 'MI Uji Dua',
      level: 'mi',
      province: 'Jawa Tengah',
      regency: { name: 'Kudus', kind: 'kabupaten', code: '33.19' },
      district: { name: 'Bae', kind: 'district', code: '33.19.07' },
      latitude: null,
      removed: false,
      school: null,
    })
    const known = await visit(client, 'admin', '/direktori-sekolah/90000001', cookie)
    assert.equal(known.body().school.name, 'SD Uji Satu')

    const missing = await visit(client, 'admin', '/direktori-sekolah/99999999', cookie)
    missing.assertStatus(404)
    assert.equal(missing.body().message, 'NPSN ini belum ada di direktori.')

    const page = await visit(
      client,
      'admin',
      '/direktori-sekolah?npsn=90000002',
      cookie
    ).withInertia()
    page.assertInertiaComponent('admin/school_directory')
    const props = page.inertiaProps as {
      result: { district: { name: string } }
      regencies: { regency: string; total: number; customers: number; mi: number }[]
    }
    assert.equal(props.result.district.name, 'Bae')
    assert.deepEqual(
      props.regencies.map(({ regency, total, customers, mi }) => ({
        regency,
        total,
        customers,
        mi,
      })),
      [{ regency: 'Kabupaten Kudus', total: 3, customers: 1, mi: 1 }]
    )

    const invalid = await visit(
      client,
      'admin',
      '/direktori-sekolah?npsn=123',
      cookie
    ).withInertia()
    assert.isTrue((invalid.inertiaProps as { invalid: boolean }).invalid)
  })
})
