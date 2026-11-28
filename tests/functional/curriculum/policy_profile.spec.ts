import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { importCurriculum } from '../../../app/curriculum/import/curriculum_importer.js'
import {
  PolicyProfileResolver,
  UnknownLevelError,
  type PolicyProfile,
} from '../../../app/curriculum/policy/policy_profile_resolver.js'
import { SubjectsForGrade } from '../../../app/curriculum/subjects_for_grade.js'
import { profileFile, ruleSet, tempDir, writeJson } from './fixtures.js'

function codes(policy: PolicyProfile, domain: string) {
  return (policy.ruleSets[domain] ?? []).map((entry) => [entry.code, entry.inForce])
}

test.group('Policy-profile resolver', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => PolicyProfileResolver.clearCache())

  test('picks the rule sets in force by school year (CP 046/2025 from 2025/2026)', async ({
    assert,
  }) => {
    await importCurriculum()
    const resolver = new PolicyProfileResolver()

    const earlier = await resolver.resolve({ schoolYear: '2025/2026', level: 'sd' })
    // D-458: the general CP applies from 2025/2026; the religion CP from 2026/2027.
    assert.deepEqual(codes(earlier, 'cp'), [
      ['CP-PABP-BKPDM-020-2026', false],
      ['CP-UMUM-SD-BSKAP-046-2025', true],
    ])
    assert.deepEqual(codes(earlier, 'structure_jp'), [
      ['STRUKTUR-SD-PERMENDIKDASMEN-13-2025', true],
    ])
    assert.deepEqual(codes(earlier, 'tp_atp_defaults'), [['SIGRAK-SD-2026-R1', false]])
    // The only profile version starts in 2026/2027, so it is used before it starts (D-378).
    assert.equal(earlier.profile.code, 'PROFIL-SD-2026')
    assert.isFalse(earlier.profile.inForce)
    assert.sameMembers(earlier.ruleSetCodes, [
      'CP-UMUM-SD-BSKAP-046-2025',
      'STRUKTUR-SD-PERMENDIKDASMEN-13-2025',
    ])

    const current = await resolver.resolve({ schoolYear: '2026/2027', level: 'sd' })
    assert.deepEqual(codes(current, 'cp'), [
      ['CP-PABP-BKPDM-020-2026', true],
      ['CP-UMUM-SD-BSKAP-046-2025', true],
    ])
    assert.isTrue(current.profile.inForce)
    assert.equal(current.profile.data.homeroom_teacher_term, 'Guru kelas')
    const structure = current.ruleSets.structure_jp[0]
    assert.equal(structure.kind, 'structure')
    assert.equal(structure.status, 'draft')
    assert.isNumber(structure.versionId)
  }).timeout(120_000)

  test('reads the level from data: MI gets its own rule sets and profile values', async ({
    assert,
  }) => {
    await importCurriculum()
    const policy = await new PolicyProfileResolver().resolve({
      schoolYear: '2026/2027',
      level: 'mi',
    })
    assert.deepEqual(codes(policy, 'structure_jp'), [['ALOKASI-MI-KMA-1503-2025', true]])
    assert.deepEqual(codes(policy, 'cp'), [
      ['CP-PAI-BA-MADRASAH-9941-2025', true],
      ['CP-UMUM-SD-BSKAP-046-2025', true],
    ])
    assert.equal(policy.profile.data.homeroom_teacher_term, 'Wali kelas')
    assert.include(policy.profile.data.character_frameworks, 'kbc')

    // KMA 1503/2025 was set mid-year, so 2025/2026 is before it (D-354).
    const earlier = await new PolicyProfileResolver().resolve({
      schoolYear: '2025/2026',
      level: 'mi',
    })
    assert.deepEqual(codes(earlier, 'structure_jp'), [['ALOKASI-MI-KMA-1503-2025', false]])

    await assert.rejects(
      () => new PolicyProfileResolver().resolve({ schoolYear: '2026/2027', level: 'smp' }),
      UnknownLevelError
    )
  }).timeout(120_000)

  test('a line of rule sets: the latest started wins, a province entry first, retired skipped', async ({
    assert,
  }) => {
    const directory = await tempDir('profiles')
    await writeJson(
      directory,
      'sd.json',
      profileFile('sd', [
        {
          code: 'PROFIL-UJI-2025',
          appliesFrom: '2025/2026',
          ruleSets: {
            structure_jp: [
              ruleSet('STRUKTUR-A', '2025/2026'),
              ruleSet('STRUKTUR-B', '2027/2028', { supersedes: 'STRUKTUR-A' }),
              ruleSet('STRUKTUR-JATENG', '2026/2027', {
                supersedes: 'STRUKTUR-A',
                region_province: 'Jawa Tengah',
              }),
            ],
            cp: [
              ruleSet('CP-LAMA', '2025/2026'),
              ruleSet('CP-BARU', '2026/2027', { supersedes: 'CP-LAMA' }),
            ],
          },
        },
        {
          code: 'PROFIL-UJI-2027',
          appliesFrom: '2027/2028',
          ruleSets: { structure_jp: [ruleSet('STRUKTUR-B', '2027/2028')], cp: [] },
        },
      ])
    )
    const resolver = new PolicyProfileResolver({ profilesDirectory: directory })

    const national = await resolver.resolve({ schoolYear: '2026/2027', level: 'sd' })
    assert.equal(national.profile.code, 'PROFIL-UJI-2025')
    assert.deepEqual(codes(national, 'structure_jp'), [['STRUKTUR-A', true]])
    assert.deepEqual(codes(national, 'cp'), [['CP-BARU', true]])

    const province = await resolver.resolve({
      schoolYear: '2026/2027',
      level: 'sd',
      regionProvince: 'Jawa Tengah',
    })
    assert.deepEqual(codes(province, 'structure_jp'), [['STRUKTUR-JATENG', true]])

    const later = await resolver.resolve({ schoolYear: '2027/2028', level: 'sd' })
    assert.equal(later.profile.code, 'PROFIL-UJI-2027')
    assert.deepEqual(codes(later, 'structure_jp'), [['STRUKTUR-B', true]])

    // A retired version is skipped; its predecessor stays in force.
    PolicyProfileResolver.clearCache()
    await db.table('curriculum_versions').insert({
      code: 'CP-BARU',
      kind: 'cp',
      name: 'CP baru',
      status: 'retired',
      meta: '{}',
      created_at: new Date(),
      updated_at: new Date(),
    })
    const retired = await resolver.resolve({ schoolYear: '2026/2027', level: 'sd' })
    assert.deepEqual(codes(retired, 'cp'), [['CP-LAMA', true]])
  })

  test('results are cached per school year and cleared by an import', async ({ assert }) => {
    await importCurriculum({ files: ['docs/data/curriculum/subjects.json'] })
    const resolver = new PolicyProfileResolver()
    const first = await resolver.resolve({ schoolYear: '2026/2027', level: 'sd' })
    assert.strictEqual(await resolver.resolve({ schoolYear: '2026/2027', level: 'sd' }), first)
    assert.notStrictEqual(await resolver.resolve({ schoolYear: '2027/2028', level: 'sd' }), first)

    assert.isNull(first.ruleSets.structure_jp[0].versionId)
    await importCurriculum({
      files: ['docs/data/regulations/curriculum-structure-permendikdasmen-13-2025.json'],
    })
    const after = await resolver.resolve({ schoolYear: '2026/2027', level: 'sd' })
    assert.notStrictEqual(after, first)
    assert.isNumber(after.ruleSets.structure_jp[0].versionId)
  }).timeout(60_000)
})

test.group('Subjects for a grade', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => PolicyProfileResolver.clearCache())

  async function subjectsOf(level: string, grade: number, schoolYear = '2026/2027') {
    const { subjects } = await new SubjectsForGrade().forLevel({ level, grade, schoolYear })
    return new Map(subjects.map((subject) => [subject.code, subject]))
  }

  test('SD grade 1: structure subjects, optional Bahasa Inggris, art tracks with and without topics', async ({
    assert,
  }) => {
    await importCurriculum()
    const subjects = await subjectsOf('sd', 1)

    for (const code of ['PAI', 'PAKR', 'PP', 'BIN', 'MTK', 'PJOK', 'SB']) {
      assert.equal(subjects.get(code)?.status, 'compulsory', code)
      assert.isTrue(subjects.get(code)?.takenByDefault, code)
    }
    assert.isFalse(subjects.has('IPAS'))
    assert.isFalse(subjects.has('KKA'))
    assert.deepInclude(subjects.get('BIG')!, { status: 'optional', takenByDefault: false })
    assert.deepInclude(subjects.get('BJW')!, { status: 'local_content', takenByDefault: false })
    assert.equal(subjects.get('PP')!.cocurricularJpPerYear, 36)

    // D-458, D-464: four tracks; Tari and Teater can be picked without topics.
    const tracks = subjects.get('SB')!.artTracks
    assert.deepEqual(
      tracks.map((track) => [track.artBranch, track.jpPerYear, track.hasTopics]),
      [
        ['music', 108, true],
        ['visual_art', 108, true],
        ['dance', 108, false],
        ['theatre', 108, false],
      ]
    )
  }).timeout(120_000)

  test('phased-in and elective subjects follow the school year and grade', async ({ assert }) => {
    await importCurriculum()

    // D-410: Bahasa Inggris grades 3–6 elective until 2026/2027, compulsory from 2027/2028.
    const now = await subjectsOf('sd', 4, '2026/2027')
    assert.deepInclude(now.get('BIG')!, {
      status: 'elective',
      takenByDefault: false,
      condition: 'school_readiness',
    })
    const later = await subjectsOf('sd', 4, '2027/2028')
    assert.deepInclude(later.get('BIG')!, { status: 'compulsory', takenByDefault: true })

    // D-452: KKA is a grade 5–6 elective with a delivery choice.
    const grade5 = await subjectsOf('sd', 5)
    assert.deepInclude(grade5.get('KKA')!, { status: 'elective', takenByDefault: false })
    assert.sameMembers(grade5.get('KKA')!.delivery!.options, ['subject', 'cocurricular'])

    // D-458: Tata Boga is optional and its JP is set by the school.
    const grade3 = await subjectsOf('sd', 3)
    assert.deepInclude(grade3.get('KTB')!, {
      status: 'optional',
      jpTargetSetBy: 'school',
      takenByDefault: false,
    })

    // MI reads its own structure; the six SD religions are not MI subjects.
    const mi = await subjectsOf('mi', 3)
    assert.isTrue(mi.has('SKI'))
    assert.equal(mi.get('QH')!.status, 'compulsory')
    assert.isFalse(mi.has('PAKR'))
    assert.equal(mi.get('BIG')!.status, 'elective')
  }).timeout(120_000)

  test('MI grade 1: general subjects from SIGRAK-SD, PAI and Bahasa Arab from the MI curriculum (D-469)', async ({
    assert,
  }) => {
    await importCurriculum()
    const { policy, subjects: list } = await new SubjectsForGrade().forLevel({
      level: 'mi',
      grade: 1,
      schoolYear: '2026/2027',
    })
    assert.deepEqual(codes(policy, 'tp_atp_defaults'), [
      ['SIGRAK-MI-2026-R1', true],
      ['SIGRAK-SD-2026-R1', true],
    ])
    const subjects = new Map(list.map((subject) => [subject.code, subject]))

    // Each subject once; MI's PAI subjects and Bahasa Arab, no SD religion subject.
    assert.lengthOf(list, subjects.size)
    for (const code of ['QH', 'AA', 'FIK', 'BAR', 'PP', 'BIN', 'MTK', 'PJOK', 'SB']) {
      assert.equal(subjects.get(code)?.status, 'compulsory', code)
    }
    for (const code of ['PAI', 'PAKR', 'PAKT', 'PAH', 'PAB', 'PAKH', 'SSD']) {
      assert.isFalse(subjects.has(code), code)
    }
    assert.isEmpty(list.filter((subject) => subject.religion !== null))

    // MI's own structure sets the JP; SIGRAK-SD brings the general extras.
    assert.equal(subjects.get('BIN')!.jpPerWeek, 7)
    assert.deepInclude(subjects.get('BIG')!, { status: 'optional', takenByDefault: false })
    assert.deepInclude(subjects.get('BJW')!, { status: 'local_content', takenByDefault: false })
    assert.deepEqual(
      subjects.get('SB')!.artTracks.map((track) => [track.artBranch, track.hasTopics]),
      [
        ['music', true],
        ['visual_art', true],
        ['dance', false],
        ['theatre', false],
      ]
    )
  }).timeout(120_000)
})
