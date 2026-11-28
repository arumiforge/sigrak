import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { importCurriculum } from '../../../app/curriculum/import/curriculum_importer.js'
import { PolicyProfileResolver } from '../../../app/curriculum/policy/policy_profile_resolver.js'
import CurriculumVersion from '../../../app/curriculum/models/curriculum_version.js'
import type { FileReport } from '../../../app/curriculum/import/report.js'
import { tempDir, topicFile, writeJson } from './fixtures.js'

const subjectsFile = 'docs/data/curriculum/subjects.json'
const cpGeneralFile = 'docs/data/curriculum/cp-umum-sd-bskap-046-2025.json'

async function count(table: string) {
  const row = await db.from(table).count('* as total').first()
  return Number(row.total)
}

function totalChanges(reports: FileReport[]) {
  return reports.reduce((sum, report) => sum + report.changes, 0)
}

function reportFor(reports: FileReport[], suffix: string) {
  const report = reports.find((candidate) => candidate.file.endsWith(suffix))
  if (!report) throw new Error(`No report for ${suffix}`)
  return report
}

test.group('Curriculum import', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => PolicyProfileResolver.clearCache())

  test('imports the repository data, and a second run changes nothing', async ({ assert }) => {
    const first = await importCurriculum()
    assert.isNull(first.failed)
    assert.lengthOf(first.files, 9)

    const counts = {
      curriculum_versions: await count('curriculum_versions'),
      subjects: await count('subjects'),
      subject_allocations: await count('subject_allocations'),
      learning_outcome_elements: await count('learning_outcome_elements'),
      learning_outcomes: await count('learning_outcomes'),
      topics: await count('topics'),
      learning_objectives: await count('learning_objectives'),
      focus_items: await count('focus_items'),
      focus_item_objectives: await count('focus_item_objectives'),
    }
    assert.deepEqual(counts, {
      curriculum_versions: 7,
      subjects: 22,
      subject_allocations: 372,
      learning_outcome_elements: 53,
      learning_outcomes: 334,
      topics: 956,
      learning_objectives: 2695,
      focus_items: 4069,
      focus_item_objectives: 2048,
    })

    const second = await importCurriculum()
    assert.isNull(second.failed)
    assert.equal(totalChanges(second.files), 0)
    assert.equal(second.profiles!.changes, 0)
    for (const report of second.files) {
      for (const [table, written] of Object.entries(report.tables)) {
        assert.deepInclude(written, { created: 0, updated: 0 }, `${report.file} ${table}`)
      }
      assert.lengthOf(report.missing, 0)
    }
    for (const [table, total] of Object.entries(counts)) {
      assert.equal(await count(table), total, table)
    }
  }).timeout(120_000)

  test('versions start as draft and take their dates from the Profil Jenjang', async ({
    assert,
  }) => {
    await importCurriculum()
    const versions = await CurriculumVersion.query().orderBy('code')
    assert.isTrue(versions.every((version) => version.status === 'draft'))

    const cp = versions.find((version) => version.code === 'CP-UMUM-SD-BSKAP-046-2025')!
    assert.equal(cp.kind, 'cp')
    assert.equal(cp.appliesFromSchoolYear, '2025/2026')
    assert.equal(cp.effectiveOn?.toISODate(), '2025-07-16')

    const topics = versions.find((version) => version.code === 'SIGRAK-SD-2026-R1')!
    assert.equal(topics.appliesFromSchoolYear, '2026/2027')
    assert.isNull(topics.effectiveOn)
    // Both SD topic files are recorded, each with its subjects' curation (D-364).
    assert.sameMembers(Object.keys(topics.meta.files!), [
      'docs/data/curriculum/sigrak-sd-2026-r1-umum.json',
      'docs/data/curriculum/sigrak-sd-2026-r1-agama.json',
    ])
    assert.equal(
      topics.meta.files!['docs/data/curriculum/sigrak-sd-2026-r1-umum.json'].subjects!.PP.curation
        ?.status,
      'converted'
    )
    // No subject is curated yet, so none is active for teachers (D-364).
    assert.deepEqual(topics.curatedSubjectCodes(), [])

    // An import never changes the status of an existing version (D-229).
    await db
      .from('curriculum_versions')
      .where('code', 'SIGRAK-SD-2026-R1')
      .update({ status: 'active' })
    await importCurriculum({ files: ['docs/data/curriculum/sigrak-sd-2026-r1-agama.json'] })
    const again = await CurriculumVersion.findByOrFail('code', 'SIGRAK-SD-2026-R1')
    assert.equal(again.status, 'active')
  }).timeout(120_000)

  test('reports the Seni dan Budaya tracks: Musik and Rupa short, Tari and Teater without topics', async ({
    assert,
  }) => {
    const result = await importCurriculum()
    const report = reportFor(result.files, 'sigrak-sd-2026-r1-umum.json')

    // D-458, D-464: the old Musik/Rupa split is reported per branch track.
    assert.lengthOf(report.mismatches, 24)
    assert.isTrue(report.mismatches.every((finding) => finding.kind === 'semester_jp_short'))
    assert.isTrue(report.mismatches.every((finding) => finding.message.startsWith('SB grade')))
    assert.isTrue(
      report.mismatches.some(
        (finding) =>
          finding.message === 'SB grade 1 music semester 1: topics add up to 27 JP, target 54'
      )
    )

    const withoutTopics = report.notes.filter((note) => note.kind === 'allocation_without_topics')
    assert.lengthOf(withoutTopics, 12)
    assert.isTrue(
      withoutTopics.every((note) => / (dance|theatre): no topics yet/.test(note.message))
    )

    const tracks = await db
      .from('subject_allocations as a')
      .join('subjects as s', 's.id', 'a.subject_id')
      .join('curriculum_versions as v', 'v.id', 'a.curriculum_version_id')
      .where('v.code', 'SIGRAK-SD-2026-R1')
      .where('s.code', 'SB')
      .select('a.grade', 'a.art_branch', 'a.s1_jp', 'a.s2_jp')
    assert.lengthOf(tracks, 24)
    assert.sameMembers(
      [...new Set(tracks.map((row) => row.art_branch))],
      ['music', 'visual_art', 'dance', 'theatre']
    )
    const grade6Dance = tracks.find((row) => row.grade === 6 && row.art_branch === 'dance')
    assert.deepEqual({ s1: grade6Dance.s1_jp, s2: grade6Dance.s2_jp }, { s1: 54, s2: 42 })

    // Topics carry their branch as a column (D-458).
    const branches = await db
      .from('topics')
      .where('code', 'like', 'SIGRAK-SD-2026-R1-SR-%')
      .distinct('art_branch')
    assert.deepEqual(
      branches.map((row) => row.art_branch),
      ['visual_art']
    )
  }).timeout(120_000)

  test('Tata Boga JP is set by the school: stored as a suggestion, never checked', async ({
    assert,
  }) => {
    const result = await importCurriculum()
    const report = reportFor(result.files, 'sigrak-sd-2026-r1-umum.json')
    assert.isFalse(report.mismatches.some((finding) => finding.message.startsWith('KTB')))

    const rows = await db
      .from('subject_allocations as a')
      .join('subjects as s', 's.id', 'a.subject_id')
      .where('s.code', 'KTB')
      .select('a.grade', 'a.status', 'a.jp_target_set_by')
      .orderBy('a.grade')
    assert.deepEqual(
      rows.map((row) => [row.grade, row.status, row.jp_target_set_by]),
      [
        [3, 'optional', 'school'],
        [4, 'optional', 'school'],
        [5, 'optional', 'school'],
        [6, 'optional', 'school'],
      ]
    )
  }).timeout(120_000)

  test('structure rows: SD religions share one row, yearly JP split into semesters', async ({
    assert,
  }) => {
    await importCurriculum({
      files: [
        subjectsFile,
        'docs/data/regulations/curriculum-structure-permendikdasmen-13-2025.json',
      ],
    })
    const rows = await db
      .from('subject_allocations as a')
      .join('subjects as s', 's.id', 'a.subject_id')
      .where('a.grade', 6)
      .where('a.learning_type', 'intracurricular')
      .whereNotNull('s.religion')
      .select(
        's.code',
        'a.jp_per_year',
        'a.jp_per_week',
        'a.s1_jp',
        'a.s2_jp',
        'a.s2_effective_weeks'
      )
    assert.lengthOf(rows, 6)
    for (const row of rows) {
      assert.deepEqual(
        [row.jp_per_year, row.jp_per_week, row.s1_jp, row.s2_jp, row.s2_effective_weeks],
        [96, 3, 54, 42, 14]
      )
    }
    const version = await CurriculumVersion.findByOrFail(
      'code',
      'STRUKTUR-SD-PERMENDIKDASMEN-13-2025'
    )
    const [meta] = Object.values(version.meta.files!)
    const localContent = meta.local_content as Record<string, object>
    assert.deepInclude(localContent['6'], { max_jp_per_year: 64 })
  }).timeout(60_000)

  test('a changed value updates only its row; rows gone from the file are kept and reported', async ({
    assert,
  }) => {
    await importCurriculum({ files: [subjectsFile, cpGeneralFile] })
    const directory = await tempDir('curriculum')
    const data = topicFile()
    const path = await writeJson(directory, 'topics.json', data)

    const first = await importCurriculum({ files: [path] })
    assert.isNull(first.failed)
    assert.lengthOf(first.files[0].mismatches, 0)
    assert.deepEqual(first.files[0].tables.topics, { created: 3, updated: 0, unchanged: 0 })
    assert.deepEqual(first.files[0].tables.focus_item_objectives, {
      created: 6,
      updated: 0,
      unchanged: 0,
    })

    data.subjects[0].topics[0].title = 'Judul baru'
    data.subjects[0].topics.splice(2, 1)
    await writeJson(directory, 'topics.json', data)
    const second = await importCurriculum({ files: [path] })
    const report = second.files[0]
    assert.deepEqual(report.tables.topics, { created: 0, updated: 1, unchanged: 1 })
    assert.deepEqual(report.tables.learning_objectives, { created: 0, updated: 0, unchanged: 4 })
    assert.deepEqual(
      report.missing.map((finding) => finding.code),
      ['SIGRAK-UJI-2026-R1-PP-K1-03']
    )
    // The removed topic is kept (D-229), and semester 2 is now short.
    assert.equal(await count('topics'), 3)
    assert.isTrue(report.mismatches.some((finding) => finding.kind === 'semester_jp_short'))
    const changed = await db.from('topics').where('code', 'SIGRAK-UJI-2026-R1-PP-K1-01').first()
    assert.equal(changed.title, 'Judul baru')
  })

  test('reports data mismatches without stopping; --strict writes nothing from that file', async ({
    assert,
  }) => {
    await importCurriculum({ files: [subjectsFile, cpGeneralFile] })
    const directory = await tempDir('curriculum')
    const data = topicFile()
    const broken = data.subjects[0].topics[0]
    broken.phase = 'B'
    broken.element_codes = ['PP-E9']
    broken.week_end = 30
    broken.focus_items[0].objective_codes = ['SIGRAK-UJI-2026-R1-PP-K1-02-TP01']
    broken.focus_items[1].estimated_jp = 5
    const path = await writeJson(directory, 'topics.json', data)

    const strict = await importCurriculum({ files: [path], strict: true })
    assert.isNotNull(strict.failed)
    assert.match(strict.failed!.error, /--strict; nothing written from this file/)
    assert.equal(await count('topics'), 0)
    assert.isNull(await db.from('curriculum_versions').where('code', 'SIGRAK-UJI-2026-R1').first())

    const lenient = await importCurriculum({ files: [path] })
    assert.isNull(lenient.failed)
    assert.sameMembers(
      [...new Set(lenient.files[0].mismatches.map((finding) => finding.kind))],
      [
        'phase_grade',
        'topic_element_unknown',
        'topic_past_semester',
        'weekly_distribution_weeks',
        'fokus_link_outside_topic',
        'fokus_jp',
      ]
    )
    assert.equal(await count('topics'), 3)
  })

  test('refuses the legacy format and the crosswalk, and an unknown subject writes nothing', async ({
    assert,
  }) => {
    const directory = await tempDir('curriculum')
    const legacy = await writeJson(directory, 'legacy.json', [{ Legacy_ID: 'X-1', materi: 'Lama' }])
    const legacyResult = await importCurriculum({ files: [legacy] })
    assert.match(legacyResult.failed!.error, /legacy app format is refused \(D-363\)/)

    const crosswalk = await importCurriculum({
      files: ['docs/data/curriculum/crosswalk-legacy-2026.json'],
    })
    assert.match(crosswalk.failed!.error, /never imported \(D-365\)/)

    await importCurriculum({ files: [subjectsFile] })
    const data = topicFile()
    data.subjects[0].code = 'XYZ'
    const unknown = await writeJson(directory, 'unknown.json', data)
    const result = await importCurriculum({ files: [unknown] })
    assert.match(result.failed!.error, /unknown subject "XYZ"/)
    assert.isNull(await db.from('curriculum_versions').where('code', 'SIGRAK-UJI-2026-R1').first())
  })
})
