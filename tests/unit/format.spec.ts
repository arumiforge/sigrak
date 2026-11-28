import { test } from '@japa/runner'
import i18nManager from '@adonisjs/i18n/services/main'
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatShortDate,
  formatTime,
  parseNumber,
  parseShortDate,
  toJakartaDate,
} from '#services/i18n/format'
import { levelTermParams } from '#services/i18n/level_terms'

test.group('Indonesian formats', () => {
  test('numbers use dots for thousands and a comma for decimals', ({ assert }) => {
    assert.equal(formatNumber(1234567.89), '1.234.567,89')
    assert.equal(formatNumber(1234567), '1.234.567')
    assert.equal(formatNumber(0.5), '0,5')
    assert.equal(formatNumber(2, { decimals: 2 }), '2,00')
    assert.equal(formatNumber(-1500), '-1.500')
  })

  test('money is Rp with no space and no decimals', ({ assert }) => {
    assert.equal(formatCurrency(1234567), 'Rp1.234.567')
    assert.equal(formatCurrency(0), 'Rp0')
    assert.equal(formatCurrency(-5000), '-Rp5.000')
    assert.equal(formatCurrency(1500.5, { decimals: 2 }), 'Rp1.500,50')
  })

  test('dates are d/m/Y in WIB', ({ assert }) => {
    assert.equal(formatShortDate('2026-11-25'), '25/11/2026')
    assert.equal(formatShortDate('2027-01-05'), '05/01/2027')
    // 18:30 UTC is already the next day in Jakarta (UTC+7).
    assert.equal(formatShortDate(new Date('2026-11-25T18:30:00Z')), '26/11/2026')
    assert.equal(formatShortDate('2026-11-25T16:59:00Z'), '25/11/2026')
    assert.equal(toJakartaDate(new Date('2026-12-31T17:00:00Z')), '2027-01-01')
  })

  test('times use a dot and WIB', ({ assert }) => {
    assert.equal(formatTime(new Date('2026-11-25T07:05:00Z')), '14.05')
    assert.equal(formatTime(new Date('2026-11-25T17:00:00Z')), '00.00')
    assert.equal(formatDateTime(new Date('2026-11-25T07:05:00Z')), '25/11/2026 14.05')
  })

  test('an invalid date is refused', ({ assert }) => {
    assert.throws(() => formatShortDate('bukan tanggal'))
  })

  test('Indonesian numbers and dates read back (D-150)', ({ assert }) => {
    assert.equal(parseNumber('1.234.567,89'), 1234567.89)
    assert.equal(parseNumber('12,5'), 12.5)
    assert.equal(parseNumber(' Rp 5.000 '), 5000)
    assert.equal(parseNumber('Rp1.234.567'), 1234567)
    assert.equal(parseNumber('-1.500'), -1500)
    assert.equal(parseNumber('750'), 750)
    assert.isNull(parseNumber('1.23'))
    assert.isNull(parseNumber('satu'))
    assert.isNull(parseNumber(''))

    assert.equal(parseShortDate('25/11/2026'), '2026-11-25')
    assert.equal(parseShortDate('5/1/2027'), '2027-01-05')
    assert.isNull(parseShortDate('31/02/2026'))
    assert.isNull(parseShortDate('2026-11-25'))
  })

  test('formatting and reading back agree', ({ assert }) => {
    for (const value of [0, 7, 1234.5, 1234567.89, -42.25]) {
      assert.equal(parseNumber(formatNumber(value)), value)
    }
    assert.equal(parseNumber(formatCurrency(2500000)), 2500000)
    assert.equal(parseShortDate(formatShortDate('2026-07-13')), '2026-07-13')
  })
})

test.group('Level terms (D-383)', () => {
  const t = (key: string) => i18nManager.locale('id').t(key)

  test('SD says guru kelas, MI says wali kelas', ({ assert }) => {
    assert.deepEqual(levelTermParams(t, 'sd'), {
      homeroom_teacher: 'Guru kelas',
      homeroom_teacher_lower: 'guru kelas',
    })
    assert.deepEqual(levelTermParams(t, 'mi'), {
      homeroom_teacher: 'Wali kelas',
      homeroom_teacher_lower: 'wali kelas',
    })
  })

  test('a level profile gives the term directly', ({ assert }) => {
    assert.deepEqual(levelTermParams(t, { homeroomTeacherTerm: 'Wali kelas' }), {
      homeroom_teacher: 'Wali kelas',
      homeroom_teacher_lower: 'wali kelas',
    })
  })

  test('the terms fill a message as parameters', ({ assert }) => {
    const i18n = i18nManager.locale('id')
    const message = i18n.formatRawMessage('Hubungi {homeroom_teacher_lower} Anda.', {
      ...levelTermParams(t, 'mi'),
    })
    assert.equal(message, 'Hubungi wali kelas Anda.')
  })
})
