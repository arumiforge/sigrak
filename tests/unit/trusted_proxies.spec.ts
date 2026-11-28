import { test } from '@japa/runner'
import { defineConfig } from '@adonisjs/core/http'
import { trustedProxies } from '#services/trusted_proxies'

test.group('Trusted proxies (D-479)', () => {
  test('unset or empty trusts nobody, not even loopback', ({ assert }) => {
    assert.isFalse(trustedProxies(undefined))
    assert.isFalse(trustedProxies(''))
    assert.isFalse(trustedProxies(' , '))
    const trust = defineConfig({ trustProxy: trustedProxies(undefined) }).trustProxy
    assert.isFalse(trust('127.0.0.1', 0))
  })

  test('a list trusts only the given nginx addresses and ranges', ({ assert }) => {
    assert.deepEqual(trustedProxies(' 172.30.0.10 , 10.89.0.0/24 '), [
      '172.30.0.10',
      '10.89.0.0/24',
    ])
    const trust = defineConfig({
      trustProxy: trustedProxies('172.30.0.10,10.89.0.0/24'),
    }).trustProxy
    assert.isTrue(trust('172.30.0.10', 0))
    assert.isTrue(trust('10.89.0.25', 0))
    assert.isFalse(trust('172.30.0.11', 0))
    assert.isFalse(trust('127.0.0.1', 0))
  })
})
