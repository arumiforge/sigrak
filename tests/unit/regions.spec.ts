import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { effectiveOn, nextSchoolYearStart, todayInJakarta } from '#regions/effective_dates'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseRegencyName, regionNameKey, type RegionSeed } from '#regions/region_list'
import { jawaTengahRegions, loadRegionList, RegionFileError } from '#regions/region_files'

test.group('Regions | effective dates', () => {
  test('the next school year starts on the coming 1 July', ({ assert }) => {
    assert.equal(nextSchoolYearStart('2026-11-28'), '2027-07-01')
    assert.equal(nextSchoolYearStart('2027-06-30'), '2027-07-01')
    assert.equal(nextSchoolYearStart('2027-07-01'), '2028-07-01')
    assert.equal(nextSchoolYearStart('2027-01-01'), '2027-07-01')
  })

  test('next day crosses months and years', ({ assert }) => {
    assert.equal(effectiveOn('next_day', '2026-12-31'), '2027-01-01')
    assert.equal(effectiveOn('next_day', '2028-02-28'), '2028-02-29')
    assert.equal(effectiveOn('next_school_year', '2026-12-31'), '2027-07-01')
  })

  test('today is the WIB date', ({ assert }) => {
    // 18:30 UTC is already the next day in Jakarta (UTC+7).
    assert.equal(todayInJakarta(DateTime.fromISO('2026-11-28T18:30:00Z')), '2026-11-29')
    assert.equal(todayInJakarta(DateTime.fromISO('2026-11-28T16:30:00Z')), '2026-11-28')
  })
})

test.group('Regions | names and list', () => {
  test('name keys ignore case, spaces and punctuation', ({ assert }) => {
    assert.equal(regionNameKey('Gunung Wungkal'), regionNameKey('Gunungwungkal'))
    assert.equal(regionNameKey('Pakis Aji'), regionNameKey('PAKISAJI'))
    assert.notEqual(regionNameKey('Jati'), regionNameKey('Jaken'))
  })

  test('regency labels split into kind and name', ({ assert }) => {
    assert.deepEqual(parseRegencyName('Kabupaten Kudus'), { kind: 'kabupaten', name: 'Kudus' })
    assert.deepEqual(parseRegencyName('Kab. Pati'), { kind: 'kabupaten', name: 'Pati' })
    assert.deepEqual(parseRegencyName('Kota Semarang'), { kind: 'kota', name: 'Semarang' })
    assert.deepEqual(parseRegencyName('Jepara'), { kind: 'kabupaten', name: 'Jepara' })
  })

  test('the Jawa Tengah list is well formed', ({ assert }) => {
    const jawaTengah = jawaTengahRegions()
    const codes = new Set<string>()
    const visit = (node: RegionSeed, parent: string | null) => {
      assert.isFalse(codes.has(node.kemendagriCode), `${node.kemendagriCode} twice`)
      codes.add(node.kemendagriCode)
      if (parent) assert.isTrue(node.kemendagriCode.startsWith(`${parent}.`), node.kemendagriCode)
      const keys = (node.children ?? []).map((child) => regionNameKey(child.name))
      assert.equal(new Set(keys).size, keys.length, `${node.name}: two children share a name`)
      for (const child of node.children ?? []) visit(child, node.kemendagriCode)
    }
    visit(jawaTengah, null)
    assert.equal(codes.size, 50)
    assert.deepEqual(
      jawaTengah.children!.map((regency) => [regency.name, regency.children!.length]),
      [
        ['Pati', 21],
        ['Kudus', 9],
        ['Jepara', 16],
      ]
    )
  })
})

test.group('Regions | list files in docs/data/regions', () => {
  function writeList(regions: unknown, dataset = 'region_list') {
    const path = join(mkdtempSync(join(tmpdir(), 'regions-')), 'list.json')
    writeFileSync(path, JSON.stringify({ dataset, status: 'draft', regions }))
    return path
  }

  test('reads the JSON file with codes, Dapodik codes and kinds (D-469)', ({ assert }) => {
    const root = jawaTengahRegions()
    assert.include(root, { kemendagriCode: '33', dapodikCode: '030000', name: 'Jawa Tengah' })
    const kudus = root.children!.find((regency) => regency.kemendagriCode === '33.19')!
    assert.include(kudus, { name: 'Kudus', dapodikCode: '031900', regencyKind: 'kabupaten' })
    assert.deepInclude(kudus.children!, {
      kemendagriCode: '33.19.02',
      dapodikCode: null,
      name: 'Kota Kudus',
    })
  })

  test('refuses a file that is not a well-formed region list', ({ assert }) => {
    const province = { kemendagri_code: '33', name: 'Jawa Tengah' }
    assert.throws(() => loadRegionList(writeList(province, 'region_calendar')), RegionFileError)
    for (const regions of [
      { ...province, kemendagri_code: '3' },
      { ...province, children: [{ kemendagri_code: '34.01', name: 'Lain' }] },
      { ...province, children: [{ kemendagri_code: '33.01', name: '' }] },
      { ...province, dapodik_code: '0300' },
      {
        ...province,
        children: [{ kemendagri_code: '33.01', name: 'A', regency_kind: 'kota_adm' }],
      },
    ]) {
      assert.throws(() => loadRegionList(writeList(regions)), RegionFileError)
    }
  })
})
