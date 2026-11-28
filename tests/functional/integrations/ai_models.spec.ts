import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import limiter from '@adonisjs/limiter/services/main'
import redis from '@adonisjs/redis/services/main'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import StaffActivityLog from '#models/staff_activity_log'
import { AIGateway } from '#services/ai/ai_gateway'
import { FakeProvider } from '#services/ai/fake_provider'
import { aiProviders } from '#services/ai/providers'
import { purposeModels, resolvePurpose, startingModels } from '#integrations/ai_models'
import { createAiKeys, createSchool, createStaff, createTeacher } from '#tests/helpers'
import { inertiaPage, postForm, signIn, type Session } from '#tests/accounts'

/**
 * Pengaturan → Model AI (R2-03, D-315): the active model and ordered
 * fallbacks per purpose come from the console, the gateway reads them,
 * only the owner changes or tests them, every change is logged, and the
 * test button uses Tim SIGRAK's key, never a teacher's.
 */

const PAGE = '/pengaturan/model-ai'
const TEAM_KEY = 'gemini-tim-uji-5555'

function post(client: ApiClient, session: Session, path: string, data = {}) {
  return postForm(client, session, path, data, '/')
}

async function ownerSession(client: ApiClient) {
  const owner = await createStaff(['owner'])
  return { owner, session: await signIn(client, 'admin', owner.email) }
}

async function rowCount() {
  const [row] = await db.from('ai_purpose_models').count('* as c')
  return Number(row.c)
}

const modelsForm = (models: string[]) =>
  Object.fromEntries(models.map((model, index) => [`models[${index}]`, model]))

test.group('Integrations | AI models per purpose', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => limiter.clear(['memory']))
  group.each.setup(() => () => aiProviders.restore())

  test('the page lists every purpose from config with its starting models', async ({
    client,
    assert,
  }) => {
    const { session } = await ownerSession(client)
    const page = await inertiaPage(client, session, PAGE)
    page.assertStatus(200)
    const purposes = page.inertiaProps.purposes as { purpose: string; models: string[] }[]
    assert.deepEqual(
      purposes.map((purpose) => purpose.purpose),
      ['demo', 'document_long', 'document_short', 'game_content', 'repair']
    )
    assert.deepEqual(purposes[0].models, startingModels('demo'))
    assert.isTrue(page.inertiaProps.can.manage)
    assert.deepEqual(page.inertiaProps.teamKey, { set: false, last4: null })
  })

  test('the owner sets the model list; the gateway reads it; back to the start removes the row', async ({
    client,
    assert,
  }) => {
    const { owner, session } = await ownerSession(client)
    const { response } = await post(
      client,
      session,
      `${PAGE}/document_long`,
      modelsForm(['gemini-uji-pro', 'gemini-uji-flash'])
    )
    assert.equal(response.header('location'), PAGE)
    assert.deepEqual(await purposeModels('document_long'), ['gemini-uji-pro', 'gemini-uji-flash'])
    const resolved = await resolvePurpose('document_long')
    assert.deepEqual(resolved!.models, ['gemini-uji-pro', 'gemini-uji-flash'])
    assert.isAbove(resolved!.timeoutMs, 0)
    assert.deepEqual(await purposeModels('document_short'), startingModels('document_short'))

    await post(client, session, `${PAGE}/document_long/awal`)
    assert.deepEqual(await purposeModels('document_long'), startingModels('document_long'))
    assert.equal(await rowCount(), 0)

    const logs = await StaffActivityLog.query()
      .where('action', 'ai_model.updated')
      .orderBy('id', 'asc')
    assert.lengthOf(logs, 2)
    assert.equal(logs[0].staffUserId, owner.id)
    assert.equal(logs[0].subjectType, 'ai_model')
    assert.equal(logs[0].subjectId, 'document_long')
    assert.deepEqual(logs[0].changes, {
      from: startingModels('document_long'),
      to: ['gemini-uji-pro', 'gemini-uji-flash'],
    })
    assert.deepEqual(logs[1].changes.to, startingModels('document_long'))
  })

  test('invalid lists are refused: bad names, repeats, more than five, unknown purpose', async ({
    client,
    assert,
  }) => {
    const { session } = await ownerSession(client)
    for (const models of [
      ['gemini uji'],
      ['gemini-a', 'gemini-a'],
      ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'],
    ]) {
      const { response } = await post(client, session, `${PAGE}/demo`, modelsForm(models))
      assert.equal(response.status(), 302)
    }
    const empty = await post(client, session, `${PAGE}/demo`, {})
    assert.equal(empty.response.status(), 302)
    assert.equal(await rowCount(), 0)
    assert.lengthOf(await StaffActivityLog.query().where('subject_type', 'ai_model'), 0)

    const unknown = await post(client, session, `${PAGE}/tidak_ada`, modelsForm(['gemini-a']))
    assert.equal(unknown.response.status(), 404)
  })

  test('admin, finance and engineer read; only the owner changes and tests', async ({
    client,
    assert,
  }) => {
    for (const role of ['admin', 'finance', 'engineer'] as const) {
      const staff = await createStaff([role])
      const session = await signIn(client, 'admin', staff.email)
      const page = await inertiaPage(client, session, PAGE)
      page.assertStatus(200)
      assert.isFalse(page.inertiaProps.can.manage)
      for (const [path, data] of [
        [`${PAGE}/demo`, modelsForm(['gemini-a'])],
        [`${PAGE}/demo/awal`, {}],
        [`${PAGE}/demo/uji`, { model: 'gemini-a' }],
      ] as const) {
        const { response } = await post(client, session, path, data)
        assert.equal(response.status(), 403, `${role} ${path}`)
      }
    }
    const support = await createStaff(['support'])
    const supportSession = await signIn(client, 'admin', support.email)
    const refused = await inertiaPage(client, supportSession, PAGE)
    refused.assertStatus(403)
  })

  test('the gateway falls back to the next console model on model_unavailable', async ({
    assert,
  }) => {
    await redis.connection('ai').flushdb()
    const owner = await createStaff(['owner'])
    const { setPurposeModels } = await import('#integrations/ai_models')
    await setPurposeModels(owner, 'demo', ['fake-retired', 'fake-next'])

    const school = await createSchool('SD Uji Model')
    const teacher = await createTeacher(school)
    await createAiKeys(teacher, 1)
    const provider = new FakeProvider(({ model }) =>
      model === 'fake-retired'
        ? { kind: 'error', errorClass: 'model_unavailable', httpStatus: 404 }
        : { kind: 'ok' }
    )

    const result = await new AIGateway(provider).run({
      request: { purpose: 'demo', system: 'Uji', parts: ['Data uji'] },
      userId: teacher.id,
      schoolId: school.id,
    })

    assert.equal(result.response.model, 'fake-next')
    assert.deepEqual(
      provider.calls.map((call) => call.model),
      ['fake-retired', 'fake-next']
    )
  })

  test('the test button needs Tim SIGRAK key and calls with it, never a teacher key', async ({
    client,
    assert,
  }) => {
    const { session } = await ownerSession(client)
    const school = await createSchool('SD Uji Kunci')
    const teacher = await createTeacher(school)
    const [teacherKey] = await createAiKeys(teacher, 1)

    const secrets: string[] = []
    aiProviders.swap(
      () =>
        new FakeProvider((call) => {
          secrets.push(call.credential.secret)
          return call.model === 'gemini-hilang'
            ? { kind: 'error', errorClass: 'model_unavailable', httpStatus: 404 }
            : { kind: 'ok' }
        })
    )

    const missing = await post(client, session, `${PAGE}/demo/uji`, { model: 'gemini-uji' })
    let page = await inertiaPage(client, missing.session, PAGE)
    assert.include(page.body().flash?.error ?? '', 'kunci AI Tim SIGRAK belum diisi')
    assert.lengthOf(secrets, 0)

    await post(client, session, '/pengaturan/integrasi/kunci-ai', { gemini_key: TEAM_KEY })
    const ok = await post(client, session, `${PAGE}/demo/uji`, { model: 'gemini-uji' })
    page = await inertiaPage(client, ok.session, PAGE)
    assert.match(
      page.body().flash?.success ?? '',
      /^Model gemini-uji menjawab dalam [\d,]+ detik\.$/
    )
    assert.deepEqual(page.inertiaProps.teamKey, { set: true, last4: '5555' })

    const failed = await post(client, session, `${PAGE}/demo/uji`, { model: 'gemini-hilang' })
    page = await inertiaPage(client, failed.session, PAGE)
    assert.equal(
      page.body().flash?.error,
      'Model gemini-hilang belum menjawab: model tidak tersedia.'
    )

    assert.deepEqual(secrets, [TEAM_KEY, TEAM_KEY])
    assert.notInclude(secrets, teacherKey.revealSecret())
    const tests = await StaffActivityLog.query()
      .where('action', 'ai_model.tested')
      .orderBy('id', 'asc')
    assert.deepEqual(
      tests.map((log) => log.changes),
      [
        { model: 'gemini-uji', ok: false, reason: 'no_team_key' },
        { model: 'gemini-uji', ok: true },
        { model: 'gemini-hilang', ok: false, reason: 'model_unavailable' },
      ]
    )
    // Recent changes on the page include the tests.
    assert.lengthOf(page.inertiaProps.recent, 3)
  })
})
