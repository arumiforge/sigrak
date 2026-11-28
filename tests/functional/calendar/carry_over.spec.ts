import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { toIsoDate } from '#calendar/dates'
import { PackageChoices } from '#layers/package_choices'
import { saveAcademicYear } from '#school_year/academic_years'
import { createPackage, layerFixtures } from '#tests/layers'
import { asSchool, createMember } from '#tests/tenancy'

/**
 * D-472: chosen local agreements are copied into a new school year when
 * it is created; the operator gets a notice and can stop following.
 */
test.group('Calendar | local agreements carry over into a new school year (D-472)', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.timeout(60_000)

  function createYear(school: Parameters<typeof asSchool>[0], start: number) {
    return asSchool(school, () =>
      saveAcademicYear({
        startsOn: DateTime.fromISO(`${start}-07-13`),
        evenSemesterStartsOn: DateTime.fromISO(`${start + 1}-01-04`),
        endsOn: DateTime.fromISO(`${start + 1}-06-19`),
      })
    )
  }

  test('an active choice is copied with a notice; ended or expired ones are not', async ({
    assert,
  }) => {
    const { sdJati, sdDawe } = await layerFixtures()
    const operator = await createMember(sdJati, 'operator')
    const actor = { schoolId: sdJati.id, userId: operator.user.id }
    const lasting = await createPackage({
      layer: 'district',
      regionCode: '33.19.03',
      name: 'Kesepakatan KKKS Jati',
      from: '2026/2027',
    })
    const oneYear = await createPackage({
      layer: 'district',
      regionCode: '33.19.03',
      name: 'Kesepakatan setahun',
      from: '2026/2027',
      to: '2026/2027',
    })
    const left = await createPackage({
      layer: 'regency',
      kind: 'local_agreement',
      regionCode: '33.19',
      name: 'Kesepakatan yang ditinggalkan',
      from: '2026/2027',
    })

    await createYear(sdJati, 2026)
    await asSchool(sdJati, async () => {
      for (const pkg of [lasting, oneYear, left]) {
        await PackageChoices.choose(actor, pkg.publicId, '2026/2027', '2026-07-13')
      }
      await PackageChoices.leave(actor, left.publicId, '2026/2027')
    })

    await createYear(sdJati, 2027)

    const copied = await db
      .from('school_package_choices')
      .where('school_id', sdJati.id)
      .where('school_year', '2027/2028')
    assert.lengthOf(copied, 1)
    assert.equal(Number(copied[0].package_id), lasting.id)
    assert.equal(copied[0].status, 'active')
    assert.equal(Number(copied[0].chosen_by_user_id), operator.user.id)
    assert.equal(toIsoDate(copied[0].starts_on), '2027-07-13')

    const notices = await db
      .from('layer_notices')
      .where('school_id', sdJati.id)
      .where('kind', 'package_carried_over')
    assert.lengthOf(notices, 1)
    assert.equal(notices[0].audience, 'operator')
    assert.equal(notices[0].payload.school_year, '2027/2028')
    assert.deepEqual(
      notices[0].payload.packages.map((pkg: { package_name: string }) => pkg.package_name),
      ['Kesepakatan KKKS Jati']
    )

    // Another school's choices and years are untouched.
    await createYear(sdDawe, 2027)
    const dawe = await db.from('school_package_choices').where('school_id', sdDawe.id)
    assert.lengthOf(dawe, 0)
  })

  test('the operator can stop following a carried-over agreement', async ({ assert }) => {
    const { sdJati } = await layerFixtures()
    const operator = await createMember(sdJati, 'operator')
    const actor = { schoolId: sdJati.id, userId: operator.user.id }
    const pkg = await createPackage({
      layer: 'district',
      regionCode: '33.19.03',
      from: '2026/2027',
    })
    await createYear(sdJati, 2026)
    await asSchool(sdJati, () =>
      PackageChoices.choose(actor, pkg.publicId, '2026/2027', '2026-07-13')
    )
    await createYear(sdJati, 2027)

    await asSchool(sdJati, () => PackageChoices.leave(actor, pkg.publicId, '2027/2028'))
    const rows = await db
      .from('school_package_choices')
      .where('school_id', sdJati.id)
      .orderBy('school_year')
      .select('school_year', 'status')
    assert.deepEqual(
      rows.map((row) => [row.school_year, row.status]),
      [
        ['2026/2027', 'active'],
        ['2027/2028', 'ended'],
      ]
    )
  })
})
