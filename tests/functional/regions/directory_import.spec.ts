import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import { DirectoryImportError, importSchoolDirectory } from '#regions/school_directory_importer'
import {
  createSchoolIn,
  readDirectoryFile,
  region,
  seedJawaTengah,
  smallKudusFile,
  writeDirectoryFile,
} from '#tests/regions'

const regionId = async (code: string) => {
  const row = await region(code)
  return row.id
}
const queued = async (file: Parameters<typeof writeDirectoryFile>[0]) => {
  const result = await importSchoolDirectory(await writeDirectoryFile(file))
  return result.reviewsQueued
}

const reviews = () =>
  db.from('region_change_reviews').orderBy('id').select('school_id', 'status', 'to_district_id')

test.group('Regions | directory import', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => seedJawaTengah())

  test('the repository files load fully and match every kecamatan', async ({ assert }) => {
    const totals: Record<string, number> = {}
    for (const name of ['kudus', 'jepara', 'pati'] as const) {
      const result = await importSchoolDirectory(app.makePath(`docs/data/schools/${name}.json`))
      totals[name] = result.inserted
      assert.deepEqual(result.unmatchedDistricts, [], name)
      assert.equal(result.updated + result.unchanged + result.removed + result.reviewsQueued, 0)
    }
    assert.deepEqual(totals, { kudus: 570, jepara: 772, pati: 825 })

    const unmatched = await db
      .from('school_directory_entries')
      .whereNull('district_id')
      .orWhereNull('region_id')
      .count('* as total')
    assert.equal(Number(unmatched[0].total), 0)

    // "Gunung Wungkal" on the reference site is Kecamatan Gunungwungkal.
    const gunungwungkal = await region('33.18.17')
    const entry = await db
      .from('school_directory_entries')
      .where('district_name', 'Gunung Wungkal')
      .first()
    assert.equal(entry.district_id, gunungwungkal.id)
  })

  test('running the same file again changes nothing', async ({ assert }) => {
    const path = app.makePath('docs/data/schools/kudus.json')
    await importSchoolDirectory(path)
    const before = await db.from('school_directory_entries').max('updated_at as at').first()

    const again = await importSchoolDirectory(path)
    assert.include(again, { inserted: 0, updated: 0, unchanged: 570, removed: 0, reviewsQueued: 0 })
    const after = await db.from('school_directory_entries').max('updated_at as at').first()
    assert.deepEqual(after.at, before.at)
  })

  test('a later fetch updates rows and marks missing schools removed', async ({ assert }) => {
    const file = smallKudusFile()
    await importSchoolDirectory(await writeDirectoryFile(file))

    file.fetched_on = '2026-12-01'
    file.schools[0].name = 'SD Uji Satu Baru'
    const dropped = file.schools.pop()!
    const result = await importSchoolDirectory(await writeDirectoryFile(file))
    assert.include(result, { inserted: 0, updated: 2, unchanged: 0, removed: 1 })

    const renamed = await db.from('school_directory_entries').where('npsn', '90000001').first()
    assert.equal(renamed.name, 'SD Uji Satu Baru')
    assert.equal(renamed.fetched_on, '2026-12-01')
    const gone = await db.from('school_directory_entries').where('npsn', dropped.npsn).first()
    assert.isNotNull(gone.removed_at)

    // Listed again: back in the directory.
    file.schools.push(dropped)
    const back = await importSchoolDirectory(await writeDirectoryFile(file))
    assert.include(back, { updated: 1, removed: 0 })
    const restored = await db.from('school_directory_entries').where('npsn', dropped.npsn).first()
    assert.isNull(restored.removed_at)
  })

  test('an unknown kecamatan keeps its name with no region row', async ({ assert }) => {
    const file = smallKudusFile()
    file.schools[2].district = 'Kecamatan Antah'
    const result = await importSchoolDirectory(await writeDirectoryFile(file))
    assert.deepEqual(result.unmatchedDistricts, ['Kecamatan Antah'])
    const entry = await db.from('school_directory_entries').where('npsn', '90000003').first()
    assert.isNull(entry.district_id)
    assert.equal(entry.district_name, 'Kecamatan Antah')
    assert.equal(entry.region_id, await regionId('33.19'))
  })

  test('bad files are refused before anything is written', async ({ assert }) => {
    const unknownRegency = smallKudusFile()
    unknownRegency.source = 'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikdas/031100/2'
    unknownRegency.regency = 'Kabupaten Boyolali'
    await assert.rejects(
      async () => importSchoolDirectory(await writeDirectoryFile(unknownRegency)),
      /Kabupaten Boyolali .* is not in the region list/
    )

    const duplicate = smallKudusFile()
    duplicate.schools[1].npsn = duplicate.schools[0].npsn
    await assert.rejects(
      async () => importSchoolDirectory(await writeDirectoryFile(duplicate)),
      /NPSN 90000001 twice/
    )

    const malformed = smallKudusFile()
    malformed.schools[0].npsn = '123'
    const error = await importSchoolDirectory(await writeDirectoryFile(malformed)).catch(
      (e: unknown) => e
    )
    assert.instanceOf(error, DirectoryImportError)
    assert.match((error as Error).message, /schools\.0\.npsn/)

    const count = await db.from('school_directory_entries').count('* as total')
    assert.equal(Number(count[0].total), 0)
  })

  test('the regency is found by name when the source has no code', async ({ assert }) => {
    const file = await readDirectoryFile('jepara')
    file.source = 'https://example.org/jepara'
    file.schools = file.schools.slice(0, 5)
    const result = await importSchoolDirectory(await writeDirectoryFile(file))
    assert.equal(result.inserted, 5)
    const entry = await db.from('school_directory_entries').first()
    assert.equal(entry.region_id, await regionId('33.20'))
  })

  test('a region difference for a SIGRAK school is queued, never applied', async ({ assert }) => {
    // The school is in Jati; the directory puts 90000002 in Bae.
    const school = await createSchoolIn('MI Uji Dua', '90000002', '33.19.03')
    const unchanged = await createSchoolIn('SD Uji Satu', '90000001', '33.19.03')
    const file = smallKudusFile()

    const first = await importSchoolDirectory(await writeDirectoryFile(file))
    assert.equal(first.reviewsQueued, 1)
    const bae = await region('33.19.07')
    assert.deepEqual(await reviews(), [
      { school_id: school.id, status: 'pending', to_district_id: bae.id },
    ])
    await school.refresh()
    assert.equal(school.district, 'Jati')

    // The same difference again: still one review.
    assert.equal(await queued(file), 0)

    // The directory moves the school on to Dawe: the open review is replaced.
    file.schools[1].district = 'Dawe'
    assert.equal(await queued(file), 1)
    const dawe = await region('33.19.09')
    assert.deepEqual(await reviews(), [
      { school_id: school.id, status: 'superseded', to_district_id: bae.id },
      { school_id: school.id, status: 'pending', to_district_id: dawe.id },
    ])

    // Back to the school's own kecamatan: nothing is left to decide.
    file.schools[1].district = 'Jati'
    assert.equal(await queued(file), 0)
    const rows = await reviews()
    const statuses = rows.map((row) => row.status)
    assert.deepEqual(statuses, ['superseded', 'superseded'])
    assert.notInclude(
      rows.map((row) => row.school_id),
      unchanged.id
    )
  })
})
