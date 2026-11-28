import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import redis from '@adonisjs/redis/services/main'
import env from '#start/env'
import { LayerResolver } from '#layers/resolver/layer_resolver'
import { SharedCache, cacheConnectionReady } from '#services/shared_cache'
import { asSchool } from '#tests/tenancy'
import { YEAR, addItems, createPackage, keys, layerFixtures } from '#tests/layers'

/**
 * The `cache` Redis connection (D-480): rebuildable caches only, kept
 * apart from the state on `main`, and never a reason for a request to
 * fail.
 */
test.group('Redis | cache connection', (group) => {
  group.setup(async () => {
    if (!(await cacheConnectionReady())) throw new Error('The cache connection is not ready')
  })

  test('is its own connection, with the database name in its prefix', async ({ assert }) => {
    const cache = redis.connection('cache').ioConnection.options
    const main = redis.connection('main').ioConnection.options
    assert.equal(cache.keyPrefix, `sigrak:cache:${env.get('DB_DATABASE')}:`)
    assert.notEqual(cache.keyPrefix, main.keyPrefix)
    if (!env.get('REDIS_CACHE_HOST')) {
      // Development and CI: a database of the main Redis, never the state database.
      assert.notEqual(cache.db, main.db)
    }
    assert.isFalse(cache.enableOfflineQueue)
  })

  test('stores JSON values with a lifetime and clears only its namespace', async ({
    assert,
    cleanup,
  }) => {
    const one = new SharedCache('test-one', { ttlSeconds: 60 })
    const two = new SharedCache('test-two', { ttlSeconds: 60 })
    cleanup(() => Promise.all([one.clear(), two.clear()]).then(() => undefined))

    await one.set('a', { items: [1, 2], name: 'Uji' })
    await two.set('a', 'kept')
    assert.deepEqual(await one.get('a'), { items: [1, 2], name: 'Uji' })
    const ttl = await redis.connection('cache').ttl('test-one:a')
    assert.isAbove(ttl, 0)
    assert.isAtMost(ttl, 60)

    await one.clear()
    assert.isUndefined(await one.get('a'))
    assert.equal(await two.get('a'), 'kept')
  })

  test('a cache that is down or failing answers "not cached" and never throws', async ({
    assert,
  }) => {
    const down = new SharedCache('test-down', {
      ttlSeconds: 60,
      connection: () => ({ status: 'reconnecting' }) as never,
    })
    await down.set('a', 1)
    assert.isUndefined(await down.get('a'))
    await down.clear()

    const failing = new SharedCache('test-failing', {
      ttlSeconds: 60,
      connection: () =>
        ({
          status: 'ready',
          get: () => Promise.reject(new Error('OOM command not allowed')),
          set: () => Promise.reject(new Error('OOM command not allowed')),
        }) as never,
    })
    await failing.set('a', 1)
    assert.isUndefined(await failing.get('a'))
  })
})

test.group('Redis | layer resolutions on the shared cache', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.setup(async () => {
    if (!(await cacheConnectionReady())) throw new Error('The cache connection is not ready')
  })

  test('another process reads a resolution from redis-cache; a publish still changes the key', async ({
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    const base = await createPackage({ layer: 'national' })
    await addItems(base, [{ key: 'N1' }])
    const kudus = await createPackage({ layer: 'regency', regionCode: '33.19' })
    const resolve = () =>
      asSchool(sdJati, () => LayerResolver.resolve('layer_test', sdJati.id, YEAR))

    await LayerResolver.clearCache()
    const first = await resolve()
    // A fresh process has an empty in-process cache.
    LayerResolver.clearLocalCache()
    const again = await resolve()
    assert.include(LayerResolver.cacheStats(), { hits: 1, sharedHits: 1, misses: 1 })
    assert.deepEqual(again, first)

    await addItems(kudus, [{ key: 'KUDUS-1' }])
    LayerResolver.clearLocalCache()
    const after = await resolve()
    assert.include(LayerResolver.cacheStats(), { hits: 1, sharedHits: 1, misses: 2 })
    assert.deepEqual(keys(after.items), ['KUDUS-1', 'N1'])
  })
})
