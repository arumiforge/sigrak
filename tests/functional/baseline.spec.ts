import { test } from '@japa/runner'
import { visit } from '#tests/helpers'

function setCookie(header: string | string[] | undefined, name: string) {
  const lines = Array.isArray(header) ? header : header ? [header] : []
  return lines.find((line) => line.startsWith(`${name}=`)) ?? ''
}

test.group('Web baseline', () => {
  test('/healthz answers ok on every host without a cookie', async ({ client, assert }) => {
    for (const area of ['app', 'admin', 'exam'] as const) {
      const response = await visit(client, area, '/healthz')
      response.assertStatus(200)
      response.assertBody({ status: 'ok' })
      assert.isUndefined(response.header('set-cookie'))
    }
    const bare = await client.get('/healthz')
    bare.assertStatus(200)
    bare.assertBody({ status: 'ok' })
  })

  test('pages carry the security headers', async ({ client, assert }) => {
    const response = await visit(client, 'app', '/masuk')
    const csp = response.header('content-security-policy') as string
    assert.include(csp, "default-src 'self'")
    assert.include(csp, "frame-ancestors 'self'")
    assert.match(csp, /script-src 'self' 'nonce-[\w-]+'/)
    assert.equal(response.header('x-frame-options'), 'SAMEORIGIN')
    assert.equal(response.header('x-content-type-options'), 'nosniff')
    assert.equal(response.header('referrer-policy'), 'strict-origin-when-cross-origin')
    assert.include(response.header('permissions-policy') as string, 'camera=()')
    assert.include(response.header('strict-transport-security') as string, 'max-age=')
    assert.equal(response.header('cache-control'), 'no-store')
  })

  test('session cookies are HttpOnly; admin. uses SameSite=Strict', async ({ client, assert }) => {
    const app = await visit(client, 'app', '/masuk')
    const admin = await visit(client, 'admin', '/masuk')
    const appCookie = setCookie(app.header('set-cookie'), 'sigrak_app_session')
    const adminCookie = setCookie(admin.header('set-cookie'), 'sigrak_admin_session')
    assert.include(appCookie, 'HttpOnly')
    assert.include(appCookie, 'SameSite=Lax')
    assert.notInclude(appCookie, 'Domain=')
    assert.include(adminCookie, 'HttpOnly')
    assert.include(adminCookie, 'SameSite=Strict')
  })

  test('an unknown host gets no page', async ({ client }) => {
    const response = await client.get('/masuk').header('host', 'lain.sigrak.test').redirects(0)
    response.assertStatus(404)
  })
})
