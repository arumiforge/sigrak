import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { effectiveOn, nextSchoolYearStart, todayInJakarta } from '#regions/effective_dates'
import { parseRegencyName, regionNameKey } from '#regions/region_list'
import { jawaTengah } from '#regions/data/jawa_tengah'

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
    const codes = new Set<string>()
    const visit = (node: typeof jawaTengah, parent: string | null) => {
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
