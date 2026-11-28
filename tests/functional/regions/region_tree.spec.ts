import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Region from '#models/region'
import School from '#models/school'
import { jawaTengah } from '#regions/data/jawa_tengah'
import { seedRegionList } from '#regions/region_list'
import { SchoolDirectory } from '#regions/school_directory'
import { TENANT_CONNECTION } from '#tenancy/database_roles'
import { region, seedJawaTengah, smallKudusFile, writeDirectoryFile } from '#tests/regions'
import { importSchoolDirectory } from '#regions/school_directory_importer'

test.group('Regions | tree', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the Jawa Tengah list seeds once, with both code sets', async ({ assert }) => {
    const written = await seedRegionList(db.connection(), jawaTengah)
    // 1 province + 3 regencies + 21 + 9 + 16 kecamatan
    assert.equal(written, 50)
    await seedRegionList(db.connection(), jawaTengah)

    const counts = await db.from('regions').groupBy('level').select('level').count('* as total')
    assert.deepEqual(Object.fromEntries(counts.map((row) => [row.level, Number(row.total)])), {
      province: 1,
      regency: 3,
      district: 46,
    })

    const kudus = await region('33.19')
    assert.equal(kudus.dapodikCode, '031900')
    assert.equal(kudus.kind, 'kabupaten')
    const jati = await region('33.19.03')
    assert.equal(jati.parentId, kudus.id)
    assert.equal(jati.kind, 'district')
    await kudus.load('children')
    assert.lengthOf(kudus.children, 9)
  })

  test('the database keeps the tree consistent', async ({ assert }) => {
    await seedJawaTengah()
    const province = await region('33')
    const kudus = await region('33.19')
    // Each attempt in its own savepoint, so a refused row does not abort the test transaction.
    const insert = (row: Record<string, unknown>) =>
      db.transaction((trx) =>
        trx
          .table('regions')
          .insert({ status: 'active', created_at: new Date(), updated_at: new Date(), ...row })
      )

    // A kecamatan straight under a province.
    await assert.rejects(
      () =>
        insert({
          level: 'district',
          parent_id: province.id,
          name: 'X',
          kemendagri_code: '33.01.01',
        }),
      /cannot sit under/
    )
    // A code that does not extend the parent's code.
    await assert.rejects(
      () =>
        insert({ level: 'district', parent_id: kudus.id, name: 'X', kemendagri_code: '33.20.99' }),
      /does not start with/
    )
    // A regency without a kind, and a malformed code.
    await assert.rejects(
      () =>
        insert({ level: 'regency', parent_id: province.id, name: 'X', kemendagri_code: '33.98' }),
      /regions_regency_kind_check/
    )
    await assert.rejects(
      () => insert({ level: 'province', name: 'X', kemendagri_code: '330' }),
      /regions_kemendagri_code_format_check/
    )
    // Two active kecamatan with one name under one regency.
    await assert.rejects(
      () =>
        insert({
          level: 'district',
          parent_id: kudus.id,
          name: 'jati',
          kemendagri_code: '33.19.98',
        }),
      /regions_active_name_unique/
    )
  })

  test('a school sits in a kabupaten/kota and in one of its kecamatan', async ({ assert }) => {
    await seedJawaTengah()
    const province = await region('33')
    const kudus = await region('33.19')
    const jati = await region('33.19.03')
    const kedung = await region('33.20.01')
    const base = { name: 'SD Uji', level: 'sd' as const, address: 'Jalan Uji', district: null }

    const create = (row: Partial<School>) =>
      db.transaction((trx) => School.create({ ...base, ...row }, { client: trx }))

    await assert.rejects(() => create({ regionId: province.id }), /must be a kabupaten or kota/)
    await assert.rejects(
      () => create({ regionId: kudus.id, districtId: kedung.id }),
      /must be a kecamatan of region_id/
    )
    const school = await School.create({ ...base, regionId: kudus.id, districtId: jati.id })
    await school.refresh()
    assert.equal(school.regionSource, 'staff_manual')
  })

  test('the app role reads regions and the directory but cannot write them', async ({ assert }) => {
    const tenant = db.connection(TENANT_CONNECTION)
    // The tenant login cannot see the uncommitted global transaction, so
    // only the grants are checked here.
    await assert.rejects(
      () =>
        tenant.table('regions').insert({
          level: 'province',
          name: 'X',
          kemendagri_code: '99',
          created_at: new Date(),
          updated_at: new Date(),
        }),
      /permission denied/
    )
    await assert.rejects(
      () => tenant.from('school_directory_entries').where('npsn', '00000000').delete(),
      /permission denied/
    )
    const visible = await tenant.from('regions').count('* as total')
    assert.isAtLeast(Number(visible[0].total), 0)
  })

  test('assignRegion puts a school where its directory row says', async ({ assert }) => {
    await seedJawaTengah()
    await importSchoolDirectory(await writeDirectoryFile(smallKudusFile()))
    const entry = (await SchoolDirectory.find('90000002'))!

    const school = new School()
    school.merge({ name: entry.name, level: entry.level, address: entry.address })
    SchoolDirectory.assignRegion(school, entry)
    await school.save()

    const bae = await region('33.19.07')
    assert.equal(school.npsn, '90000002')
    assert.equal(school.regionId, bae.parentId)
    assert.equal(school.districtId, bae.id)
    assert.equal(school.district, 'Bae')
    assert.equal(school.regionSource, 'npsn_directory')
    assert.isNotNull(school.regionCheckedAt)
    assert.instanceOf(await Region.find(school.regionId), Region)
  })
})
