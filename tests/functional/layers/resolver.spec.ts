import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { LayerResolver } from '#layers/resolver/layer_resolver'
import { SchoolLayer } from '#layers/school_layer'
import { PackageChoices } from '#layers/package_choices'
import { RegionChangeQueue } from '#regions/region_change_queue'
import { region } from '#tests/regions'
import { asSchool } from '#tests/tenancy'
import { createMember } from '#tests/tenancy'
import {
  YEAR,
  addItems,
  createPackage,
  groupRule,
  hide,
  jatengJointLeaveSchoolDays,
  keys,
  itemKeysFor,
  layerFixtures,
  nationalHolidays,
  resolveFor,
} from '#tests/layers'

/**
 * The 14 LayerResolver cases of docs/drafts/regional-layers.md §11.3,
 * on the database (packages, hides, choices, stamps and RLS as in
 * production). Committed data: the tenant connection must see it.
 */
test.group('Layers | resolver cases (§11.3)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('1. national only: the result equals the base package', async ({ assert }) => {
    const { sdJati } = await layerFixtures()
    const base = await createPackage({ layer: 'national' })
    await addItems(base, [{ key: 'A' }, { key: 'B' }, { key: 'C' }])

    const result = await resolveFor(sdJati)
    assert.deepEqual(keys(result.items), ['A', 'B', 'C'])
    assert.deepEqual(result.hidden, [])
    assert.deepEqual(result.shadowed, [])
    assert.deepEqual(result.stamp, { [base.code]: 1 })
    for (const item of result.items) {
      assert.equal(item.source.layer, 'national')
      assert.equal(item.source.packageCode, base.code)
      assert.equal(item.source.origin, 'sigrak')
    }
  })

  test('2. a province addition reaches every regency; a Kudus addition skips Jepara', async ({
    assert,
  }) => {
    const { sdJati, sdDawe, sdJepara } = await layerFixtures()
    await addItems(await createPackage({ layer: 'national' }), [{ key: 'N1' }])
    await addItems(await createPackage({ layer: 'province', regionCode: '33' }), [{ key: 'P1' }])
    await addItems(await createPackage({ layer: 'regency', regionCode: '33.19' }), [{ key: 'K1' }])

    assert.deepEqual(await itemKeysFor(sdJati), ['K1', 'N1', 'P1'])
    assert.deepEqual(await itemKeysFor(sdDawe), ['K1', 'N1', 'P1'])
    const jepara = await resolveFor(sdJepara)
    assert.deepEqual(keys(jepara.items), ['N1', 'P1'])
    const p1 = jepara.items.find((item) => item.itemKey === 'P1')!
    assert.equal(p1.source.layer, 'province')
    assert.equal(p1.source.regionName, 'Jawa Tengah')
  })

  test('3. a school hide of a non-mandatory national item: hidden, not in items', async ({
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    await addItems(await createPackage({ layer: 'national' }), [{ key: 'A' }, { key: 'B' }])
    const own = await createPackage({ layer: 'school', school: sdJati })
    await hide(own, 'B', 'Tidak ada pelatih')

    const result = await resolveFor(sdJati)
    assert.deepEqual(keys(result.items), ['A'])
    assert.deepEqual(keys(result.hidden), ['B'])
    assert.equal(result.hidden[0].hiddenBy.layer, 'school')
    assert.equal(result.hidden[0].hiddenBy.reason, 'Tidak ada pelatih')
  })

  test('4. a hide of a mandatory item: refused by LayerRules and the database; ignored by the resolver', async ({
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    const member = await createMember(sdJati, 'operator')
    await addItems(await createPackage({ layer: 'national' }), [
      { key: 'M', force: 'mandatory' },
      { key: 'F' },
    ])

    // Wall 1: the app.
    await assert.rejects(
      () =>
        asSchool(sdJati, () =>
          SchoolLayer.hide(
            { schoolId: sdJati.id, userId: member.user.id },
            'layer_test',
            YEAR,
            'M',
            null
          )
        ),
      /layers\.errors\.mandatory/
    )

    // Wall 2: the database trigger, even through the school's own connection.
    const own = await createPackage({ layer: 'school', school: sdJati })
    await assert.rejects(
      () =>
        asSchool(sdJati, async () => {
          const now = new Date()
          await db.connection('tenant').table('layer_hides').insert({
            package_id: own.id,
            domain: 'layer_test',
            target_item_key: 'M',
            status: 'active',
            created_at: now,
            updated_at: now,
          })
        }),
      /mandatory and cannot be hidden/
    )

    // Wall 3: forced in with the trigger off, the resolver ignores it and warns.
    await db.rawQuery('ALTER TABLE layer_hides DISABLE TRIGGER layer_hides_guard')
    try {
      const now = new Date()
      await db.table('layer_hides').insert({
        package_id: own.id,
        school_id: sdJati.id,
        domain: 'layer_test',
        target_item_key: 'M',
        status: 'active',
        created_at: now,
        updated_at: now,
      })
    } finally {
      await db.rawQuery('ALTER TABLE layer_hides ENABLE TRIGGER layer_hides_guard')
    }
    const ownRow = await db.from('layer_packages').where('id', own.id).first()
    const result = await resolveFor(sdJati)
    assert.include(keys(result.items), 'M')
    assert.deepInclude(result.warnings, {
      kind: 'hide_on_mandatory',
      itemKey: 'M',
      packageCode: ownRow.code,
    })
  })

  test('5. joint leave hidden by the province: every regency loses the same 5 dates, holidays stay', async ({
    assert,
  }) => {
    const { sdJati, sdJepara } = await layerFixtures()
    const days = nationalHolidays()
    const base = await createPackage({ layer: 'national', name: 'Hari libur nasional 2026/2027' })
    await addItems(
      base,
      days.map((day) => ({
        key: `HOL-${day.date}-${day.kind}`,
        label: `${day.date} ${day.name}`,
        force: day.kind === 'national_holiday' ? 'mandatory' : 'example',
      }))
    )
    const jateng = await createPackage({ layer: 'province', regionCode: '33' })
    for (const date of jatengJointLeaveSchoolDays()) await hide(jateng, `HOL-${date}-joint_leave`)

    const holidays = days.filter((day) => day.kind === 'national_holiday').length
    const jointLeave = days.filter((day) => day.kind === 'joint_leave').length
    for (const school of [sdJati, sdJepara]) {
      const result = await resolveFor(school)
      assert.lengthOf(result.hidden, 5)
      assert.lengthOf(result.items, holidays + jointLeave - 5)
      assert.isTrue(result.hidden.every((item) => item.hiddenBy.layer === 'province'))
      assert.lengthOf(
        result.items.filter((item) => item.force === 'mandatory'),
        holidays
      )
    }
    // The effective-day counts 254/134/120 (D-323) are the calendar adapter's acceptance test (R1-08).
  })

  test('6. group minimum: hiding the last kepanduan is refused; across layers the resolver restores the default', async ({
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    const member = await createMember(sdJati, 'operator')
    await addItems(await createPackage({ layer: 'national' }), [
      { key: 'PRAMUKA', groupKey: 'scouting' },
      { key: 'FUTSAL' },
    ])
    await groupRule('layer_test', 'scouting', 'PRAMUKA')

    await assert.rejects(
      () =>
        asSchool(sdJati, () =>
          SchoolLayer.hide(
            { schoolId: sdJati.id, userId: member.user.id },
            'layer_test',
            YEAR,
            'PRAMUKA',
            null
          )
        ),
      /layers\.errors\.group_minimum\.scouting/
    )

    // A kabupaten hide that no rule check stopped: the resolver brings Pramuka back.
    await hide(await createPackage({ layer: 'regency', regionCode: '33.19' }), 'PRAMUKA')
    const result = await resolveFor(sdJati)
    assert.include(keys(result.items), 'PRAMUKA')
    assert.notInclude(keys(result.hidden), 'PRAMUKA')
    assert.equal(result.warnings.find((w) => w.kind === 'group_minimum')?.kind, 'group_minimum')
  })

  test('7. a local agreement: not applied without a choice, applied with one, ended by a region change', async ({
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    const operator = await createMember(sdJati, 'operator')
    await addItems(await createPackage({ layer: 'national' }), [{ key: 'N1' }])
    const agreement = await createPackage({ layer: 'district', regionCode: '33.19.03' })
    await addItems(agreement, [{ key: 'JATI-1' }])

    assert.deepEqual(await itemKeysFor(sdJati), ['N1'])

    await asSchool(sdJati, () =>
      PackageChoices.choose(
        { schoolId: sdJati.id, userId: operator.user.id },
        agreement.publicId,
        YEAR,
        '2026-07-01'
      )
    )
    const chosen = await resolveFor(sdJati, 'layer_test', { on: '2026-08-01' })
    assert.deepEqual(keys(chosen.items), ['JATI-1', 'N1'])
    assert.equal(
      chosen.items.find((i) => i.itemKey === 'JATI-1')!.source.packageKind,
      'local_agreement'
    )

    // Staff move the school to Dawe; the choice of the Jati agreement ends.
    const dawe = await region('33.19.09')
    await db.rawQuery(
      `INSERT INTO region_change_reviews (school_id, from_region_id, from_district_id, to_region_id, to_district_id,
         status, apply_from, effective_on, detected_at, decided_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'accepted', 'next_day', '2026-08-02', now(), now(), now(), now())`,
      [sdJati.id, sdJati.regionId, sdJati.districtId, dawe.parentId, dawe.id]
    )
    assert.equal(await RegionChangeQueue.applyDue('2026-08-02'), 1)

    const choice = await db.from('school_package_choices').where('school_id', sdJati.id).first()
    assert.equal(choice.status, 'ended')
    assert.equal(choice.end_reason, 'region_changed')
    assert.deepEqual(await itemKeysFor(sdJati, 'layer_test', { on: '2026-08-01' }), ['N1'])
    const notice = await db
      .from('layer_notices')
      .where('school_id', sdJati.id)
      .where('kind', 'region_changed')
      .orderBy('id', 'desc')
      .first()
    assert.equal(notice.payload.ended_packages[0].package_code, agreement.code)
  })

  test('8. line filter: MI gets kemenag and all, SD gets kemendikdasmen and all; line beats all', async ({
    assert,
  }) => {
    const { sdJati, miJati } = await layerFixtures()
    await addItems(await createPackage({ layer: 'national' }), [{ key: 'N1' }])
    await addItems(await createPackage({ layer: 'province', regionCode: '33', line: 'all' }), [
      { key: 'CAL', label: 'Kalender Dinas' },
    ])
    await addItems(await createPackage({ layer: 'province', regionCode: '33', line: 'kemenag' }), [
      { key: 'CAL', label: 'Kalender Kanwil' },
      { key: 'MI-ONLY' },
    ])
    await addItems(
      await createPackage({ layer: 'province', regionCode: '33', line: 'kemendikdasmen' }),
      [{ key: 'SD-ONLY' }]
    )

    const sd = await resolveFor(sdJati)
    assert.deepEqual(keys(sd.items), ['CAL', 'N1', 'SD-ONLY'])
    assert.equal(sd.line, 'kemendikdasmen')
    assert.equal(sd.items.find((i) => i.itemKey === 'CAL')!.value.label, 'Kalender Dinas')

    const mi = await resolveFor(miJati)
    assert.equal(mi.line, 'kemenag')
    assert.deepEqual(keys(mi.items), ['CAL', 'MI-ONLY', 'N1'])
    const cal = mi.items.find((i) => i.itemKey === 'CAL')!
    assert.equal(cal.value.label, 'Kalender Kanwil')
    assert.equal(cal.source.line, 'kemenag')
    assert.equal(mi.shadowed.find((i) => i.itemKey === 'CAL')!.value.label, 'Kalender Dinas')
  })

  test('9. settings: the Kudus variant beats national; a mandatory national setting cannot be overridden', async ({
    assert,
  }) => {
    const { sdJati, sdJepara } = await layerFixtures()
    await addItems(await createPackage({ layer: 'national' }), [
      { key: 'S-04', label: 'Instrumen S-04 standar', shape: 'setting', matchKey: 'S-04' },
      {
        key: 'S-07',
        label: 'Kerangka observasi',
        shape: 'setting',
        matchKey: 'S-07',
        force: 'mandatory',
      },
    ])
    await addItems(await createPackage({ layer: 'regency', regionCode: '33.19' }), [
      { key: 'S-04', label: 'Instrumen S-04 Kudus', shape: 'setting', matchKey: 'S-04' },
      { key: 'S-07', label: 'Kerangka Kudus', shape: 'setting', matchKey: 'S-07' },
    ])

    const kudus = await resolveFor(sdJati)
    assert.equal(kudus.items.find((i) => i.itemKey === 'S-04')!.value.label, 'Instrumen S-04 Kudus')
    assert.equal(kudus.items.find((i) => i.itemKey === 'S-04')!.source.layer, 'regency')
    assert.equal(kudus.items.find((i) => i.itemKey === 'S-07')!.value.label, 'Kerangka observasi')
    assert.deepInclude(
      kudus.warnings.map((w) => w.kind),
      'setting_on_mandatory'
    )
    const jepara = await resolveFor(sdJepara)
    assert.equal(
      jepara.items.find((i) => i.itemKey === 'S-04')!.value.label,
      'Instrumen S-04 standar'
    )
  })

  test('10. a later national duplicate shadows a school addition with the same match key', async ({
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    const operator = await createMember(sdJati, 'operator')
    const base = await createPackage({ layer: 'national' })
    await addItems(base, [{ key: 'A', label: 'Futsal' }])
    const added = await asSchool(sdJati, () =>
      SchoolLayer.add({ schoolId: sdJati.id, userId: operator.user.id }, 'layer_test', YEAR, {
        label: 'Tenis Meja',
      })
    )
    assert.include(await itemKeysFor(sdJati), added)

    // Tim SIGRAK later adds "Tenis meja" nationally.
    await addItems(base, [{ key: 'B', label: 'Tenis meja' }])
    const result = await resolveFor(sdJati)
    assert.deepEqual(keys(result.items), ['A', 'B'])
    assert.equal(result.shadowed[0].itemKey, added)
    assert.equal(result.shadowed[0].shadowedBy, 'B')
    assert.deepInclude(
      result.warnings.map((w) => w.kind),
      'duplicate_of_higher'
    )
  })

  test('11. an item becomes mandatory: hides voided, item back, notice queued', async ({
    assert,
  }) => {
    const { sdJati, sdDawe } = await layerFixtures()
    const base = await createPackage({ layer: 'national' })
    await addItems(base, [{ key: 'A' }, { key: 'B' }])
    await hide(await createPackage({ layer: 'school', school: sdJati }), 'B')
    await hide(await createPackage({ layer: 'district', regionCode: '33.19.09' }), 'B')
    assert.deepEqual(await itemKeysFor(sdJati), ['A'])

    await db
      .from('catalog_items')
      .where('package_id', base.id)
      .where('item_key', 'B')
      .update({ force: 'mandatory' })

    const result = await resolveFor(sdJati)
    assert.deepEqual(keys(result.items), ['A', 'B'])
    const hides = await db.from('layer_hides').where('target_item_key', 'B')
    assert.lengthOf(hides, 2)
    for (const row of hides) {
      assert.equal(row.status, 'void')
      assert.equal(row.void_reason, 'became_mandatory')
    }
    for (const school of [sdJati, sdDawe]) {
      const notice = await db
        .from('layer_notices')
        .where('school_id', school.id)
        .where('kind', 'became_mandatory')
        .first()
      assert.equal(notice.payload.item_key, 'B')
    }
  })

  test('12. effective dates: a 2027/2028 package is not visible in 2026/2027; effective_on mid-year is honoured', async ({
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    await addItems(await createPackage({ layer: 'national' }), [{ key: 'N1' }])
    await addItems(
      await createPackage({ layer: 'province', regionCode: '33', from: '2027/2028' }),
      [{ key: 'NEXT' }]
    )
    await addItems(
      await createPackage({ layer: 'regency', regionCode: '33.19', effectiveOn: '2027-01-04' }),
      [{ key: 'MID' }]
    )

    assert.deepEqual(await itemKeysFor(sdJati, 'layer_test', { on: '2026-12-01' }), ['N1'])
    assert.deepEqual(await itemKeysFor(sdJati, 'layer_test', { on: '2027-01-04' }), ['MID', 'N1'])
    assert.deepEqual(await itemKeysFor(sdJati, 'layer_test', { schoolYear: '2027/2028' }), [
      'MID',
      'N1',
      'NEXT',
    ])
  })

  test('13. missing kecamatan: the district layer is skipped and a warning returned', async ({
    assert,
  }) => {
    const { sdJepara } = await layerFixtures()
    await addItems(await createPackage({ layer: 'national' }), [{ key: 'N1' }])
    const result = await resolveFor(sdJepara)
    assert.isNull(result.chain.district)
    assert.deepEqual(keys(result.items), ['N1'])
    assert.deepInclude(result.warnings, { kind: 'missing_district' })
  })

  test('14. stamps: a publish changes the cache key; an unrelated area’s publish does not', async ({
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    const base = await createPackage({ layer: 'national' })
    await addItems(base, [{ key: 'N1' }])
    const kudus = await createPackage({ layer: 'regency', regionCode: '33.19' })
    const jepara = await createPackage({ layer: 'regency', regionCode: '33.20' })
    const cached = () =>
      asSchool(sdJati, () => LayerResolver.resolve('layer_test', sdJati.id, YEAR))

    LayerResolver.clearCache()
    await cached()
    await cached()
    assert.include(LayerResolver.cacheStats(), { hits: 1, misses: 1 })

    await addItems(jepara, [{ key: 'JEPARA-1' }])
    await cached()
    assert.include(LayerResolver.cacheStats(), { hits: 2, misses: 1 })

    await addItems(kudus, [{ key: 'KUDUS-1' }])
    const after = await cached()
    assert.include(LayerResolver.cacheStats(), { hits: 2, misses: 2 })
    assert.deepEqual(keys(after.items), ['KUDUS-1', 'N1'])
  })
})
