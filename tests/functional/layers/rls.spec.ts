import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import LayerNotice from '#layers/models/layer_notice'
import LayerPackage from '#layers/models/layer_package'
import LayerProposal from '#layers/models/layer_proposal'
import SchoolPackageChoice from '#layers/models/school_package_choice'
import { PackageChoices } from '#layers/package_choices'
import { SchoolLayer } from '#layers/school_layer'
import { SchoolProposals } from '#layers/proposals'
import { SchoolContext } from '#tenancy/school_context'
import { staffTransaction } from '#tenancy/tenant_transaction'
import { assertRlsHides, assertSchoolCannotRead, asSchool, createMember } from '#tests/tenancy'
import { YEAR, addItems, createPackage, keys, layerFixtures, resolveFor } from '#tests/layers'

/**
 * Tenancy of the layer tables (docs/drafts/regional-layers.md §11.3):
 * school A never reads or writes school B's packages, items, hides,
 * choices, proposals or notices, by the app or straight through SQL;
 * a school reads national packages and those of its own areas only;
 * national and area rows are written by staff and the owner only.
 */
async function twoSchoolsWithRows() {
  const fixtures = await layerFixtures()
  const a = fixtures.sdJati
  const b = fixtures.sdDawe
  const operatorA = await createMember(a, 'operator')
  const operatorB = await createMember(b, 'operator')
  const teacherB = await createMember(b, 'teacher')
  await addItems(await createPackage({ layer: 'national' }), [{ key: 'N1' }, { key: 'N2' }])
  const agreementDawe = await createPackage({ layer: 'district', regionCode: '33.19.09' })
  await addItems(agreementDawe, [{ key: 'DAWE-1' }])

  const actorB = { schoolId: b.id, userId: operatorB.user.id }
  const ownItem = await asSchool(b, async () => {
    await SchoolLayer.hide(actorB, 'layer_test', YEAR, 'N2', 'Rahasia B')
    const key = await SchoolLayer.add(actorB, 'layer_test', YEAR, { label: 'Kegiatan Rahasia B' })
    await PackageChoices.choose(actorB, agreementDawe.publicId, YEAR, '2026-07-01')
    return key
  })
  const proposalId = await asSchool(b, () =>
    SchoolProposals.propose(
      { schoolId: b.id, userId: teacherB.user.id },
      { domain: 'layer_test', schoolYear: YEAR, action: 'hide', itemKey: 'N1', reason: null }
    )
  )

  const ids = async (table: string) =>
    ((await db.from(table).where('school_id', b.id).select('id')) as { id: number }[]).map((row) =>
      Number(row.id)
    )
  const packageB = await db
    .from('layer_packages')
    .where('school_id', b.id)
    .select('id', 'public_id')
    .firstOrFail()
  const itemRows = (await db
    .from('catalog_items')
    .where('package_id', packageB.id)
    .select('id')) as {
    id: number
  }[]
  await db.table('layer_notices').insert({
    school_id: b.id,
    kind: 'package_chosen',
    audience: 'principal',
    payload: JSON.stringify({ package_name: 'Rahasia' }),
    created_at: new Date(),
  })

  return {
    ...fixtures,
    a,
    b,
    operatorA,
    operatorB,
    agreementDawe,
    ownItem,
    proposalId,
    packageB: { id: Number(packageB.id), publicId: packageB.public_id as string },
    rows: {
      layer_packages: await ids('layer_packages'),
      layer_hides: await ids('layer_hides'),
      school_package_choices: await ids('school_package_choices'),
      layer_proposals: await ids('layer_proposals'),
      layer_notices: await ids('layer_notices'),
      catalog_items: itemRows.map((row) => Number(row.id)),
    },
  }
}

test.group('Layers | RLS and IDOR', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('the database wall hides every school-owned layer row of another school', async ({
    assert,
  }) => {
    const { a, rows } = await twoSchoolsWithRows()
    for (const [table, ids] of Object.entries(rows)) {
      assert.isAbove(ids.length, 0, `${table}: fixture rows`)
      await assertRlsHides(assert, a, table, ids)
    }
  })

  test('the app wall finds nothing of another school by id', async ({ assert }) => {
    const { a, rows } = await twoSchoolsWithRows()
    await assertSchoolCannotRead(assert, a, () =>
      SchoolPackageChoice.find(rows.school_package_choices[0])
    )
    await assertSchoolCannotRead(assert, a, () => LayerNotice.find(rows.layer_notices[0]))
    await assertSchoolCannotRead(assert, a, () => LayerPackage.find(rows.layer_packages[0]))
    await assertSchoolCannotRead(assert, a, () => LayerProposal.find(rows.layer_proposals[0]))
  })

  test('the resolver never shows another school’s items, hides or choices', async ({ assert }) => {
    const { a, b, ownItem } = await twoSchoolsWithRows()
    const resultA = await resolveFor(a)
    assert.deepEqual(keys(resultA.items), ['N1', 'N2'])
    assert.deepEqual(resultA.hidden, [])
    const resultB = await resolveFor(b)
    assert.deepEqual(keys(resultB.items), ['DAWE-1', 'N1', ownItem].sort())
    assert.deepEqual(keys(resultB.hidden), ['N2'])
  })

  test('school A cannot act on school B’s rows through the services', async ({ assert }) => {
    const { a, operatorA, agreementDawe, ownItem, proposalId } = await twoSchoolsWithRows()
    const actorA = { schoolId: a.id, userId: operatorA.user.id }
    await assert.rejects(
      () => asSchool(a, () => SchoolLayer.retire(actorA, 'layer_test', YEAR, ownItem)),
      /not_own_item/
    )
    await assert.rejects(
      () => asSchool(a, () => SchoolLayer.unhide(actorA, 'layer_test', YEAR, 'N2')),
      /not_own_hide/
    )
    await assert.rejects(
      () => asSchool(a, () => SchoolProposals.approve(actorA, proposalId, null)),
      /proposal_not_open/
    )
    // A Jati school cannot follow (or even see) a Dawe agreement.
    await assert.rejects(
      () => asSchool(a, () => PackageChoices.choose(actorA, agreementDawe.publicId, YEAR)),
      /layers\.errors\.not_found/
    )
    const listed = await asSchool(a, () => PackageChoices.list(a.id, YEAR))
    assert.deepEqual(listed, [])
  })

  test('raw writes into another school’s or a shared package are refused', async ({ assert }) => {
    const { a, packageB } = await twoSchoolsWithRows()
    const national = await db.from('layer_packages').where('layer', 'national').firstOrFail()
    const kudus = await createPackage({ layer: 'regency', regionCode: '33.19' })
    const now = new Date()

    const attempt = (sql: string, bindings: unknown[]) =>
      asSchool(a, async () => {
        const trx = SchoolContext.current()!.trx!
        await trx.rawQuery(sql, bindings as never)
      })
    const itemSql = `INSERT INTO catalog_items (package_id, item_key, origin, match_key, label, created_at, updated_at)
                     VALUES (?, 'X', ?, 'x', 'X', now(), now())`

    await assert.rejects(() => attempt(itemSql, [packageB.id, 'school']), /row-level security/)
    await assert.rejects(() => attempt(itemSql, [national.id, 'sigrak']), /row-level security/)
    await assert.rejects(() => attempt(itemSql, [kudus.id, 'official']), /row-level security/)
    await assert.rejects(
      () =>
        attempt(
          `INSERT INTO layer_hides (package_id, domain, target_item_key, status, created_at, updated_at)
           VALUES (?, '', 'N1', 'active', ?, ?)`,
          [packageB.id, now, now]
        ),
      /row-level security/
    )
    // Updating a national package touches no row (invisible to writes).
    const updated = await asSchool(a, async () => {
      const trx = SchoolContext.current()!.trx!
      const result = await trx.rawQuery(`UPDATE layer_packages SET name = 'X' WHERE id = ?`, [
        national.id,
      ])
      return result.rowCount
    })
    assert.equal(updated, 0)
    await assert.rejects(
      () =>
        attempt(
          `INSERT INTO layer_packages (code, domain, layer, line, kind, name, status, applies_from_school_year, created_at, updated_at)
           VALUES ('HACK', 'layer_test', 'national', 'all', 'base', 'X', 'active', '2026/2027', now(), now())`,
          []
        ),
      /row-level security/
    )
    // The app role cannot write stamps or group rules at all.
    await assert.rejects(
      () => attempt(`UPDATE layer_stamps SET stamp = 0`, []),
      /permission denied/
    )
  })

  test('a school reads national packages and its own areas, never another area', async ({
    assert,
  }) => {
    const { sdJati, sdJepara } = await layerFixtures()
    await createPackage({ layer: 'national' })
    await createPackage({ layer: 'province', regionCode: '33' })
    const kudus = await createPackage({ layer: 'regency', regionCode: '33.19' })
    const jepara = await createPackage({ layer: 'regency', regionCode: '33.20' })
    const dawe = await createPackage({ layer: 'district', regionCode: '33.19.09' })

    const visible = (school: typeof sdJati) =>
      asSchool(school, async () => {
        const trx = SchoolContext.current()!.trx!
        const result = await trx.rawQuery(`SELECT code FROM layer_packages ORDER BY code`)
        return (result.rows as { code: string }[]).map((row) => row.code)
      })
    const fromJati = await visible(sdJati)
    assert.include(fromJati, kudus.code)
    assert.notInclude(fromJati, jepara.code)
    assert.notInclude(fromJati, dawe.code)
    const fromJepara = await visible(sdJepara)
    assert.include(fromJepara, jepara.code)
    assert.notInclude(fromJepara, kudus.code)
    assert.lengthOf(fromJepara, 3)
  })

  test('staff see every school’s layer rows', async ({ assert }) => {
    const { rows } = await twoSchoolsWithRows()
    const count = await staffTransaction(async (trx) => {
      const result = await trx.rawQuery(
        `SELECT count(*)::int AS total FROM layer_hides WHERE id = ANY(?)`,
        [rows.layer_hides]
      )
      return result.rows[0].total as number
    })
    assert.equal(count, rows.layer_hides.length)
  })
})
