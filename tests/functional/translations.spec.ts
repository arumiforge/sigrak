import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import { sessionCookieNames } from '#config/session'
import { login, visit } from '#tests/helpers'

test.group('Translations: pages', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => limiter.clear(['memory']))

  test('every page gets the shared copy and only its own files', async ({ client, assert }) => {
    const page = await visit(client, 'app', '/masuk').withInertia()
    const keys = Object.keys(page.inertiaProps.messages)

    assert.equal(page.inertiaProps.messages['nav.sign_out'], 'Keluar')
    assert.equal(page.inertiaProps.messages['errors.general'].length > 0, true)
    assert.equal(page.inertiaProps.messages['auth.titles.login'], 'Masuk')
    assert.isFalse(keys.some((key) => key.startsWith('validation.')))
    assert.isFalse(keys.some((key) => key.startsWith('calendar.')))
  })

  test('validation messages are Indonesian', async ({ client, assert }) => {
    const empty = await login(client, 'app', { email: '', password: '' })
    const form = await visit(client, 'app', '/masuk', {
      name: sessionCookieNames.app,
      sessionId: empty.sessionId!,
    }).withInertia()
    assert.equal(form.inertiaProps.errors.email, 'Email wajib diisi.')
    assert.equal(form.inertiaProps.errors.password, 'Kata sandi wajib diisi.')

    const typo = await login(client, 'app', { email: 'guru-sekolah', password: 'x' })
    const again = await visit(client, 'app', '/masuk', {
      name: sessionCookieNames.app,
      sessionId: typo.sessionId!,
    }).withInertia()
    assert.equal(
      again.inertiaProps.errors.email,
      'Tulis email yang lengkap, misalnya nama@sekolah.sch.id.'
    )
  })
})
