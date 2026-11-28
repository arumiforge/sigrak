import { test } from '@japa/runner'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import {
  activateCalendarPackage,
  CalendarImportException,
  importNationalHolidays,
  importRegionCalendar,
  NATIONAL_PACKAGE_CODE,
} from '#calendar/data_files'
import { LayerResolver } from '#layers/resolver/layer_resolver'
import { layerFixtures } from '#tests/layers'
import { JATENG_CODE, JATENG_FILE, calendarOf } from '#tests/calendar'

async function tempCopy(source: string, change: (data: any) => void) {
  const dir = await mkdtemp(join(tmpdir(), 'sigrak-calendar-'))
  const data = JSON.parse(await readFile(source, 'utf8'))
  change(data)
  const path = join(dir, 'file.json')
  await writeFile(path, JSON.stringify(data))
  return { path, cleanup: () => rm(dir, { recursive: true, force: true }) }
}

const holidayPath = () => app.makePath('docs/data/calendar/national-holidays-2026-2027.json')

test.group('Calendar | import of the repository data (D-253, D-254)', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.timeout(60_000)

  test('the SKB file becomes the draft national package; a second run changes nothing', async ({
    assert,
  }) => {
    await layerFixtures()
    const first = await db.transaction((trx) => importNationalHolidays(trx))
    assert.isTrue(first.packageCreated)
    assert.equal(first.created, 30)
    assert.equal(first.status, 'draft')

    const pkg = await db.from('layer_packages').where('code', NATIONAL_PACKAGE_CODE).first()
    assert.equal(pkg.layer, 'national')
    assert.equal(pkg.kind, 'base')
    assert.equal(pkg.status, 'draft')
    assert.equal(pkg.evidence.checked_on, '2026-11-10')
    const items = await db.from('calendar_items').where('package_id', pkg.id)
    const holiday = items.find((row) => row.item_key === 'HOL-2026-08-17-national_holiday')
    assert.equal(holiday.force, 'mandatory')
    assert.equal(holiday.source_ref.regulation, 'SKB 1497/2/5 Tahun 2025')
    const jointLeave = items.find((row) => row.item_key === 'HOL-2027-02-05-joint_leave')
    assert.equal(jointLeave.force, 'example')

    const again = await db.transaction((trx) => importNationalHolidays(trx))
    assert.deepInclude(again, { created: 0, revised: 0, retired: 0, unchanged: 30 })
    const version = await db.from('layer_packages').where('id', pkg.id).select('version').first()
    assert.equal(version.version, 1)
  })

  test('a draft package does not reach schools; activation does (Tim Validasi sign-off)', async ({
    assert,
  }) => {
    const { sdJati } = await layerFixtures()
    await db.transaction((trx) => importNationalHolidays(trx))
    const draft = await calendarOf(sdJati)
    assert.isFalse(draft.ready)
    assert.lengthOf(draft.items, 0)

    await db.transaction((trx) => activateCalendarPackage(trx, NATIONAL_PACKAGE_CODE, null))
    LayerResolver.clearCache()
    const active = await calendarOf(sdJati)
    assert.isTrue(active.ready)
    assert.isTrue(active.items.some((item) => item.itemKey === 'HOL-2026-08-17-national_holiday'))
  })

  test('a changed name becomes a new revision; a dropped day of a covered year is retired', async ({
    assert,
    cleanup,
  }) => {
    await layerFixtures()
    await db.transaction((trx) => importNationalHolidays(trx))
    const file = await tempCopy(holidayPath(), (data) => {
      const days = data.academic_years[0].days
      days[0].name = 'Proklamasi Kemerdekaan RI'
      data.academic_years[0].days = days.filter((day: any) => day.date !== '2027-06-06')
    })
    cleanup(file.cleanup)

    const report = await db.transaction((trx) => importNationalHolidays(trx, { file: file.path }))
    assert.equal(report.revised, 1)
    assert.equal(report.retired, 1)
    const rows = await db
      .from('calendar_items')
      .where('item_key', 'HOL-2026-08-17-national_holiday')
      .orderBy('revision')
    assert.deepEqual(
      rows.map((row) => [row.revision, row.status]),
      [
        [1, 'retired'],
        [2, 'active'],
      ]
    )
    assert.equal(rows[1].supersedes_id, rows[0].id)
    const pkg = await db.from('layer_packages').where('code', NATIONAL_PACKAGE_CODE).first()
    assert.equal(pkg.version, 2)
  })

  test('a file that fails the D-254 check imports nothing', async ({ assert, cleanup }) => {
    await layerFixtures()
    const file = await tempCopy(holidayPath(), (data) => {
      data.check.sources = []
    })
    cleanup(file.cleanup)
    try {
      await db.transaction((trx) => importNationalHolidays(trx, { file: file.path }))
      assert.fail('the import should have been refused')
    } catch (error) {
      assert.instanceOf(error, CalendarImportException)
      assert.deepInclude((error as CalendarImportException).problems, { key: 'no_official_source' })
    }
    const packages = await db.from('layer_packages').where('domain', 'calendar')
    assert.lengthOf(packages, 0)
  })

  test('the Jawa Tengah file becomes an official province package, line all', async ({
    assert,
  }) => {
    await layerFixtures()
    const report = await db.transaction(async (trx) => {
      await importNationalHolidays(trx)
      return importRegionCalendar(trx, { file: JATENG_FILE() })
    })
    assert.equal(report.packageCode, JATENG_CODE)
    assert.equal(report.hidesWritten, 5)
    const pkg = await db
      .from('layer_packages as p')
      .join('regions as r', 'r.id', 'p.region_id')
      .where('p.code', JATENG_CODE)
      .select('p.*', 'r.kemendagri_code')
      .first()
    assert.equal(pkg.layer, 'province')
    assert.equal(pkg.kind, 'official')
    assert.equal(pkg.line, 'all')
    assert.equal(pkg.kemendagri_code, '33')
    assert.equal(pkg.applies_from_school_year, '2026/2027')
    assert.equal(pkg.applies_to_school_year, '2026/2027')
    assert.equal(pkg.evidence.sha256.length, 64)

    const items = await db
      .from('calendar_items')
      .where('package_id', pkg.id)
      .where('status', 'active')
    const kinds = (kind: string) => items.filter((row) => row.kind === kind)
    assert.lengthOf(kinds('setting'), 4)
    assert.lengthOf(
      items.filter((row) => !['setting', 'note'].includes(row.kind)),
      11
    )
    assert.isTrue(kinds('note').length >= 2)
    assert.isTrue(
      items.filter((row) => row.kind !== 'note').every((row) => row.force === 'mandatory')
    )
    assert.isTrue(kinds('note').every((row) => row.force === 'example'))

    const again = await db.transaction((trx) => importRegionCalendar(trx, { file: JATENG_FILE() }))
    assert.equal(again.created + again.revised + again.retired, 0)
  })
})
