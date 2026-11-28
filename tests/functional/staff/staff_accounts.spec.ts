import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { sessionCookieNames } from '#config/session'
import StaffUser from '#models/staff_user'
import StaffActivityLog from '#models/staff_activity_log'
import StaffPasswordToken from '#models/staff_password_token'
import StaffInvitationMail from '#mails/staff_invitation_mail'
import { hashToken } from '#accounts/tokens'
import {
  createFirstOwner,
  revokeRole,
  setDisabled,
  StaffChangeRefusedException,
} from '#staff/staff_accounts'
import { rolesOf } from '#staff/access'
import {
  PASSWORD,
  createSchool,
  createStaff,
  login,
  setStaffRoles,
  testRegions,
  visit,
} from '#tests/helpers'
import { fakeMail, inertiaPage, postForm, signIn, tokenOf, type Session } from '#tests/accounts'

/**
 * Staf, Log aktivitas and Peran (R2-01): creating staff with a
 * set-password link, roles and scopes per assignment, disabling, and
 * the guards (no self-change, owner and admin only by an owner, never
 * without an active owner). Every change is logged.
 */
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

async function rolesFromDb(staff: StaffUser) {
  await staff.load('roleAssignments')
  return rolesOf(staff).sort()
}

/** The logged actions where a column has a value, oldest first. */
async function actionsWhere(column: string, value: string | number) {
  const logs = await StaffActivityLog.query().where(column, value).orderBy('id', 'asc')
  return logs.map((log) => log.action)
}

async function lastLog(action: string) {
  return StaffActivityLog.query().where('action', action).orderBy('id', 'desc').firstOrFail()
}

test.group('Staff | accounts, roles and guards', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => fakeMail().restore)

  test('an admin creates staff; the new member sets a password from the link', async ({
    client,
    assert,
  }) => {
    const { fake } = fakeMail()
    const { regency } = await testRegions()
    const admin = await createStaff(['admin'])
    const session = await signIn(client, 'admin', admin.email)

    const { response } = await postForm(
      client,
      session,
      '/staf',
      {
        'name': 'Sari Penjualan',
        'email': 'Sari@Uji.test',
        'role': 'sales',
        'region_ids[0]': regency.id,
      },
      '/staf'
    )
    const created = await StaffUser.findByOrFail('email', 'sari@uji.test')
    assert.equal(response.header('location'), `/staf/${created.id}`)
    await created.load('roleAssignments')
    assert.equal(created.roleAssignments[0].role, 'sales')
    assert.deepEqual(created.roleAssignments[0].regionIds, [regency.id])

    const mails = fake.mails.queued((mail) => mail instanceof StaffInvitationMail)
    assert.lengthOf(mails, 1)
    const token = tokenOf(mails[0])
    const row = await StaffPasswordToken.findByOrFail('staffUserId', created.id)
    assert.equal(row.tokenHash, hashToken(token))

    // The random starting password is unknown, so sign-in fails until the link is used.
    const before = await login(client, 'admin', { email: 'sari@uji.test', password: PASSWORD })
    assert.equal(before.response.header('location'), '/masuk')

    const page = await visit(client, 'admin', `/kata-sandi-baru/${token}`).withInertia()
    assert.isTrue(page.inertiaProps.valid)
    assert.isTrue(page.inertiaProps.staff)
    const guest: Session = { area: 'admin', sessionId: await anySession(client) }
    const short = await postForm(
      client,
      guest,
      `/kata-sandi-baru/${token}`,
      { password: 'pendek12', password_confirmation: 'pendek12' },
      `/kata-sandi-baru/${token}`
    )
    assert.notEqual(short.response.header('location'), '/masuk')
    const newPassword = 'kata-sandi-staf-2026'
    const set = await postForm(
      client,
      short.session,
      `/kata-sandi-baru/${token}`,
      { password: newPassword, password_confirmation: newPassword },
      `/kata-sandi-baru/${token}`
    )
    assert.equal(set.response.header('location'), '/masuk')
    assert.isNull(await StaffPasswordToken.findBy('staffUserId', created.id))
    const after = await login(client, 'admin', { email: 'sari@uji.test', password: newPassword })
    assert.equal(after.response.header('location'), '/')

    const logs = await StaffActivityLog.query().where('subject_id', String(created.id))
    assert.sameMembers(
      logs.map((log) => log.action),
      ['staff.create', 'staff.role_grant']
    )
    assert.isTrue(logs.every((log) => log.staffUserId === admin.id))
  })

  test('roles and scopes per assignment are added, changed and removed, all logged', async ({
    client,
    assert,
  }) => {
    const { regency, district } = await testRegions()
    const school = await createSchool('SD Daftar')
    const admin = await createStaff(['admin'])
    const member = await createStaff(['content'])
    const session = await signIn(client, 'admin', admin.email)
    const page = `/staf/${member.id}`

    await postForm(
      client,
      session,
      `${page}/peran`,
      { 'role': 'sales', 'region_ids[0]': regency.id, 'school_ids[0]': school.id },
      page
    )
    await postForm(
      client,
      session,
      `${page}/peran/content`,
      { 'levels[0]': 'mi', 'fields[0]': 'islamic', 'region_ids[0]': regency.id },
      page
    )
    await member.load('roleAssignments')
    const content = member.roleAssignments.find((a) => a.role === 'content')!
    const sales = member.roleAssignments.find((a) => a.role === 'sales')!
    assert.deepEqual(content.levels, ['mi'])
    assert.deepEqual(content.fields, ['islamic'])
    // Penyusun Konten has no area: the region is dropped.
    assert.deepEqual(content.regionIds, [])
    assert.deepEqual(sales.schoolIds, [school.id])

    const scopeLog = await lastLog('staff.scope_change')
    assert.equal(scopeLog.changes.role, 'content')
    assert.deepEqual((scopeLog.changes.from as { levels: string[] }).levels, [])
    assert.deepEqual((scopeLog.changes.to as { levels: string[] }).levels, ['mi'])

    await postForm(client, session, `${page}/peran/sales`, { 'region_ids[0]': district.id }, page)
    await sales.refresh()
    assert.deepEqual(sales.regionIds, [district.id])
    assert.deepEqual(sales.schoolIds, [])

    await postForm(client, session, `${page}/peran/content/cabut`, {}, page)
    assert.deepEqual(await rolesFromDb(member), ['sales'])
    const revoked = await lastLog('staff.role_revoke')
    assert.equal(revoked.changes.role, 'content')

    const props = await propsOf(client, session, page)
    assert.deepEqual(
      props.assignments.map((a: { role: string }) => a.role),
      ['sales']
    )
    assert.equal(props.assignments[0].regions[0].name, 'Uji')
    assert.isTrue(props.can.edit)
  })

  test('nobody changes their own roles or account', async ({ client, assert }) => {
    const owner = await createStaff(['owner'])
    await createStaff(['owner'])
    const session = await signIn(client, 'admin', owner.email)
    const page = `/staf/${owner.id}`

    const grant = await postForm(client, session, `${page}/peran`, { role: 'support' }, page)
    assert.equal(grant.response.header('location'), page)
    await postForm(client, session, `${page}/peran/owner/cabut`, {}, page)
    await postForm(client, session, `${page}/nonaktifkan`, {}, page)

    assert.deepEqual(await rolesFromDb(owner), ['owner'])
    await owner.refresh()
    assert.isNull(owner.disabledAt)
    const flash = await propsOf(client, session, page)
    assert.isFalse(flash.can.edit)
    assert.isTrue(flash.can.self)
    assert.deepEqual(await actionsWhere('staff_user_id', owner.id), [])
  })

  test('only an owner grants, removes or touches owner and admin', async ({ client, assert }) => {
    const owner = await createStaff(['owner'])
    const admin = await createStaff(['admin'])
    const otherAdmin = await createStaff(['admin'])
    const member = await createStaff(['support'])
    const asAdmin = await signIn(client, 'admin', admin.email)

    const page = `/staf/${member.id}`
    for (const role of ['owner', 'admin']) {
      await postForm(client, asAdmin, `${page}/peran`, { role }, page)
    }
    assert.deepEqual(await rolesFromDb(member), ['support'])

    // An admin may not change another admin or an owner either.
    await postForm(client, asAdmin, `/staf/${otherAdmin.id}/peran`, { role: 'support' }, page)
    await postForm(client, asAdmin, `/staf/${otherAdmin.id}/nonaktifkan`, {}, page)
    await postForm(client, asAdmin, `/staf/${owner.id}/peran/owner/cabut`, {}, page)
    assert.deepEqual(await rolesFromDb(otherAdmin), ['admin'])
    await otherAdmin.refresh()
    assert.isNull(otherAdmin.disabledAt)
    assert.deepEqual(await rolesFromDb(owner), ['owner'])

    const created = await postForm(
      client,
      asAdmin,
      '/staf',
      { name: 'Calon Admin', email: 'calon@uji.test', role: 'admin' },
      '/staf'
    )
    assert.equal(created.response.header('location'), '/staf')
    assert.isNull(await StaffUser.findBy('email', 'calon@uji.test'))

    // The admin page offers only the roles an admin may give.
    const list = await propsOf(client, asAdmin, '/staf')
    assert.notInclude(list.grantable, 'owner')
    assert.notInclude(list.grantable, 'admin')

    // An owner may.
    const asOwner = await signIn(client, 'admin', owner.email)
    await postForm(client, asOwner, `${page}/peran`, { role: 'admin' }, page)
    assert.deepEqual(await rolesFromDb(member), ['admin', 'support'])
  })

  test('the last active owner keeps the role and the account', async ({ assert }) => {
    const first = await createStaff(['owner'])
    const second = await createStaff(['owner'])

    // With two owners, one may remove the other's role.
    await revokeRole(first, second.id, 'owner')
    assert.deepEqual(await rolesFromDb(second), [])
    await setStaffRoles(second, ['owner'])

    // `first` is disabled from another session meanwhile; its loaded copy
    // still says owner, but `second` is now the last active owner.
    await db.from('staff_users').where('id', first.id).update({ disabled_at: new Date() })
    await assert.rejects(() => revokeRole(first, second.id, 'owner'), /last_owner/)
    await assert.rejects(() => setDisabled(first, second.id, true), /last_owner/)
    assert.deepEqual(await rolesFromDb(second), ['owner'])
    await second.refresh()
    assert.isNull(second.disabledAt)
    assert.instanceOf(
      await revokeRole(first, second.id, 'owner').catch((error) => error),
      StaffChangeRefusedException
    )
  })

  test('a disabled account cannot sign in and an open session ends', async ({ client, assert }) => {
    const admin = await createStaff(['admin'])
    const member = await createStaff(['support'])
    const memberSession = await signIn(client, 'admin', member.email)
    assert.equal(await statusOf(client, memberSession, '/peran'), 200)

    const asAdmin = await signIn(client, 'admin', admin.email)
    await postForm(client, asAdmin, `/staf/${member.id}/nonaktifkan`, {}, '/staf')
    await member.refresh()
    assert.isNotNull(member.disabledAt)

    const kicked = await get(client, memberSession, '/peran')
    assert.equal(kicked.status(), 302)
    assert.equal(kicked.header('location'), '/masuk')
    const again = await login(client, 'admin', { email: member.email, password: PASSWORD })
    assert.equal(again.response.header('location'), '/masuk')

    await postForm(client, asAdmin, `/staf/${member.id}/aktifkan`, {}, '/staf')
    const back = await login(client, 'admin', { email: member.email, password: PASSWORD })
    assert.equal(back.response.header('location'), '/')
    assert.sameMembers(await actionsWhere('subject_id', String(member.id)), [
      'staff.disable',
      'staff.enable',
    ])
  })

  test('an admin sends a new set-password link; the old one stops working', async ({
    client,
    assert,
  }) => {
    const { fake } = fakeMail()
    const admin = await createStaff(['admin'])
    const member = await createStaff(['support'])
    const session = await signIn(client, 'admin', admin.email)
    await postForm(client, session, `/staf/${member.id}/kirim-tautan`, {}, '/staf')
    await postForm(client, session, `/staf/${member.id}/kirim-tautan`, {}, '/staf')
    const mails = fake.mails.queued((mail) => mail instanceof StaffInvitationMail)
    assert.lengthOf(mails, 2)
    const first = await visit(
      client,
      'admin',
      `/kata-sandi-baru/${tokenOf(mails[0])}`
    ).withInertia()
    assert.isFalse(first.inertiaProps.valid)
    const second = await visit(
      client,
      'admin',
      `/kata-sandi-baru/${tokenOf(mails[1])}`
    ).withInertia()
    assert.isTrue(second.inertiaProps.valid)
    assert.lengthOf(await actionsWhere('action', 'staff.link_resend'), 2)
  })

  test('only staff.view and staff.manage holders open and change Staf', async ({
    client,
    assert,
  }) => {
    const member = await createStaff(['admin'])
    for (const role of ['support', 'sales', 'engineer', 'finance', 'researcher'] as const) {
      const staff = await createStaff([role])
      const session = await signIn(client, 'admin', staff.email)
      assert.equal(await statusOf(client, session, '/staf'), 403, role)
      assert.equal(await statusOf(client, session, `/staf/${member.id}`), 403, role)
      const changed = await postForm(
        client,
        session,
        `/staf/${member.id}/nonaktifkan`,
        {},
        '/peran'
      )
      assert.equal(changed.response.status(), 403, role)
    }
    await member.refresh()
    assert.isNull(member.disabledAt)
  })

  test('the first owner comes from the command helper, once', async ({ assert }) => {
    const owner = await createFirstOwner({
      name: 'Pemilik Uji',
      email: 'pemilik@uji.test',
      password: 'kata-sandi-pemilik-1',
    })
    assert.deepEqual(await rolesFromDb(owner), ['owner'])
    const log = await lastLog('staff.owner_bootstrap')
    assert.isNull(log.staffUserId)
    await assert.rejects(
      () =>
        createFirstOwner({
          name: 'Pemilik Dua',
          email: 'dua@uji.test',
          password: 'kata-sandi-pemilik-2',
        }),
      /role_held/
    )
    // An existing staff account may become the first owner when no owner is active.
    await db.from('staff_role_assignments').where('role', 'owner').delete()
    const support = await createStaff(['support'])
    const promoted = await createFirstOwner({
      name: 'X',
      email: support.email,
      password: 'kata-sandi-baru-123',
    })
    assert.equal(promoted.id, support.id)
    assert.deepEqual(await rolesFromDb(support), ['owner', 'support'])
  })
})

test.group('Staff | Log aktivitas and Peran', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('the log lists changes newest first and filters by staff, action and day', async ({
    client,
    assert,
  }) => {
    const owner = await createStaff(['owner'])
    const engineer = await createStaff(['engineer'])
    const member = await createStaff(['content'])
    const session = await signIn(client, 'admin', owner.email)
    await postForm(client, session, `/staf/${member.id}/peran`, { role: 'support' }, '/staf')
    await postForm(client, session, `/staf/${member.id}/nonaktifkan`, {}, '/staf')
    await db.table('staff_activity_logs').insert({
      staff_user_id: engineer.id,
      action: 'setting.updated',
      subject_type: 'setting',
      subject_id: 'trial.default_days',
      changes: JSON.stringify({ from: 7, to: 14 }),
      created_at: new Date('2026-01-15T03:00:00Z'),
    })

    const all = await propsOf(client, session, '/log-aktivitas')
    assert.equal(all.total, 3)
    assert.deepEqual(
      all.entries.map((entry: { action: string }) => entry.action),
      ['staff.disable', 'staff.role_grant', 'setting.updated']
    )
    assert.equal(all.entries[0].subjectName, member.name)
    assert.equal(all.entries[1].role, 'support')

    const byStaff = await propsOf(client, session, `/log-aktivitas?staf=${engineer.id}`)
    assert.deepEqual(
      byStaff.entries.map((entry: { action: string }) => entry.action),
      ['setting.updated']
    )
    const byAction = await propsOf(client, session, '/log-aktivitas?aksi=staff.disable')
    assert.equal(byAction.total, 1)
    const byDay = await propsOf(client, session, '/log-aktivitas?dari=2026-01-15&sampai=2026-01-15')
    assert.deepEqual(
      byDay.entries.map((entry: { action: string }) => entry.action),
      ['setting.updated']
    )

    // Teknis reads the log too; Support does not.
    const asEngineer = await signIn(client, 'admin', engineer.email)
    assert.equal(await statusOf(client, asEngineer, '/log-aktivitas'), 200)
    const support = await createStaff(['support'])
    const asSupport = await signIn(client, 'admin', support.email)
    assert.equal(await statusOf(client, asSupport, '/log-aktivitas'), 403)
  })

  test('Peran shows the matrix from code to every staff member', async ({ client, assert }) => {
    const sales = await createStaff(['sales', 'marketing'])
    const session = await signIn(client, 'admin', sales.email)
    const props = await propsOf(client, session, '/peran')
    assert.lengthOf(props.roles, 12)
    assert.deepEqual(props.ownRoles.sort(), ['marketing', 'sales'])
    const team = props.groups.find((row: { group: string }) => row.group === 'team')
    const manageHigh = team.abilities.find(
      (row: { ability: string }) => row.ability === 'staff.manage_high'
    )
    assert.deepEqual(manageHigh.roles, ['owner'])

    // The menu follows the abilities.
    const home = await propsOf(client, session, '/')
    assert.include(home.staffAbilities, 'access.view')
    assert.notInclude(home.staffAbilities, 'staff.view')
  })
})

/** A fresh guest session on admin. */
async function anySession(client: Parameters<typeof visit>[0]) {
  const page = await visit(client, 'admin', '/masuk')
  return page.cookie(sessionCookieNames.admin)!.value as string
}
