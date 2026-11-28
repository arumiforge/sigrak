import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { importExtracurricularCatalog } from '#layers/domains/extracurricular_import'
import { itemKeysFor, layerFixtures } from '#tests/layers'

test.group('Layers | extracurricular catalog import', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('imports the catalog as a draft national package, idempotently', async ({ assert }) => {
    const { sdJati } = await layerFixtures()
    const first = await db.transaction((trx) => importExtracurricularCatalog(trx))
    assert.deepInclude(first, { packageCreated: true, created: 21, revised: 0, status: 'draft' })
    const second = await db.transaction((trx) => importExtracurricularCatalog(trx))
    assert.deepInclude(second, { packageCreated: false, created: 0, revised: 0, unchanged: 21 })

    const rule = await db.from('layer_group_rules').where('group_key', 'scouting').firstOrFail()
    assert.include(rule, { min: 1, default_item_key: 'SIGRAK-KAT-EKS-01', force: 'mandatory' })

    // Draft until Tim Validasi signs it off (D-113): schools see nothing yet.
    assert.deepEqual(await itemKeysFor(sdJati, 'extracurricular'), [])
    const activated = await db.transaction((trx) =>
      importExtracurricularCatalog(trx, { activate: true })
    )
    assert.equal(activated.status, 'active')
    assert.lengthOf(await itemKeysFor(sdJati, 'extracurricular'), 21)
  })
})
