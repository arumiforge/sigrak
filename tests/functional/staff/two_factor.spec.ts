import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import encryption from '@adonisjs/core/services/encryption'
import i18nManager from '@adonisjs/i18n/services/main'
import limiter from '@adonisjs/limiter/services/main'
import { sessionCookieNames } from '#config/session'
import type StaffUser from '#models/staff_user'
import StaffActivityLog from '#models/staff_activity_log'
import { resetTwoFactorFromServer, WRONG_CODE_LIMIT } from '#staff/two_factor'
import {
  PASSWORD,
  createStaff,
  currentCode,
  enrolTwoFactor,
  passwordStep,
  submitTwoFactorCode,
  visit,
} from '#tests/helpers'
import { inertiaPage, postForm, signIn, type Session } from '#tests/accounts'

/**
 * Staff 2FA (R2-02, D-343): enrolment with a QR code or key, the code
 * step after the password, the wrong-code throttle, forced enrolment
 * for Pemilik and Admin, turning it off where optional, and the
 * admin's logged "Atur ulang 2FA".
 */
type Client = Parameters<typeof visit>[0]

const t = (key: string, data?: Record<string, unknown>) =>
  i18nManager.locale('id').t(key, data as never)

function get(client: Client, session: Session, path: string) {
  return visit(client, 'admin', path, {
    name: sessionCookieNames.admin,
    sessionId: session.sessionId,
  })
}

async function statusOf(client: Client, session: Session, path: string) {
  const response = await get(client, session, path)
  return response.status()
}

/** A six-digit code the staff member's authenticator does not show now. */
function wrongCode(staff: StaffUser) {
  const valid = new Set([-1, 0, 1].map((steps) => currentCode(staff, steps)))
  for (let n = 0; ; n++) {
    const code = String(n).padStart(6, '0')
    if (!valid.has(code)) return code
  }
}

/** Password only: a session waiting at /masuk/kode. */
async function waitingSession(client: Client, staff: StaffUser): Promise<Session> {
  const { sessionId, response } = await passwordStep(client, 'admin', {
    email: staff.email,
    password: PASSWORD,
  })
  if (response.header('location') !== '/masuk/kode') {
    throw new Error(`Expected the code step, got ${response.header('location')}`)
  }
  return { area: 'admin', sessionId }
}

async function codeError(client: Client, session: Session, path = '/masuk/kode') {
  const page = await inertiaPage(client, session, path)
  return (page.inertiaProps.errors as Record<string, string> | undefined)?.code
}

async function lastLog(action: string) {
  return StaffActivityLog.query().where('action', action).orderBy('id', 'desc').first()
}

test.group('Staff | 2FA', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('optional staff enrol from Akun; the secret is stored encrypted', async ({
    client,
    assert,
  }) => {
    const staff = await createStaff(['support'])
    const session = await signIn(client, 'admin', staff.email)

    const account = await inertiaPage(client, session, '/akun')
    assert.equal(account.status(), 200)
    assert.deepInclude(account.inertiaProps.twoFactor as object, {
      enabled: false,
      required: false,
    })

    const setup = await inertiaPage(client, session, '/akun/verifikasi-dua-langkah')
    assert.equal(setup.status(), 200)
    const props = setup.inertiaProps as {
      manualKey: string
      qr: { size: number; path: string }
      required: boolean
    }
    assert.isFalse(props.required)
    assert.match(props.manualKey, /^[A-Z2-7]{4}( [A-Z2-7]{1,4})+$/)
    assert.isAbove(props.qr.size, 20)
    assert.match(props.qr.path, /^M\d+ \d+h1v1h-1z/)

    await staff.refresh()
    const plain = props.manualKey.replace(/ /g, '')
    assert.notInclude(staff.twoFactorSecret!, plain)
    assert.equal(encryption.decrypt<string>(staff.twoFactorSecret!), plain)
    assert.isNull(staff.twoFactorConfirmedAt)
    assert.notProperty(staff.serialize(), 'twoFactorSecret')

    // A reload shows the same key until it is confirmed.
    const again = await inertiaPage(client, session, '/akun/verifikasi-dua-langkah')
    assert.equal((again.inertiaProps as typeof props).manualKey, props.manualKey)

    const wrong = await postForm(client, session, '/akun/verifikasi-dua-langkah', {
      code: wrongCode(staff),
    })
    assert.equal(wrong.response.header('location'), '/akun/verifikasi-dua-langkah')
    assert.equal(
      await codeError(client, wrong.session, '/akun/verifikasi-dua-langkah'),
      t('two_factor.errors.wrong_code')
    )
    await staff.refresh()
    assert.isNull(staff.twoFactorConfirmedAt)

    const right = await postForm(client, session, '/akun/verifikasi-dua-langkah', {
      code: currentCode(staff).replace(/^(\d{3})/, '$1 '),
    })
    assert.equal(right.response.header('location'), '/akun')
    await staff.refresh()
    assert.isNotNull(staff.twoFactorConfirmedAt)
    const log = await lastLog('staff.two_factor_enable')
    assert.equal(log?.staffUserId, staff.id)
    assert.equal(log?.subjectId, String(staff.id))

    // Once on, the enrolment page sends back to Akun.
    const done = await get(client, session, '/akun/verifikasi-dua-langkah')
    assert.equal(done.header('location'), '/akun')
  })

  test('with 2FA on, the password leads to the code step and signs in only with a code', async ({
    client,
    assert,
  }) => {
    const staff = await enrolTwoFactor(await createStaff(['support']))
    const waiting = await waitingSession(client, staff)

    // Not signed in yet.
    const home = await get(client, waiting, '/hak-akses')
    assert.equal(home.header('location'), '/masuk')
    const challenge = await inertiaPage(client, waiting, '/masuk/kode')
    assert.equal(challenge.status(), 200)

    const wrong = await submitTwoFactorCode(client, waiting.sessionId, wrongCode(staff))
    assert.equal(wrong.response.header('location'), '/masuk/kode')
    const session: Session = { area: 'admin', sessionId: wrong.sessionId }
    assert.equal(await codeError(client, session), t('two_factor.errors.wrong_code'))

    const code = currentCode(staff)
    const right = await submitTwoFactorCode(client, session.sessionId, code)
    assert.equal(right.response.header('location'), '/')
    const signedIn: Session = { area: 'admin', sessionId: right.sessionId }
    assert.equal(await statusOf(client, signedIn, '/hak-akses'), 200)

    // The same code does not work a second time.
    const second = await waitingSession(client, staff)
    const replay = await submitTwoFactorCode(client, second.sessionId, code)
    assert.equal(replay.response.header('location'), '/masuk/kode')
  })

  test('the code step needs a fresh password step', async ({ client, assert }) => {
    const staff = await enrolTwoFactor(await createStaff(['support']))

    const page = await visit(client, 'admin', '/masuk/kode')
    assert.equal(page.header('location'), '/masuk')

    // Turned off or reset while waiting: back to the password.
    const waiting = await waitingSession(client, staff)
    await resetTwoFactorFromServer(staff)
    const after = await submitTwoFactorCode(client, waiting.sessionId, '123456')
    assert.equal(after.response.header('location'), '/masuk')
  })

  test('wrong codes are throttled per account, even with the right code after', async ({
    client,
    assert,
  }) => {
    const staff = await enrolTwoFactor(await createStaff(['support']))
    let session = await waitingSession(client, staff)
    for (let attempt = 0; attempt < WRONG_CODE_LIMIT; attempt++) {
      const wrong = await submitTwoFactorCode(client, session.sessionId, wrongCode(staff))
      session = { area: 'admin', sessionId: wrong.sessionId }
    }

    const blocked = await submitTwoFactorCode(client, session.sessionId, currentCode(staff))
    assert.equal(blocked.response.header('location'), '/masuk/kode')
    const message = await codeError(client, { area: 'admin', sessionId: blocked.sessionId })
    assert.equal(message, t('two_factor.errors.blocked', { minutes: 15 }))

    // A new sign-in from elsewhere is blocked too.
    const fresh = await waitingSession(client, staff)
    const still = await submitTwoFactorCode(client, fresh.sessionId, currentCode(staff))
    assert.equal(still.response.header('location'), '/masuk/kode')

    await limiter.clear(['memory'])
    const later = await submitTwoFactorCode(client, fresh.sessionId, currentCode(staff))
    assert.equal(later.response.header('location'), '/')
  })

  test('owner and admin without 2FA reach only the enrolment page and Keluar', async ({
    client,
    assert,
  }) => {
    const admin = await createStaff(['admin'])
    await resetTwoFactorFromServer(admin)
    const support = await createStaff(['support'])

    const login = await passwordStep(client, 'admin', { email: admin.email, password: PASSWORD })
    assert.equal(login.response.header('location'), '/')
    const session: Session = { area: 'admin', sessionId: login.sessionId }

    for (const path of ['/', '/sekolah', '/staf', '/akun', `/staf/${support.id}`]) {
      const response = await get(client, session, path)
      assert.equal(response.header('location'), '/akun/verifikasi-dua-langkah', path)
    }
    const blockedPost = await postForm(
      client,
      session,
      `/staf/${support.id}/nonaktifkan`,
      {},
      '/akun/verifikasi-dua-langkah'
    )
    assert.equal(blockedPost.response.header('location'), '/akun/verifikasi-dua-langkah')
    await support.refresh()
    assert.isNull(support.disabledAt)

    const setup = await inertiaPage(client, session, '/akun/verifikasi-dua-langkah')
    assert.equal(setup.status(), 200)
    assert.isTrue(setup.inertiaProps.required)

    await admin.refresh()
    const confirmed = await postForm(client, session, '/akun/verifikasi-dua-langkah', {
      code: currentCode(admin),
    })
    assert.equal(confirmed.response.header('location'), '/akun')
    assert.equal(await statusOf(client, confirmed.session, '/sekolah'), 200)

    // Staff with optional 2FA are never stopped.
    const supportSession = await signIn(client, 'admin', support.email)
    assert.equal(await statusOf(client, supportSession, '/hak-akses'), 200)

    // Keluar works before enrolling.
    const owner = await createStaff(['owner'])
    await resetTwoFactorFromServer(owner)
    const ownerLogin = await passwordStep(client, 'admin', {
      email: owner.email,
      password: PASSWORD,
    })
    const ownerSession: Session = { area: 'admin', sessionId: ownerLogin.sessionId }
    const out = await postForm(client, ownerSession, '/keluar', {}, '/akun/verifikasi-dua-langkah')
    assert.equal(out.response.header('location'), '/masuk')
  })

  test('optional staff turn 2FA off with a code; owner and admin cannot', async ({
    client,
    assert,
  }) => {
    const staff = await enrolTwoFactor(await createStaff(['content']))
    const session = await signIn(client, 'admin', staff.email)
    await staff.refresh()

    const wrong = await postForm(
      client,
      session,
      '/akun/verifikasi-dua-langkah/matikan',
      { code: wrongCode(staff) },
      '/akun'
    )
    assert.equal(wrong.response.header('location'), '/akun')
    await staff.refresh()
    assert.isNotNull(staff.twoFactorConfirmedAt)

    await postForm(
      client,
      session,
      '/akun/verifikasi-dua-langkah/matikan',
      { code: currentCode(staff, 1) },
      '/akun'
    )
    await staff.refresh()
    assert.isNull(staff.twoFactorSecret)
    assert.isNull(staff.twoFactorConfirmedAt)
    const disabledLog = await lastLog('staff.two_factor_disable')
    assert.equal(disabledLog?.staffUserId, staff.id)

    const admin = await createStaff(['admin'])
    const adminSession = await signIn(client, 'admin', admin.email)
    await admin.refresh()
    await postForm(
      client,
      adminSession,
      '/akun/verifikasi-dua-langkah/matikan',
      { code: currentCode(admin, 1) },
      '/akun'
    )
    await admin.refresh()
    assert.isNotNull(admin.twoFactorConfirmedAt)
  })

  test('an admin resets another staff member’s 2FA; it is logged and they enrol again', async ({
    client,
    assert,
  }) => {
    const admin = await createStaff(['admin'])
    const member = await enrolTwoFactor(await createStaff(['support']))
    const session = await signIn(client, 'admin', admin.email)

    const page = await inertiaPage(client, session, `/staf/${member.id}`)
    assert.deepEqual(page.inertiaProps.twoFactor, {
      enabled: true,
      required: false,
      canReset: true,
    })

    const reset = await postForm(client, session, `/staf/${member.id}/atur-ulang-2fa`, {}, '/staf')
    assert.equal(reset.response.header('location'), `/staf/${member.id}`)
    await member.refresh()
    assert.isNull(member.twoFactorSecret)
    assert.isNull(member.twoFactorConfirmedAt)
    const log = await lastLog('staff.two_factor_reset')
    assert.equal(log?.staffUserId, admin.id)
    assert.equal(log?.subjectType, 'staff')
    assert.equal(log?.subjectId, String(member.id))
    assert.deepEqual(log?.changes, { was_enabled: true })

    // Without 2FA the member signs in with the password and may enrol again.
    const login = await passwordStep(client, 'admin', { email: member.email, password: PASSWORD })
    assert.equal(login.response.header('location'), '/')

    // A reset admin must enrol again at the next sign-in.
    const owner = await createStaff(['owner'])
    const ownerSession = await signIn(client, 'admin', owner.email)
    await postForm(client, ownerSession, `/staf/${admin.id}/atur-ulang-2fa`, {}, '/staf')
    await admin.refresh()
    assert.isNull(admin.twoFactorConfirmedAt)
    const adminLogin = await passwordStep(client, 'admin', {
      email: admin.email,
      password: PASSWORD,
    })
    const adminSession: Session = { area: 'admin', sessionId: adminLogin.sessionId }
    const forced = await get(client, adminSession, '/staf')
    assert.equal(forced.header('location'), '/akun/verifikasi-dua-langkah')
  })

  test('the reset guards: not oneself, owner and admin only by an owner, ability needed', async ({
    client,
    assert,
  }) => {
    const admin = await createStaff(['admin'])
    const otherAdmin = await createStaff(['admin'])
    const owner = await createStaff(['owner'])
    const support = await enrolTwoFactor(await createStaff(['support']))
    const session = await signIn(client, 'admin', admin.email)

    const self = await postForm(client, session, `/staf/${admin.id}/atur-ulang-2fa`, {}, '/staf')
    assert.equal(self.response.header('location'), `/staf/${admin.id}`)
    const selfPage = await inertiaPage(client, self.session, `/staf/${admin.id}`)
    assert.equal(selfPage.body().flash?.error, t('two_factor.errors.self'))
    assert.isFalse((selfPage.inertiaProps.twoFactor as { canReset: boolean }).canReset)

    for (const target of [otherAdmin, owner]) {
      const page = await inertiaPage(client, session, `/staf/${target.id}`)
      assert.isFalse((page.inertiaProps.twoFactor as { canReset: boolean }).canReset)
      const refused = await postForm(
        client,
        session,
        `/staf/${target.id}/atur-ulang-2fa`,
        {},
        '/staf'
      )
      const after = await inertiaPage(client, refused.session, `/staf/${target.id}`)
      assert.equal(after.body().flash?.error, t('two_factor.errors.high_role'))
      await target.refresh()
      assert.isNotNull(target.twoFactorConfirmedAt)
    }

    const supportSession = await signIn(client, 'admin', support.email)
    const forbidden = await postForm(
      client,
      supportSession,
      `/staf/${otherAdmin.id}/atur-ulang-2fa`,
      {},
      '/akun'
    )
    assert.equal(forbidden.response.status(), 403)

    assert.isNull(await lastLog('staff.two_factor_reset'))
  })

  test('a reset from the server is logged without a staff member', async ({ assert }) => {
    const owner = await createStaff(['owner'])
    await resetTwoFactorFromServer(owner)
    await owner.refresh()
    assert.isNull(owner.twoFactorSecret)
    const log = await lastLog('staff.two_factor_reset')
    assert.isNull(log?.staffUserId)
    assert.deepEqual(log?.changes, { was_enabled: true, from: 'server' })
  })
})
