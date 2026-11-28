import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type StaffUser from '#models/staff_user'
import { importExtracurricularCatalog } from '#layers/domains/extracurricular_import'
import { PackageChoices } from '#layers/package_choices'
import { AreaProposals, SchoolProposals } from '#layers/proposals'
import { SchoolLayer } from '#layers/school_layer'
import { createStaff } from '#tests/helpers'
import { region } from '#tests/regions'
import { asSchool, createMember } from '#tests/tenancy'
import {
  YEAR,
  addItems,
  createPackage,
  itemKeysFor,
  keys,
  layerFixtures,
  publishedCatalog,
  resolveFor,
} from '#tests/layers'

async function staffWithRole(role: StaffUser['role']) {
  const staff = await createStaff()
  staff.role = role
  await staff.save()
  return staff
}

const PRAMUKA = 'SIGRAK-KAT-EKS-01'
const FUTSAL = 'SIGRAK-KAT-EKS-04'

test.group('Layers | school proposals (D-380)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('a teacher proposes, the operator approves, the change runs through the rules', async ({
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    await publishedCatalog()
    const teacher = await createMember(sdJati, 'teacher')
    const operator = await createMember(sdJati, 'operator')
    const asTeacher = { schoolId: sdJati.id, userId: teacher.user.id }
    const asOperator = { schoolId: sdJati.id, userId: operator.user.id }

    const id = await asSchool(sdJati, () =>
      SchoolProposals.propose(asTeacher, {
        domain: 'extracurricular',
        schoolYear: YEAR,
        action: 'hide',
        itemKey: FUTSAL,
        reason: 'Lapangan dipakai pembangunan',
      })
    )
    // The proposer cannot decide their own proposal.
    await assert.rejects(() => asSchool(sdJati, () => SchoolProposals.approve(asTeacher, id, null)))

    await asSchool(sdJati, () => SchoolProposals.approve(asOperator, id, 'Setuju'))
    const result = await resolveFor(sdJati, 'extracurricular')
    assert.include(keys(result.hidden), FUTSAL)
    assert.equal(
      result.hidden.find((i) => i.itemKey === FUTSAL)!.hiddenBy.reason,
      'Lapangan dipakai pembangunan'
    )

    const row = await db.from('layer_proposals').where('public_id', id).first()
    assert.equal(row.status, 'approved')
    assert.equal(Number(row.decided_by_user_id), operator.user.id)
    const notice = await db.from('layer_notices').where('kind', 'proposal_decided').first()
    assert.equal(notice.payload.status, 'approved')

    // Decided proposals stay decided.
    await assert.rejects(
      () => asSchool(sdJati, () => SchoolProposals.reject(asOperator, id, null)),
      /proposal_not_open/
    )
  })

  test('the rules run at send: mandatory and the kepanduan minimum are refused', async ({
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    await publishedCatalog()
    const principal = await createMember(sdJati, 'principal')
    const actor = { schoolId: sdJati.id, userId: principal.user.id }
    await assert.rejects(
      () =>
        asSchool(sdJati, () =>
          SchoolProposals.propose(actor, {
            domain: 'extracurricular',
            schoolYear: YEAR,
            action: 'hide',
            itemKey: PRAMUKA,
          })
        ),
      /group_minimum\.scouting/
    )
    await assert.rejects(
      () =>
        asSchool(sdJati, () =>
          SchoolProposals.propose(actor, {
            domain: 'extracurricular',
            schoolYear: YEAR,
            action: 'add',
            item: { label: 'futsal' },
          })
        ),
      /layers\.errors\.duplicate/
    )
  })

  test('replacing Pramuka: add another kepanduan, then Pramuka may be hidden', async ({
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    await publishedCatalog()
    const operator = await createMember(sdJati, 'operator')
    const actor = { schoolId: sdJati.id, userId: operator.user.id }
    await asSchool(sdJati, async () => {
      await SchoolLayer.add(actor, 'extracurricular', YEAR, {
        label: 'Hizbul Wathan',
        scouting: true,
      })
      await SchoolLayer.hide(actor, 'extracurricular', YEAR, PRAMUKA, 'Diganti Hizbul Wathan')
    })
    const result = await resolveFor(sdJati, 'extracurricular')
    assert.notInclude(keys(result.items), PRAMUKA)
    const hw = result.items.find((item) => item.value.label === 'Hizbul Wathan')!
    assert.equal(hw.groupKey, 'scouting')
    assert.equal(hw.source.layer, 'school')
    // The last kepanduan of the school cannot be removed now.
    await assert.rejects(
      () => asSchool(sdJati, () => SchoolLayer.retire(actor, 'extracurricular', YEAR, hw.itemKey)),
      /group_minimum\.scouting/
    )
  })

  test('withdraw is for the proposer only', async ({ assert }) => {
    const { sdJati } = await layerFixtures()
    await publishedCatalog()
    const teacher = await createMember(sdJati, 'teacher')
    const other = await createMember(sdJati, 'teacher')
    const id = await asSchool(sdJati, () =>
      SchoolProposals.propose(
        { schoolId: sdJati.id, userId: teacher.user.id },
        { domain: 'extracurricular', schoolYear: YEAR, action: 'add', item: { label: 'Angklung' } }
      )
    )
    await assert.rejects(() =>
      asSchool(sdJati, () =>
        SchoolProposals.withdraw({ schoolId: sdJati.id, userId: other.user.id }, id)
      )
    )
    await asSchool(sdJati, () =>
      SchoolProposals.withdraw({ schoolId: sdJati.id, userId: teacher.user.id }, id)
    )
    const row = await db.from('layer_proposals').where('public_id', id).first()
    assert.equal(row.status, 'withdrawn')
  })
})

test.group('Layers | local agreements (D-466)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('the operator follows and leaves; the principal is told each time', async ({ assert }) => {
    const { sdJati } = await layerFixtures()
    const operator = await createMember(sdJati, 'operator')
    const agreement = await createPackage({ layer: 'district', regionCode: '33.19.03' })
    await addItems(agreement, [{ key: 'JATI-1' }])
    const actor = { schoolId: sdJati.id, userId: operator.user.id }

    await asSchool(sdJati, () =>
      PackageChoices.choose(actor, agreement.publicId, YEAR, '2026-07-01')
    )
    await assert.rejects(
      () => asSchool(sdJati, () => PackageChoices.choose(actor, agreement.publicId, YEAR)),
      /already_chosen/
    )
    const listed = await asSchool(sdJati, () => PackageChoices.list(sdJati.id, YEAR))
    assert.equal(listed[0].chosen?.since, '2026-07-01')

    await asSchool(sdJati, () => PackageChoices.leave(actor, agreement.publicId, YEAR))
    const notices = await db
      .from('layer_notices')
      .where('school_id', sdJati.id)
      .whereIn('kind', ['package_chosen', 'package_left'])
      .orderBy('id')
    assert.deepEqual(
      notices.map((notice) => [notice.kind, notice.audience]),
      [
        ['package_chosen', 'principal'],
        ['package_left', 'principal'],
      ]
    )
    assert.equal(notices[0].payload.actor_name, operator.user.name)
  })

  test('official packages cannot be chosen; a retired agreement ends its choices', async ({
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    const operator = await createMember(sdJati, 'operator')
    const actor = { schoolId: sdJati.id, userId: operator.user.id }
    const official = await createPackage({ layer: 'regency', regionCode: '33.19' })
    await assert.rejects(
      () => asSchool(sdJati, () => PackageChoices.choose(actor, official.publicId, YEAR)),
      /layers\.errors\.not_found/
    )
    const agreement = await createPackage({
      layer: 'regency',
      regionCode: '33.19',
      kind: 'local_agreement',
    })
    await asSchool(sdJati, () =>
      PackageChoices.choose(actor, agreement.publicId, YEAR, '2026-07-01')
    )
    await db.from('layer_packages').where('id', agreement.id).update({ status: 'retired' })
    const choice = await db.from('school_package_choices').where('package_id', agreement.id).first()
    assert.equal(choice.status, 'ended')
    assert.equal(choice.end_reason, 'package_retired')
  })
})

test.group('Layers | area proposals (§6)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('a kecamatan agreement: evidence required, checked by another approver, then followable', async ({
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    await publishedCatalog()
    const proposer = await staffWithRole('support')
    const approver = await staffWithRole('admin')
    const jati = await region('33.19.03')
    const payload = {
      kind: 'local_agreement',
      name: 'Kesepakatan KKKS Jati 2026/2027',
      line: 'all',
      level_scope: 'both',
      applies_from_school_year: YEAR,
    }

    await assert.rejects(
      () =>
        AreaProposals.propose(proposer, {
          domain: 'extracurricular',
          regionId: jati.id,
          action: 'create_package',
          payload,
        }),
      /evidence_required/
    )
    await assert.rejects(
      () =>
        AreaProposals.propose(proposer, {
          domain: 'extracurricular',
          regionId: jati.id,
          action: 'create_package',
          payload: { ...payload, kind: 'official' },
          evidence: { document_title: 'Surat Dinas' },
        }),
      /official_at_district/
    )
    const id = await AreaProposals.propose(proposer, {
      domain: 'extracurricular',
      regionId: jati.id,
      action: 'create_package',
      payload,
      evidence: { document_title: 'Notulen rapat KKKS Jati 3 Juli 2026', pages: [1, 2] },
    })

    // A support member cannot approve; the proposer never approves their own.
    await assert.rejects(() => AreaProposals.approve(proposer, id, { evidenceChecked: true }))
    await assert.rejects(
      () => AreaProposals.approve(approver, id, { evidenceChecked: false }),
      /evidence_unchecked/
    )
    const { packageId, impact } = await AreaProposals.approve(approver, id, {
      evidenceChecked: true,
    })
    assert.equal(impact.schools, 2)
    const pkg = await db.from('layer_packages').where('id', packageId).first()
    assert.equal(pkg.status, 'active')
    assert.equal(pkg.layer, 'district')
    assert.equal(pkg.kind, 'local_agreement')
    assert.equal(Number(pkg.approved_by_staff_id), approver.id)
    assert.isString(pkg.evidence.checked_on)

    // An item proposed into the new package; then a school follows it.
    const addId = await AreaProposals.propose(proposer, {
      domain: 'extracurricular',
      regionId: jati.id,
      action: 'add',
      packagePublicId: pkg.public_id,
      payload: { item: { label: 'Kentongan', category: 'arts_culture' } },
    })
    await AreaProposals.approve(approver, addId, { evidenceChecked: false })
    const operator = await createMember(sdJati, 'operator')
    await asSchool(sdJati, () =>
      PackageChoices.choose(
        { schoolId: sdJati.id, userId: operator.user.id },
        pkg.public_id,
        YEAR,
        '2026-07-01'
      )
    )
    const result = await resolveFor(sdJati, 'extracurricular', { on: '2026-08-01' })
    const kentongan = result.items.find((item) => item.value.label === 'Kentongan')!
    assert.equal(kentongan.source.layer, 'district')
    assert.equal(kentongan.source.packageKind, 'local_agreement')
    assert.equal(kentongan.source.regionName, 'Jati')
  })

  test('the admin who proposes cannot approve; return and resubmit work', async ({ assert }) => {
    await layerFixtures()
    await publishedCatalog()
    const adminA = await staffWithRole('admin')
    const adminB = await staffWithRole('admin')
    const kudus = await region('33.19')
    const id = await AreaProposals.propose(adminA, {
      domain: 'extracurricular',
      regionId: kudus.id,
      action: 'create_package',
      payload: {
        kind: 'official',
        name: 'Peraturan Bupati Kudus tentang ekstrakurikuler',
        line: 'all',
        level_scope: 'both',
        applies_from_school_year: YEAR,
      },
      evidence: {
        regulation_code: 'PERBUP-KUDUS-UJI',
        source_url: 'https://jdih.kuduskab.go.id/uji',
      },
    })
    await assert.rejects(
      () => AreaProposals.approve(adminA, id, { evidenceChecked: true }),
      /own_proposal/
    )
    await AreaProposals.return(adminB, id, 'Lampirkan halaman yang tepat')
    let row = await db.from('layer_proposals').where('public_id', id).first()
    assert.equal(row.status, 'returned')
    await AreaProposals.resubmit(adminA, id, {
      evidence: {
        regulation_code: 'PERBUP-KUDUS-UJI',
        source_url: 'https://jdih.kuduskab.go.id/uji',
        pages: [3],
      },
    })
    row = await db.from('layer_proposals').where('public_id', id).first()
    assert.equal(row.status, 'submitted')
    assert.isNull(row.decided_at)
    await AreaProposals.approve(adminB, id, { evidenceChecked: true })
    row = await db.from('layer_proposals').where('public_id', id).first()
    assert.equal(row.status, 'approved')
  })

  test('an area hide reaches the schools below; the kepanduan minimum holds for areas too', async ({
    assert,
  }) => {
    const { sdJati, sdJepara } = await layerFixtures()
    await importExtracurricularCatalog(db.connection(), { activate: true })
    const proposer = await staffWithRole('content')
    const approver = await staffWithRole('admin')
    const kudus = await region('33.19')
    const createId = await AreaProposals.propose(proposer, {
      domain: 'extracurricular',
      regionId: kudus.id,
      action: 'create_package',
      payload: {
        kind: 'official',
        name: 'Ekstrakurikuler Kabupaten Kudus',
        line: 'all',
        level_scope: 'both',
        applies_from_school_year: YEAR,
      },
      evidence: { regulation_code: 'SE-DISDIK-KUDUS-UJI' },
    })
    const { packageId } = await AreaProposals.approve(approver, createId, { evidenceChecked: true })
    const pkg = await db.from('layer_packages').where('id', packageId).first()

    await assert.rejects(
      () =>
        AreaProposals.propose(proposer, {
          domain: 'extracurricular',
          regionId: kudus.id,
          action: 'hide',
          packagePublicId: pkg.public_id,
          itemKey: PRAMUKA,
        }),
      /group_minimum\.scouting/
    )
    const hideId = await AreaProposals.propose(proposer, {
      domain: 'extracurricular',
      regionId: kudus.id,
      action: 'hide',
      packagePublicId: pkg.public_id,
      itemKey: FUTSAL,
      reason: 'Diganti sepak bola',
    })
    await AreaProposals.approve(approver, hideId, { evidenceChecked: true })

    assert.notInclude(await itemKeysFor(sdJati, 'extracurricular'), FUTSAL)
    assert.include(await itemKeysFor(sdJepara, 'extracurricular'), FUTSAL)
    const version = await db.from('layer_packages').where('id', packageId).first()
    assert.equal(version.version, 2)
  })
})
