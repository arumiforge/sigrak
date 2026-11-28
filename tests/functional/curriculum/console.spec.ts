import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import ace from '@adonisjs/core/services/ace'
import db from '@adonisjs/lucid/services/db'
import { sessionCookieNames } from '#config/session'
import StaffActivityLog from '#models/staff_activity_log'
import { createSchool, createStaff, visit } from '#tests/helpers'
import { inertiaPage, postForm, signIn, type Session } from '#tests/accounts'
import { importCurriculum } from '../../../app/curriculum/import/curriculum_importer.js'
import CurriculumVersion from '../../../app/curriculum/models/curriculum_version.js'
import { PolicyProfileResolver } from '../../../app/curriculum/policy/policy_profile_resolver.js'
import { compareVersions } from '../../../app/curriculum/console/compare.js'
import { impactOf } from '../../../app/curriculum/console/impact.js'
import {
  CurriculumReviewRefusedException,
  publish,
  recordImport,
  rollback,
  signOff,
  withdrawSignOff,
} from '../../../app/curriculum/console/review.js'
import { profileFile, ruleSet, tempDir, topicFile, writeJson } from './fixtures.js'

/**
 * Curriculum console (R2-08, D-317, D-339): separation of duty on the
 * sign-off, publish and rollback with the resolver following, the
 * comparison of two fixture versions, the impact report, and the
 * console pages with their abilities.
 */

const subjectsFile = 'docs/data/curriculum/subjects.json'
const cpGeneralFile = 'docs/data/curriculum/cp-umum-sd-bskap-046-2025.json'
const OLD = 'SIGRAK-UJI-2026-R1'
const NEW = 'SIGRAK-UJI-2027-R1'

/**
 * Two topic versions of one line (NEW supersedes OLD, from 2027/2028)
 * in a temporary profile folder. NEW differs from OLD in five ways:
 * topic 01 has a new title, topic 03 is gone, topic 04 is new, TP02 of
 * topic 02 has new text, and the semester 1 target grows by 2 JP.
 */
async function twoVersions() {
  await importCurriculum({ files: [subjectsFile, cpGeneralFile] })
  const directory = await tempDir('console')
  const profiles = await tempDir('console-profiles')
  await writeJson(
    profiles,
    'sd.json',
    profileFile('sd', [
      {
        code: 'PROFIL-UJI',
        appliesFrom: '2025/2026',
        ruleSets: {
          tp_atp_defaults: [
            ruleSet(OLD, '2025/2026'),
            ruleSet(NEW, '2027/2028', { supersedes: OLD }),
          ],
        },
      },
    ])
  )
  const old = await writeJson(directory, 'old.json', topicFile(OLD))

  const data = topicFile(NEW)
  const topics = data.subjects[0].topics
  topics[0].title = 'Judul baru'
  topics[1].learning_objectives[1].text = 'Tujuan kedua yang diperbaiki.'
  const added = { ...topics[2], code: `${NEW}-PP-K1-04`, title: 'Topik baru' }
  added.learning_objectives = added.learning_objectives.map((tp, index) => ({
    ...tp,
    code: `${NEW}-PP-K1-04-TP0${index + 1}`,
  }))
  added.focus_items = added.focus_items.map((item, index) => ({
    ...item,
    code: `${NEW}-PP-K1-04-FM0${index + 1}`,
    objective_codes: [`${NEW}-PP-K1-04-TP0${index + 1}`],
  }))
  topics.splice(2, 1, added)
  data.subjects[0].allocations[0].s1_jp = 10
  const next = await writeJson(directory, 'new.json', data)

  const result = await importCurriculum({ files: [old, next], profilesDirectory: profiles })
  if (result.failed) throw new Error(result.failed.error)
  return {
    old: await CurriculumVersion.findByOrFail('code', OLD),
    next: await CurriculumVersion.findByOrFail('code', NEW),
    newFile: next,
    newData: data,
    profiles,
  }
}

async function reload(version: CurriculumVersion) {
  return CurriculumVersion.findOrFail(version.id)
}

async function statusOf(version: CurriculumVersion) {
  const fresh = await reload(version)
  return fresh.status
}

async function importersOf(version: CurriculumVersion) {
  const fresh = await reload(version)
  return fresh.importedByIds
}

async function refusal(work: () => Promise<unknown>) {
  try {
    await work()
  } catch (error) {
    if (error instanceof CurriculumReviewRefusedException) return error.reason
    throw error
  }
  return null
}

async function actionsOf(version: CurriculumVersion) {
  const logs = await StaffActivityLog.query()
    .where('subject_type', 'curriculum_version')
    .where('subject_id', String(version.id))
    .orderBy('id', 'asc')
  return logs.map((log) => log.action)
}

test.group('Curriculum console | sign-off, publish, rollback', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => PolicyProfileResolver.clearCache())

  test('a validator never signs off a version they imported into (D-339)', async ({ assert }) => {
    const { next } = await twoVersions()
    const preparer = await createStaff(['validator'])
    const other = await createStaff(['validator'])

    await recordImport(preparer, NEW, { file: 'new.json', changes: 10 })
    await recordImport(preparer, NEW, { file: 'new.json', changes: 2 })
    const imported = await reload(next)
    assert.deepEqual(imported.importedByIds, [preparer.id])

    assert.equal(await refusal(() => signOff(preparer, next.id, null)), 'own_import')
    assert.equal(await statusOf(next), 'draft')

    const signed = await signOff(other, next.id, 'Topik kelas 1 sudah diperiksa.')
    assert.equal(signed.status, 'signed_off')
    assert.equal(signed.signedOffById, other.id)
    assert.equal(signed.signOffNote, 'Topik kelas 1 sudah diperiksa.')
    assert.isString(signed.signedOffFingerprint)
    assert.equal(await refusal(() => signOff(other, next.id, null)), 'not_draft')

    // Withdrawing returns the version to draft and clears the record.
    const withdrawn = await withdrawSignOff(other, next.id)
    assert.equal(withdrawn.status, 'draft')
    assert.isNull(withdrawn.signedOffById)
    assert.isNull(withdrawn.signedOffAt)
    assert.deepEqual(await actionsOf(next), [
      'curriculum.import',
      'curriculum.import',
      'curriculum.signoff',
      'curriculum.signoff_withdraw',
    ])
  }).timeout(60_000)

  test('curriculum:import --by records the importer and refuses an unknown email', async ({
    assert,
    cleanup,
  }) => {
    // Keep the command's report out of the test output.
    ace.ui.switchMode('raw')
    cleanup(() => ace.ui.switchMode('normal'))
    const { next, newFile, newData } = await twoVersions()
    const content = await createStaff(['content'])

    const unknown = await ace.exec('curriculum:import', [newFile, '--by', 'tidak-ada@uji.test'])
    assert.equal(unknown.exitCode, 1)

    // Nothing changed in the file: nobody is recorded.
    const unchanged = await ace.exec('curriculum:import', [newFile, '--by', content.email])
    assert.equal(unchanged.exitCode, 0)
    assert.deepEqual(await importersOf(next), [])

    newData.subjects[0].topics[0].title = 'Judul dari penyusun'
    await writeJson(newFile.replace(/new\.json$/, ''), 'new.json', newData)
    const command = await ace.exec('curriculum:import', [newFile, '--by', content.email])
    assert.equal(command.exitCode, 0)
    assert.deepEqual(await importersOf(next), [content.id])
    assert.deepEqual(await actionsOf(next), ['curriculum.import'])
  }).timeout(60_000)

  test('publish needs a sign-off on the current data and a published predecessor', async ({
    assert,
  }) => {
    const { old, next, newFile, newData, profiles } = await twoVersions()
    const validator = await createStaff(['validator'])
    const curator = await createStaff(['curriculum'])

    assert.equal(await refusal(() => publish(curator, next.id)), 'not_signed_off')

    await signOff(validator, next.id, null)
    assert.equal(await refusal(() => publish(curator, next.id)), 'predecessor_unpublished')

    await signOff(validator, old.id, null)
    await publish(curator, old.id)

    // The file is imported again with other content after the sign-off.
    newData.subjects[0].topics[0].title = 'Judul lain lagi'
    await writeJson(newFile.replace(/new\.json$/, ''), 'new.json', newData)
    await importCurriculum({ files: [newFile], profilesDirectory: profiles })
    assert.equal(await refusal(() => publish(curator, next.id)), 'changed_since_signoff')

    await withdrawSignOff(validator, next.id)
    await signOff(validator, next.id, 'Diperiksa ulang.')
    const published = await publish(curator, next.id)
    assert.equal(published.status, 'active')
    assert.equal(published.publishedById, curator.id)
    assert.isNotNull(published.publishedAt)
    // The predecessor stays active for the school years before NEW starts.
    assert.equal(await statusOf(old), 'active')
    assert.include(await actionsOf(next), 'curriculum.publish')
  }).timeout(60_000)

  test('the resolver follows publication and rollback', async ({ assert }) => {
    const { old, next, profiles } = await twoVersions()
    const resolver = new PolicyProfileResolver({ profilesDirectory: profiles })
    const pick = async (schoolYear: string) => {
      const policy = await resolver.resolve({ schoolYear, level: 'sd' })
      const ruleSets = policy.ruleSets
      return ruleSets.tp_atp_defaults.map((entry) => entry.code)
    }
    const validator = await createStaff(['validator'])
    const curator = await createStaff(['curriculum'])

    // Nothing published yet: the line works as before R2-08.
    assert.deepEqual(await pick('2027/2028'), [NEW])

    await signOff(validator, old.id, null)
    await publish(curator, old.id)
    // The line has a published version: the unpublished draft waits.
    assert.deepEqual(await pick('2027/2028'), [OLD])

    await signOff(validator, next.id, null)
    await publish(curator, next.id)
    assert.deepEqual(await pick('2026/2027'), [OLD])
    assert.deepEqual(await pick('2027/2028'), [NEW])

    // A retired predecessor comes back on rollback.
    await db.from('curriculum_versions').where('id', old.id).update({ status: 'retired' })
    PolicyProfileResolver.clearCache()
    assert.deepEqual(await pick('2026/2027'), [NEW])

    const { version, restored } = await rollback(curator, next.id)
    assert.equal(version.status, 'draft')
    assert.isNull(version.signedOffById)
    assert.isNull(version.signedOffFingerprint)
    assert.isNull(version.publishedAt)
    assert.equal(restored?.code, OLD)
    assert.equal(await statusOf(old), 'active')
    assert.deepEqual(await pick('2027/2028'), [OLD])
    assert.equal(await refusal(() => rollback(curator, next.id)), 'not_active')

    const log = await StaffActivityLog.query().where('action', 'curriculum.rollback').firstOrFail()
    assert.equal(log.staffUserId, curator.id)
    assert.deepInclude(log.changes, { code: NEW, restored: OLD, published_by: curator.id })
  }).timeout(60_000)

  test('compares two fixture versions per subject and grade', async ({ assert }) => {
    const { old, next } = await twoVersions()
    const comparison = await compareVersions(old, next, 'PP')

    assert.deepEqual(comparison.summary.topic, { added: 1, removed: 1, changed: 1 })
    assert.deepEqual(comparison.summary.objective, { added: 2, removed: 2, changed: 1 })
    assert.deepEqual(comparison.summary.allocation, { added: 0, removed: 0, changed: 1 })
    assert.deepEqual(comparison.summary.outcome, { added: 0, removed: 0, changed: 0 })

    assert.lengthOf(comparison.subjects, 1)
    assert.deepInclude(comparison.subjects[0], {
      code: 'PP',
      name: 'Pendidikan Pancasila',
      added: 3,
      removed: 3,
      changed: 3,
      jpBefore: 16,
      jpAfter: 18,
    })

    assert.lengthOf(comparison.groups, 1)
    const [grade1] = comparison.groups
    assert.equal(grade1.grade, 1)
    assert.deepEqual(grade1.jp, { before: 16, after: 18 })
    assert.deepEqual(grade1.topicJp, { before: 16, after: 16 })
    const topics = grade1.changes.filter((change) => change.area === 'topic')
    assert.deepEqual(
      topics.map((change) => [change.kind, change.key]),
      [
        ['added', 'PP-K1-04'],
        ['changed', 'PP-K1-01'],
        ['removed', 'PP-K1-03'],
      ]
    )
    assert.deepEqual(topics[1].fields, [
      { field: 'title', before: 'Topik 01', after: 'Judul baru' },
    ])
    const tp = grade1.changes.find(
      (change) => change.area === 'objective' && change.kind === 'changed'
    )!
    assert.equal(tp.key, 'PP-K1-02-TP02')
    assert.deepEqual(tp.fields, [
      { field: 'text', before: 'Tujuan kedua.', after: 'Tujuan kedua yang diperbaiki.' },
    ])
    const allocation = grade1.changes.find((change) => change.area === 'allocation')!
    assert.equal(allocation.label, 'intracurricular')
    assert.deepInclude(allocation.fields, { field: 's1_jp', before: 8, after: 10 })

    // A version compared with itself has no changes.
    const same = await compareVersions(next, next, null)
    assert.deepEqual(same.summary.topic, { added: 0, removed: 0, changed: 0 })
    assert.lengthOf(same.groups, 0)
  }).timeout(60_000)

  test('the impact report counts schools by level and region, within scope', async ({ assert }) => {
    const { next, profiles } = await twoVersions()
    await createSchool('SD Uji 1')
    await createSchool('SD Uji 2')
    const resolver = new PolicyProfileResolver({ profilesDirectory: profiles })

    const impact = await impactOf(next, { all: true }, resolver)
    assert.lengthOf(impact.rows, 1)
    assert.deepInclude(impact.rows[0], {
      level: 'sd',
      regionName: 'Uji',
      provinceName: 'Jawa Tengah',
      schools: 2,
      listed: true,
      currentCode: OLD,
    })
    assert.deepEqual(impact.totals, [{ level: 'sd', listed: 2, other: 0 }])

    const none = await impactOf(next, { all: false, areas: [] }, resolver)
    assert.lengthOf(none.rows, 0)
  }).timeout(60_000)
})

/* ----------------------------------------------------------------------
 * Console pages
 * -------------------------------------------------------------------- */

function get(client: Parameters<typeof visit>[0], session: Session, path: string) {
  return visit(client, 'admin', path, {
    name: sessionCookieNames.admin,
    sessionId: session.sessionId,
  })
}

async function statusAt(client: Parameters<typeof visit>[0], session: Session, path: string) {
  const response = await get(client, session, path)
  return response.status()
}

async function propsAt(client: Parameters<typeof visit>[0], session: Session, path: string) {
  const page = await inertiaPage(client, session, path)
  return page.inertiaProps
}

test.group('Curriculum console | pages and abilities', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(() => PolicyProfileResolver.clearCache())

  test('every curriculum role sees the pages; others get 403', async ({ client, assert }) => {
    const { next, old } = await twoVersions()
    for (const role of ['validator', 'content', 'curriculum', 'researcher', 'admin'] as const) {
      const staff = await createStaff([role])
      const session = await signIn(client, 'admin', staff.email)
      for (const path of [
        '/kurikulum',
        `/kurikulum/${next.id}`,
        `/kurikulum/${next.id}/bandingkan`,
        `/kurikulum/${next.id}/dampak`,
      ]) {
        assert.equal(await statusAt(client, session, path), 200, `${role} ${path}`)
      }
    }
    const support = await createStaff(['support'])
    const session = await signIn(client, 'admin', support.email)
    assert.equal(await statusAt(client, session, '/kurikulum'), 403)
    assert.equal(await statusAt(client, session, `/kurikulum/${old.id}`), 403)
  }).timeout(120_000)

  test('the pages show versions, the comparison and what the staff member may do', async ({
    client,
    assert,
  }) => {
    const { next, old } = await twoVersions()
    const preparer = await createStaff(['validator'])
    await recordImport(preparer, NEW, { file: 'new.json', changes: 10 })
    const session = await signIn(client, 'admin', preparer.email)

    const list = await propsAt(client, session, '/kurikulum')
    const codes = (list.versions as { code: string }[]).map((version) => version.code)
    assert.includeMembers(codes, [OLD, NEW, 'CP-UMUM-SD-BSKAP-046-2025'])

    const own = await propsAt(client, session, `/kurikulum/${next.id}`)
    assert.deepInclude(own.can, { signOff: false, publish: false, blocked: ['own_import'] })
    assert.deepEqual(own.version.importedBy, ['Staf Uji'])
    assert.deepEqual(own.predecessor.code, OLD)
    const other = await propsAt(client, session, `/kurikulum/${old.id}`)
    assert.deepInclude(other.can, { signOff: true, publish: false, rollback: false })

    const compare = await propsAt(client, session, `/kurikulum/${next.id}/bandingkan`)
    assert.equal(compare.base.code, OLD)
    assert.equal(compare.subject, 'PP')
    assert.deepEqual(compare.comparison.summary.topic, { added: 1, removed: 1, changed: 1 })
  }).timeout(120_000)

  test('sign-off and publish over HTTP, each with its own ability', async ({ client, assert }) => {
    const { old } = await twoVersions()
    const validator = await createStaff(['validator'])
    const curator = await createStaff(['curriculum'])
    const content = await createStaff(['content'])
    const page = `/kurikulum/${old.id}`

    // Kurator kurikulum and Penyusun konten cannot sign off; a validator cannot publish.
    for (const staff of [curator, content]) {
      const session = await signIn(client, 'admin', staff.email)
      const { response } = await postForm(client, session, `${page}/sahkan`, {}, page)
      assert.equal(response.status(), 403)
    }
    const validatorSession = await signIn(client, 'admin', validator.email)
    const signed = await postForm(
      client,
      validatorSession,
      `${page}/sahkan`,
      { note: 'Sudah diperiksa.' },
      page
    )
    assert.equal(signed.response.status(), 302)
    assert.equal(signed.response.header('location'), page)
    assert.equal(await statusOf(old), 'signed_off')
    const denied = await postForm(client, signed.session, `${page}/terbitkan`, {}, page)
    assert.equal(denied.response.status(), 403)

    const curatorSession = await signIn(client, 'admin', curator.email)
    const published = await postForm(client, curatorSession, `${page}/terbitkan`, {}, page)
    assert.equal(published.response.status(), 302)
    assert.equal(await statusOf(old), 'active')

    // A refused change returns to the page with the reason and changes nothing.
    const again = await postForm(client, published.session, `${page}/terbitkan`, {}, page)
    assert.equal(again.response.status(), 302)
    assert.equal(await statusOf(old), 'active')

    const back = await postForm(client, again.session, `${page}/kembalikan`, {}, page)
    assert.equal(back.response.status(), 302)
    assert.equal(await statusOf(old), 'draft')
    assert.deepEqual(await actionsOf(old), [
      'curriculum.signoff',
      'curriculum.publish',
      'curriculum.rollback',
    ])
  }).timeout(120_000)
})
