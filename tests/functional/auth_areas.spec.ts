import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import { sessionCookieNames } from '#config/session'
import type { Area } from '#config/hosts'
import {
  PASSWORD,
  createParticipant,
  createSchool,
  createStaff,
  createTeacher,
  login,
  visit,
} from '#tests/helpers'

const homes: Record<Area, string> = { app: '/kalender', admin: '/', exam: '/' }

test.group('Areas: each login reaches only its own host', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('a guest is sent to /masuk on every host', async ({ client, assert }) => {
    for (const area of ['app', 'admin', 'exam'] as const) {
      const response = await visit(client, area, homes[area])
      response.assertStatus(302)
      assert.equal(response.header('location'), '/masuk')
    }
  })

  test('the login pages render on every host', async ({ client }) => {
    for (const area of ['app', 'admin', 'exam'] as const) {
      const response = await visit(client, area, '/masuk')
      response.assertStatus(200)
      response.assertTextIncludes('auth\\/login')
    }
  })

  test('a school user signs in on app. and reaches Kalender', async ({ client, assert }) => {
    const school = await createSchool('SD Uji')
    const teacher = await createTeacher(school)

    const { sessionId, response } = await login(client, 'app', {
      email: teacher.email,
      password: PASSWORD,
    })
    assert.equal(response.header('location'), '/kalender')

    const page = await visit(client, 'app', '/kalender', {
      name: sessionCookieNames.app,
      sessionId: sessionId!,
    }).withInertia()
    page.assertStatus(200)
    page.assertInertiaComponent('school/calendar')
  })

  test('a staff session is rejected on app., and a school session on admin.', async ({
    client,
    assert,
  }) => {
    const school = await createSchool('SD Uji')
    const teacher = await createTeacher(school)
    const staff = await createStaff()

    const staffLogin = await login(client, 'admin', { email: staff.email, password: PASSWORD })
    assert.equal(staffLogin.response.header('location'), '/')
    const schoolLogin = await login(client, 'app', { email: teacher.email, password: PASSWORD })

    // Each session works on its own host.
    const adminHome = await visit(client, 'admin', '/', {
      name: sessionCookieNames.admin,
      sessionId: staffLogin.sessionId!,
    })
    adminHome.assertStatus(200)

    // The staff session id, even presented under app.'s cookie name, is
    // not a school session.
    for (const name of [sessionCookieNames.admin, sessionCookieNames.app]) {
      const onApp = await visit(client, 'app', '/kalender', {
        name,
        sessionId: staffLogin.sessionId!,
      })
      onApp.assertStatus(302)
      assert.equal(onApp.header('location'), '/masuk')
    }

    // And the school session is not a staff session.
    for (const name of [sessionCookieNames.app, sessionCookieNames.admin]) {
      const onAdmin = await visit(client, 'admin', '/', { name, sessionId: schoolLogin.sessionId! })
      onAdmin.assertStatus(302)
      assert.equal(onAdmin.header('location'), '/masuk')
    }
  })

  test('an exam session is rejected on app. and admin.', async ({ client, assert }) => {
    const school = await createSchool('SD Uji')
    const participant = await createParticipant(school)

    const { sessionId, response } = await login(client, 'exam', {
      username: participant.username,
      password: PASSWORD,
    })
    assert.equal(response.header('location'), '/')

    const examHome = await visit(client, 'exam', '/', {
      name: sessionCookieNames.exam,
      sessionId: sessionId!,
    }).withInertia()
    examHome.assertStatus(200)
    examHome.assertInertiaComponent('exam/home')

    for (const area of ['app', 'admin'] as const) {
      const elsewhere = await visit(client, area, homes[area], {
        name: sessionCookieNames[area],
        sessionId: sessionId!,
      })
      elsewhere.assertStatus(302)
      assert.equal(elsewhere.header('location'), '/masuk')
    }
  })

  test('credentials of one area do not open another', async ({ client, assert }) => {
    const school = await createSchool('SD Uji')
    const teacher = await createTeacher(school)
    const staff = await createStaff()

    const staffOnApp = await login(client, 'app', { email: staff.email, password: PASSWORD })
    assert.equal(staffOnApp.response.header('location'), '/masuk')

    const teacherOnAdmin = await login(client, 'admin', {
      email: teacher.email,
      password: PASSWORD,
    })
    assert.equal(teacherOnAdmin.response.header('location'), '/masuk')

    const stillGuest = await visit(client, 'admin', '/', {
      name: sessionCookieNames.admin,
      sessionId: teacherOnAdmin.sessionId!,
    })
    assert.equal(stillGuest.header('location'), '/masuk')
  })

  test('an exam card of a closed session does not sign in', async ({ client, assert }) => {
    const school = await createSchool('SD Uji')
    const participant = await createParticipant(school, 'closed')

    const { response } = await login(client, 'exam', {
      username: participant.username,
      password: PASSWORD,
    })
    assert.equal(response.header('location'), '/masuk')
  })

  test('each host sets its own session cookie', async ({ client, assert }) => {
    for (const area of ['app', 'admin', 'exam'] as const) {
      const response = await visit(client, area, '/masuk')
      const names = Object.keys(response.cookies())
      assert.include(names, sessionCookieNames[area])
      for (const other of ['app', 'admin', 'exam'] as const) {
        if (other !== area) assert.notInclude(names, sessionCookieNames[other])
      }
    }
  })

  test('a POST without a CSRF token is refused', async ({ client, assert }) => {
    const page = await visit(client, 'app', '/masuk')
    const sessionId = page.cookie(sessionCookieNames.app)?.value as string

    const response = await client
      .post('/masuk')
      .header('host', 'app.sigrak.test')
      .withCookie(sessionCookieNames.app, sessionId)
      .form({ email: 'a@uji.test', password: 'x' })
      .redirects(0)
    assert.notEqual(response.header('location'), '/kalender')
    assert.include([302, 403], response.status())
  })

  test('the sixth failed login of an account is throttled', async ({ client, assert }) => {
    const school = await createSchool('SD Uji')
    const teacher = await createTeacher(school)

    for (let attempt = 0; attempt < 5; attempt++) {
      await login(client, 'app', { email: teacher.email, password: 'salah-sekali' })
    }

    // Even the right password is refused while the account is blocked.
    const { response, sessionId } = await login(client, 'app', {
      email: teacher.email,
      password: PASSWORD,
    })
    assert.equal(response.header('location'), '/masuk')

    const form = await visit(client, 'app', '/masuk', {
      name: sessionCookieNames.app,
      sessionId: sessionId!,
    }).withInertia()
    assert.match(form.inertiaProps.errors.email, /Terlalu banyak percobaan masuk/)
  })
})
