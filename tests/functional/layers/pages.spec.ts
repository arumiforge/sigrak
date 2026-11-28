import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import db from '@adonisjs/lucid/services/db'
import { hosts, type Area } from '#config/hosts'
import { sessionCookieNames } from '#config/session'
import type School from '#models/school'
import type StaffUser from '#models/staff_user'
import { PASSWORD, createStaff, login, visit } from '#tests/helpers'
import { createMember } from '#tests/tenancy'
import { createPackage, layerFixtures, publishedCatalog } from '#tests/layers'

type Session = { area: Area; sessionId: string; csrf: string }

async function sessionFor(client: ApiClient, area: Area, email: string): Promise<Session> {
  const { sessionId } = await login(client, area, { email, password: PASSWORD })
  const page = await visit(client, area, area === 'app' ? '/paket-daerah' : '/', {
    name: sessionCookieNames[area],
    sessionId: sessionId!,
  })
  return { area, sessionId: sessionId!, csrf: page.cookie('XSRF-TOKEN')?.value as string }
}

async function member(
  client: ApiClient,
  school: School,
  role: 'operator' | 'teacher' | 'principal'
) {
  const fixture = await createMember(school, role)
  return { ...fixture, session: await sessionFor(client, 'app', fixture.user.email) }
}

async function staff(client: ApiClient, role: StaffUser['role']) {
  const account = await createStaff()
  account.role = role
  await account.save()
  return { account, session: await sessionFor(client, 'admin', account.email) }
}

function get(client: ApiClient, session: Session, path: string) {
  return visit(client, session.area, path, {
    name: sessionCookieNames[session.area],
    sessionId: session.sessionId,
  })
}

function post(
  client: ApiClient,
  session: Session,
  path: string,
  body: Record<string, unknown> = {}
) {
  return client
    .post(path)
    .header('host', hosts[session.area])
    .header('x-csrf-token', session.csrf)
    .withCookie(sessionCookieNames[session.area], session.sessionId)
    .form(body)
    .redirects(0)
}

const PRAMUKA = 'SIGRAK-KAT-EKS-01'
const FUTSAL = 'SIGRAK-KAT-EKS-04'

test.group('Layers | pages', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))

  test('Ekstrakurikuler shows every row with its source; copy comes from lang/id', async ({
    client,
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    await publishedCatalog()
    const operator = await member(client, sdJati, 'operator')

    const page = await get(client, operator.session, '/ekstrakurikuler').withInertia()
    assert.equal(page.status(), 200)
    assert.equal(page.inertiaComponent, 'school/layers/extracurriculars')
    const props = page.inertiaProps as any
    assert.isTrue(props.canEdit)
    assert.isFalse(props.canPropose)
    assert.lengthOf(props.items, 21)
    assert.isTrue(props.ready)
    const pramuka = props.items.find((item: any) => item.key === PRAMUKA)
    assert.include(pramuka.source, { layer: 'national', origin: 'sigrak', packageKind: 'base' })
    assert.equal(pramuka.groupKey, 'scouting')
    assert.equal(props.messages['layers.badge.sigrak'], 'Bawaan SIGRAK')
    assert.equal(props.messages['layers.origin_sheet.title'], 'Asal data')
  })

  test('the operator hides and brings back; a teacher may only propose', async ({
    client,
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    await publishedCatalog()
    const operator = await member(client, sdJati, 'operator')
    const teacher = await member(client, sdJati, 'teacher')

    const forbidden = await post(client, teacher.session, `/ekstrakurikuler/${FUTSAL}/sembunyikan`)
    assert.equal(forbidden.status(), 403)

    const hidden = await post(client, operator.session, `/ekstrakurikuler/${FUTSAL}/sembunyikan`, {
      reason: 'Tidak ada pelatih',
    })
    assert.equal(hidden.status(), 302)
    const after = await get(client, operator.session, '/ekstrakurikuler').withInertia()
    const props = after.inertiaProps as any
    assert.lengthOf(props.items, 20)
    assert.equal(props.hidden[0].key, FUTSAL)
    assert.include(props.hidden[0].hiddenBy, {
      layer: 'school',
      own: true,
      reason: 'Tidak ada pelatih',
    })

    // Pramuka is the last kepanduan: refused with the Indonesian message.
    await post(client, operator.session, `/ekstrakurikuler/${PRAMUKA}/sembunyikan`)
    const refused = await get(client, operator.session, '/ekstrakurikuler').withInertia()
    assert.equal(
      refused.body().flash?.error,
      'Sekolah perlu menyediakan paling sedikit satu kegiatan kepanduan.'
    )

    await post(client, operator.session, `/ekstrakurikuler/${FUTSAL}/pakai-lagi`)
    const back = await get(client, operator.session, '/ekstrakurikuler').withInertia()
    assert.lengthOf((back.inertiaProps as any).items, 21)

    const proposed = await post(client, teacher.session, '/ekstrakurikuler/usulan', {
      action: 'add',
      label: 'Angklung',
      category: 'arts_culture',
      reason: 'Banyak murid berminat',
    })
    assert.equal(proposed.status(), 302)
    const queue = await get(client, operator.session, '/usulan').withInertia()
    const waiting = (queue.inertiaProps as any).waiting
    assert.lengthOf(waiting, 1)
    assert.include(waiting[0], { action: 'add', label: 'Angklung', own: false })

    await post(client, operator.session, `/usulan/${waiting[0].id}/setujui`, { note: 'Silakan' })
    const list = await get(client, operator.session, '/ekstrakurikuler').withInertia()
    const angklung = (list.inertiaProps as any).items.find((item: any) => item.label === 'Angklung')
    assert.include(angklung.source, { layer: 'school', origin: 'school' })
  })

  test('IDOR over HTTP: a school cannot touch another school’s proposal or another area’s package', async ({
    client,
    assert,
  }) => {
    const { sdJati, sdDawe } = await layerFixtures()
    await publishedCatalog()
    const operatorJati = await member(client, sdJati, 'operator')
    const teacherDawe = await member(client, sdDawe, 'teacher')
    const dawe = await createPackage({
      domain: 'extracurricular',
      layer: 'district',
      regionCode: '33.19.09',
    })

    await post(client, teacherDawe.session, '/ekstrakurikuler/usulan', {
      action: 'hide',
      item_key: FUTSAL,
    })
    const proposal = await db.from('layer_proposals').firstOrFail()

    await post(client, operatorJati.session, `/usulan/${proposal.public_id}/setujui`)
    const unchanged = await db.from('layer_proposals').where('id', proposal.id).first()
    assert.equal(unchanged.status, 'submitted')

    await post(client, operatorJati.session, `/paket-daerah/${dawe.publicId}/ikuti`)
    const choices = await db.from('school_package_choices').count('* as total')
    assert.equal(Number(choices[0].total), 0)

    const queue = await get(client, operatorJati.session, '/usulan').withInertia()
    assert.lengthOf((queue.inertiaProps as any).waiting, 0)
  })

  test('Paket daerah lists the school’s areas; the operator follows, the principal is told', async ({
    client,
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    await publishedCatalog()
    const operator = await member(client, sdJati, 'operator')
    const principal = await member(client, sdJati, 'principal')
    const agreement = await createPackage({
      domain: 'extracurricular',
      layer: 'district',
      regionCode: '33.19.03',
      name: 'Kesepakatan KKKS Jati',
    })
    await createPackage({ domain: 'extracurricular', layer: 'regency', regionCode: '33.20' })

    const page = await get(client, operator.session, '/paket-daerah').withInertia()
    const props = page.inertiaProps as any
    assert.equal(page.inertiaComponent, 'school/layers/packages')
    assert.lengthOf(props.official, 0)
    assert.lengthOf(props.agreements, 1)
    assert.equal(props.region.district.name, 'Jati')

    const forbidden = await post(
      client,
      principal.session,
      `/paket-daerah/${agreement.publicId}/ikuti`
    )
    assert.equal(forbidden.status(), 403)
    await post(client, operator.session, `/paket-daerah/${agreement.publicId}/ikuti`)

    const principalPage = await get(client, principal.session, '/paket-daerah').withInertia()
    const notices = (principalPage.inertiaProps as any).notices
    assert.lengthOf(notices, 1)
    assert.include(notices[0], { kind: 'package_chosen', packageName: 'Kesepakatan KKKS Jati' })
    await post(client, principal.session, `/pemberitahuan/${notices[0].id}/dibaca`)
    const read = await get(client, principal.session, '/paket-daerah').withInertia()
    assert.lengthOf((read.inertiaProps as any).notices, 0)
  })

  test('Usulan wilayah: staff propose, only another approver decides', async ({
    client,
    assert,
  }) => {
    await layerFixtures()
    await publishedCatalog()
    const support = await staff(client, 'support')
    const admin = await staff(client, 'admin')
    const kudus = await db.from('regions').where('kemendagri_code', '33.19').firstOrFail()

    const page = await get(client, support.session, '/usulan-wilayah').withInertia()
    assert.equal(page.inertiaComponent, 'admin/layers/area_proposals')
    assert.isFalse((page.inertiaProps as any).canApprove)

    await post(client, support.session, '/usulan-wilayah', {
      domain: 'extracurricular',
      region_id: kudus.id,
      action: 'create_package',
      kind: 'local_agreement',
      name: 'Kesepakatan K3S Kudus',
      line: 'all',
      level_scope: 'both',
      applies_from_school_year: '2026/2027',
      evidence_document: 'Notulen K3S Kudus',
      evidence_pages: '1, 2',
    })
    const proposal = await db.from('layer_proposals').firstOrFail()
    assert.equal(proposal.status, 'submitted')
    assert.deepEqual(proposal.evidence.pages, [1, 2])

    const notAllowed = await post(
      client,
      support.session,
      `/usulan-wilayah/${proposal.public_id}/setujui`,
      {
        evidence_checked: 'true',
      }
    )
    assert.equal(notAllowed.status(), 403)

    await post(client, admin.session, `/usulan-wilayah/${proposal.public_id}/setujui`, {
      evidence_checked: 'true',
    })
    const approved = await db.from('layer_proposals').where('id', proposal.id).first()
    assert.equal(approved.status, 'approved')
    const pkg = await db.from('layer_packages').where('id', approved.package_id).first()
    assert.include(pkg, { layer: 'regency', kind: 'local_agreement', status: 'active' })
  })
})
