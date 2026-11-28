import { test } from '@japa/runner'
import router from '@adonisjs/core/services/router'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import { hosts } from '#config/hosts'
import { newToken } from '#accounts/tokens'
import { visit } from '#tests/helpers'
import { guest, postForm } from '#tests/accounts'

/**
 * Only sign-in, sign-up, password reset, invitation acceptance and the
 * sign-up confirmation link work without a session (product concept,
 * Access model; D-459, D-469). Every other
 * route of app. and admin. sends a guest to /masuk. The list of routes
 * comes from the router, so a new route is checked without editing this
 * test.
 */
const PUBLIC_APP_PATTERNS = new Set([
  '/masuk',
  '/daftar',
  '/lupa-kata-sandi',
  '/kata-sandi-baru/:token',
  '/undangan/:token',
  '/konfirmasi-email/:token',
])

const SAMPLE_PARAMS: Record<string, string> = {
  token: newToken().token,
  invitation: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
  generation: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
  school: '1',
  user: '1',
  npsn: '20300001',
  review: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
}

function routesOf(domain: string) {
  const all = router.toJSON()
  return (all[domain] ?? []).filter((route) => !route.pattern.startsWith('/__transmit'))
}

function samplePath(pattern: string) {
  return pattern.replace(/:(\w+)/g, (_, name: string) => SAMPLE_PARAMS[name] ?? '1')
}

test.group('Accounts | what works without a session', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('on app., only sign-in, sign-up, reset, invitations and confirmation open for a guest', async ({
    client,
    assert,
  }) => {
    const gets = routesOf(hosts.app).filter((route) => route.methods.includes('GET'))
    assert.isAbove(gets.length, 8)

    for (const route of gets) {
      const response = await visit(client, 'app', samplePath(route.pattern))
      if (PUBLIC_APP_PATTERNS.has(route.pattern)) {
        assert.equal(response.status(), 200, `${route.pattern} should open for a guest`)
      } else {
        assert.equal(response.status(), 302, `${route.pattern} should need a session`)
        assert.equal(response.header('location'), '/masuk', route.pattern)
      }
    }
  })

  test('every app. form outside the public ones refuses a guest', async ({ client, assert }) => {
    const session = await guest(client)
    const posts = routesOf(hosts.app).filter(
      (route) =>
        route.methods.includes('POST') &&
        !PUBLIC_APP_PATTERNS.has(route.pattern) &&
        route.pattern !== '/masuk'
    )
    assert.isAbove(posts.length, 5)

    for (const route of posts) {
      const { response } = await postForm(client, session, samplePath(route.pattern), {}, '/masuk')
      assert.equal(response.status(), 302, route.pattern)
      assert.equal(response.header('location'), '/masuk', route.pattern)
    }
  })

  test('the whole staff console needs a staff session', async ({ client, assert }) => {
    const gets = routesOf(hosts.admin).filter(
      (route) => route.methods.includes('GET') && route.pattern !== '/masuk'
    )
    assert.isAbove(gets.length, 3)
    for (const route of gets) {
      const response = await visit(client, 'admin', samplePath(route.pattern))
      assert.equal(response.status(), 302, route.pattern)
      assert.equal(response.header('location'), '/masuk', route.pattern)
    }
  })
})
