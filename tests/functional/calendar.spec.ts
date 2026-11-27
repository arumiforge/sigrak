import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import { sessionCookieNames } from '#config/session'
import { PASSWORD, createCalendar, createSchool, createTeacher, login, visit } from '#tests/helpers'

test.group('Kalender', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  async function signedInTeacher(client: Parameters<typeof login>[0]) {
    const schoolA = await createSchool('SD Uji A')
    const schoolB = await createSchool('SD Uji B')
    await createCalendar(schoolA, ['Rapat guru sekolah A', 'Pentas seni sekolah A'])
    await createCalendar(schoolB, ['Rahasia sekolah B'])
    const teacher = await createTeacher(schoolA)
    const { sessionId } = await login(client, 'app', { email: teacher.email, password: PASSWORD })
    return { cookie: { name: sessionCookieNames.app, sessionId: sessionId! } }
  }

  test('the first render sends the shell and defers the entries', async ({ client, assert }) => {
    const { cookie } = await signedInTeacher(client)

    const page = await visit(client, 'app', '/kalender', cookie).withInertia()
    page.assertStatus(200)
    page.assertInertiaComponent('school/calendar')
    assert.equal(page.inertiaProps.school.name, 'SD Uji A')
    assert.notProperty(page.inertiaProps, 'entries')
    assert.deepEqual(page.body().deferredProps, { default: ['entries'] })
    assert.equal(page.inertiaProps.messages['calendar.title'], 'Kalender')
  })

  test('the deferred entries hold only the own school events', async ({ client, assert }) => {
    const { cookie } = await signedInTeacher(client)

    const partial = await visit(client, 'app', '/kalender', cookie).withInertiaPartialReload(
      'school/calendar',
      ['entries']
    )
    partial.assertStatus(200)

    const titles = (partial.inertiaProps.entries as { title: string }[]).map((entry) => entry.title)
    assert.includeMembers(titles, ['Rapat guru sekolah A', 'Pentas seni sekolah A'])
    assert.notInclude(titles, 'Rahasia sekolah B')
  })

  test('the full HTML page renders for a direct visit', async ({ client }) => {
    const { cookie } = await signedInTeacher(client)

    const page = await visit(client, 'app', '/kalender', cookie)
    page.assertStatus(200)
    page.assertHeader('content-type', 'text/html; charset=utf-8')
    page.assertTextIncludes('school\\/calendar')
    page.assertTextIncludes('SD Uji A')
  })
})
