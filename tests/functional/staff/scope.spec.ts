import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import Region from '#models/region'
import School from '#models/school'
import { seedRegionList } from '#regions/region_list'
import { withinScope, withinScopeForUser } from '#staff/access'
import { TRIAL_EXTEND_MAX_DAYS } from '#accounts/console'
import { createSchool, createStaff, createTeacher, setStaffRoles } from '#tests/helpers'
import { inertiaPage, postForm, signIn, type Session } from '#tests/accounts'
import { visit } from '#tests/helpers'
import { sessionCookieNames } from '#config/session'

/**
 * Area scopes in the console (D-338): the school and user lists, the
 * school page and its actions only reach schools inside the staff
 * member's area; anything else is a 403 (no IDOR across scopes).
 *
 * Fixture: Jawa Tengah › Kabupaten Uji (33.99) › Kecamatan Uji
 * (33.99.01) holds "SD Dalam"; Kabupaten Lain (33.98) in the same
 * province holds "SD Tetangga"; DI Yogyakarta › Kabupaten Jauh (34.99)
 * holds "MI Jauh".
 */
async function fixture() {
  const inside = await createSchool('SD Dalam')
  await seedRegionList(db.connection(), {
    kemendagriCode: '33',
    name: 'Jawa Tengah',
    children: [
      {
        kemendagriCode: '33.98',
        name: 'Lain',
        regencyKind: 'kabupaten',
        children: [{ kemendagriCode: '33.98.01', name: 'Lain' }],
      },
    ],
  })
  await seedRegionList(db.connection(), {
    kemendagriCode: '34',
    name: 'DI Yogyakarta',
    children: [
      {
        kemendagriCode: '34.99',
        name: 'Jauh',
        regencyKind: 'kabupaten',
        children: [{ kemendagriCode: '34.99.01', name: 'Jauh' }],
      },
    ],
  })
  const region = async (code: string) => Region.findByOrFail('kemendagriCode', code)
  const schoolIn = async (name: string, code: string, level: 'sd' | 'mi') => {
    const regency = await region(code)
    const district = await region(`${code}.01`)
    return School.create({
      name,
      level,
      regionId: regency.id,
      districtId: district.id,
      district: district.name,
      address: 'Jalan Uji',
    })
  }
  const neighbour = await schoolIn('SD Tetangga', '33.98', 'sd')
  const far = await schoolIn('MI Jauh', '34.99', 'mi')
  return {
    inside,
    neighbour,
    far,
    province: await region('33'),
    regency: await region('33.99'),
    district: await region('33.99.01'),
    farRegency: await region('34.99'),
  }
}

function get(client: Parameters<typeof visit>[0], session: Session, path: string) {
  return visit(client, 'admin', path, {
    name: sessionCookieNames.admin,
    sessionId: session.sessionId,
  })
}

async function statusOf(client: Parameters<typeof visit>[0], session: Session, path: string) {
  const response = await get(client, session, path)
  return response.status()
}

async function propsOf(client: Parameters<typeof visit>[0], session: Session, path: string) {
  const page = await inertiaPage(client, session, path)
  return page.inertiaProps
}

test.group('Staff | area scopes (D-338)', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('a region matches by kabupaten, kecamatan or province; a school list by id', async ({
    assert,
  }) => {
    const { inside, neighbour, far, province, regency, district, farRegency } = await fixture()
    const sales = await createStaff(['sales'])
    const reach = async () => ({
      inside: await withinScope(sales, 'schools.view', inside.id),
      neighbour: await withinScope(sales, 'schools.view', neighbour.id),
      far: await withinScope(sales, 'schools.view', far.id),
    })

    // A new Penjualan account without an area reaches no school.
    assert.deepEqual(await reach(), { inside: false, neighbour: false, far: false })

    await setStaffRoles(sales, ['sales'], { regionIds: [regency.id] })
    assert.deepEqual(await reach(), { inside: true, neighbour: false, far: false })

    await setStaffRoles(sales, ['sales'], { regionIds: [district.id] })
    assert.deepEqual(await reach(), { inside: true, neighbour: false, far: false })

    await setStaffRoles(sales, ['sales'], { regionIds: [province.id] })
    assert.deepEqual(await reach(), { inside: true, neighbour: true, far: false })

    await setStaffRoles(sales, ['sales'], { regionIds: [regency.id], schoolIds: [far.id] })
    assert.deepEqual(await reach(), { inside: true, neighbour: false, far: true })

    // Support has an optional area: empty is everywhere, set limits it.
    const support = await createStaff(['support'])
    assert.isTrue(await withinScope(support, 'schools.view', far.id))
    await setStaffRoles(support, ['support'], { regionIds: [farRegency.id] })
    assert.isFalse(await withinScope(support, 'schools.view', inside.id))
    assert.isTrue(await withinScope(support, 'schools.view', far.id))

    // A school list is only for roles that use one (support does not).
    await setStaffRoles(support, ['support'], {
      regionIds: [farRegency.id],
      schoolIds: [inside.id],
    })
    assert.isFalse(await withinScope(support, 'schools.view', inside.id))
  })

  test('the school list and the user search show only the own area', async ({ client, assert }) => {
    const { inside, neighbour, far, regency } = await fixture()
    const teacherInside = await createTeacher(inside)
    await createTeacher(far)
    const sales = await createStaff(['sales'], { regionIds: [regency.id] })
    const session = await signIn(client, 'admin', sales.email)

    const schools = await inertiaPage(client, session, '/sekolah')
    assert.deepEqual(
      schools.inertiaProps.schools.map((school: { name: string }) => school.name),
      ['SD Dalam']
    )

    const users = await inertiaPage(client, session, '/pengguna?q=Guru')
    assert.deepEqual(
      users.inertiaProps.users.map((user: { email: string }) => user.email),
      [teacherInside.email]
    )

    const owner = await createStaff(['owner'])
    const ownerSession = await signIn(client, 'admin', owner.email)
    const all = await inertiaPage(client, ownerSession, '/sekolah')
    assert.sameMembers(
      all.inertiaProps.schools.map((school: { id: number }) => school.id),
      [inside.id, neighbour.id, far.id]
    )
    assert.isTrue(await withinScopeForUser(sales, 'users.view', teacherInside.id))
  })

  test('a school outside the area is a 403 for its page and every action', async ({
    client,
    assert,
  }) => {
    const { inside, far, regency } = await fixture()
    const admin = await createStaff(['admin'], { regionIds: [regency.id] })
    const session = await signIn(client, 'admin', admin.email)

    assert.equal(await statusOf(client, session, `/sekolah/${inside.id}`), 200)
    assert.equal(await statusOf(client, session, `/sekolah/${far.id}`), 403)

    const csrfPage = `/sekolah/${inside.id}`
    const invite = await postForm(
      client,
      session,
      `/sekolah/${far.id}/undangan`,
      { email: 'operator@jauh.test', role: 'operator' },
      csrfPage
    )
    assert.equal(invite.response.status(), 403)
    const trial = await postForm(
      client,
      session,
      `/sekolah/${far.id}/uji-coba`,
      { mode: 'set', days: 30 },
      csrfPage
    )
    assert.equal(trial.response.status(), 403)
    await far.refresh()
    assert.isNull(far.trialDays)
    const invitations = await db.from('invitations').where('school_id', far.id)
    assert.lengthOf(invitations, 0)
  })

  test('Penjualan adds trial days within the limit, only in the own area', async ({
    client,
    assert,
  }) => {
    const { inside, far, regency } = await fixture()
    const teacherFar = await createTeacher(far)
    const sales = await createStaff(['sales'], { regionIds: [regency.id] })
    const session = await signIn(client, 'admin', sales.email)
    const page = `/sekolah/${inside.id}`

    const props = await propsOf(client, session, page)
    assert.deepEqual(props.can, {
      manageInvitations: false,
      manageTrials: false,
      extendTrials: true,
      openSchool: false,
    })

    const ok = await postForm(
      client,
      session,
      `${page}/uji-coba`,
      { mode: 'extend', days: TRIAL_EXTEND_MAX_DAYS },
      page
    )
    assert.equal(ok.response.status(), 302)
    await inside.refresh()
    assert.isNotNull(inside.trialExtendedUntil)

    const tooMany = await postForm(
      client,
      session,
      `${page}/uji-coba`,
      { mode: 'extend', days: TRIAL_EXTEND_MAX_DAYS + 1 },
      page
    )
    assert.equal(tooMany.response.status(), 403)
    const setLength = await postForm(
      client,
      session,
      `${page}/uji-coba`,
      { mode: 'set', days: 30 },
      page
    )
    assert.equal(setLength.response.status(), 403)

    const outside = await postForm(
      client,
      session,
      `/sekolah/${far.id}/uji-coba`,
      { mode: 'extend', days: 3 },
      page
    )
    assert.equal(outside.response.status(), 403)
    const outsideUser = await postForm(
      client,
      session,
      `/pengguna/${teacherFar.id}/uji-coba`,
      { mode: 'extend', days: 3 },
      page
    )
    assert.equal(outsideUser.response.status(), 403)

    const logs = await db.from('staff_activity_logs').where('staff_user_id', sales.id)
    assert.deepEqual(
      logs.map((row: { action: string }) => row.action),
      ['trial.extend']
    )
  })

  test('roles without school powers cannot open the school pages', async ({ client, assert }) => {
    const { inside } = await fixture()
    for (const role of ['marketing', 'content', 'engineer', 'researcher'] as const) {
      const staff = await createStaff([role], {})
      const session = await signIn(client, 'admin', staff.email)
      assert.equal(await statusOf(client, session, '/sekolah'), 403, role)
      assert.equal(await statusOf(client, session, `/sekolah/${inside.id}`), 403, role)
      assert.equal(await statusOf(client, session, '/pengguna'), 403, role)
    }
  })
})
