import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { readFileSync } from 'node:fs'
import { ConflictChecker } from '#calendar/conflict_checker'
import {
  checkHolidayFile,
  checkRegionFile,
  type HolidayFile,
  type RegionFile,
} from '#calendar/data_files'
import { effectiveDays } from '#calendar/effective_days'
import { frameOf } from '#calendar/frame'
import { calendarMatchKey, eventKey, holidayKey } from '#calendar/keys'
import type { ResolvedItem } from '#layers/resolver/resolve_core'
import type { CalendarValue } from '#calendar/types'

const holidayFile = () =>
  JSON.parse(
    readFileSync(app.makePath('docs/data/calendar/national-holidays-2026-2027.json'), 'utf8')
  ) as HolidayFile
const regionFile = () =>
  JSON.parse(
    readFileSync(app.makePath('docs/data/calendar/region-jawa-tengah-2026-2027.json'), 'utf8')
  ) as RegionFile

function item(
  key: string,
  value: Partial<CalendarValue> & Pick<CalendarValue, 'kind'>,
  layer: 'national' | 'province' | 'school' = 'national'
): ResolvedItem<CalendarValue> {
  return {
    itemKey: key,
    matchKey: key,
    shape: value.kind === 'setting' ? 'setting' : 'list',
    force: 'mandatory',
    groupKey: null,
    revision: 1,
    value: {
      examType: null,
      title: key,
      startsOn: null,
      endsOn: null,
      classId: null,
      settingValue: null,
      ...value,
    },
    source: {
      layer,
      regionName: null,
      regionKind: null,
      line: 'all',
      packageCode: layer,
      packageName: layer,
      packageKind: layer === 'national' ? 'base' : layer === 'school' ? 'school' : 'official',
      origin: layer === 'school' ? 'school' : 'official',
      sourceRef: null,
      evidence: null,
    },
  }
}

const frame = frameOf(
  [
    item('FRAME-starts_on', { kind: 'setting', settingValue: '2026-07-13' }, 'province'),
    item(
      'FRAME-even_semester_starts_on',
      { kind: 'setting', settingValue: '2027-01-02' },
      'province'
    ),
    item('FRAME-ends_on', { kind: 'setting', settingValue: '2027-06-19' }, 'province'),
    item('FRAME-school_days_per_week', { kind: 'setting', settingValue: '6' }, 'province'),
  ],
  null,
  '2026/2027'
)

test.group('Calendar | D-254 check of the repository data', () => {
  test('the SKB file passes: dated check, official sources, every decree backed', ({ assert }) => {
    const check = checkHolidayFile(holidayFile())
    assert.isTrue(check.ok, JSON.stringify(check.problems))
    assert.equal(check.summary.checkedOn, '2026-11-10')
    assert.isAtLeast(check.summary.officialSources, 2)
    assert.sameMembers(check.summary.decrees, [
      'SKB 1497/2/5 Tahun 2025',
      'SKB 1205/3/2 Tahun 2026',
    ])
    assert.equal(check.summary.days, 30)
  })

  test('a file without a dated check or official sources is refused', ({ assert }) => {
    const data = holidayFile()
    delete data.check!.checked_on
    data.check!.sources = data.check!.sources!.filter((source) => !source.url?.includes('go.id'))
    const keys = checkHolidayFile(data).problems.map((problem) => problem.key)
    assert.includeMembers(keys, ['check_missing', 'no_official_source'])
  })

  test('a decree no official source names, a day twice, a day outside its year', ({ assert }) => {
    const data = holidayFile()
    const days = data.academic_years![0].days
    days.push({ ...days[0] })
    days.push({ ...days[1], date: '2027-07-05' })
    days[2] = { ...days[2], decree: 'SKB 9999/1/1 Tahun 2024' }
    const problems = checkHolidayFile(data).problems
    assert.deepInclude(problems, { key: 'day_twice', values: { date: days[0].date } })
    assert.deepInclude(problems, {
      key: 'day_date',
      values: { date: '2027-07-05', year: '2026/2027' },
    })
    assert.deepInclude(problems, {
      key: 'decree_unbacked',
      values: { decree: 'SKB 9999/1/1 Tahun 2024' },
    })
  })

  test('the Jawa Tengah file passes; a broken frame or missing evidence does not', ({ assert }) => {
    assert.isTrue(checkRegionFile(regionFile()).ok)
    const broken = regionFile()
    broken.even_semester_starts_on = '2026-06-01'
    delete broken.source!.sha256
    const keys = checkRegionFile(broken).problems.map((problem) => problem.key)
    assert.includeMembers(keys, ['frame', 'evidence'])
  })
})

test.group('Calendar | keys, frame, effective days, conflict checker', () => {
  test('keys stay stable and two events of one day stay two items', ({ assert }) => {
    assert.equal(holidayKey('2027-02-05', 'joint_leave'), 'HOL-2027-02-05-joint_leave')
    assert.equal(
      eventKey('2026-11-10', 'Upacara Hari Pahlawan'),
      eventKey('2026-11-10', 'upacara hari  pahlawan')
    )
    const base = {
      itemKey: 'x',
      kind: 'school_event',
      startsOn: '2026-11-10',
      endsOn: '2026-11-10',
    }
    assert.notEqual(
      calendarMatchKey({ ...base, title: 'Rapat guru' }),
      calendarMatchKey({ ...base, title: 'Pentas seni' })
    )
    assert.notEqual(
      calendarMatchKey({ ...base, title: 'Rapat guru', classId: 1 }),
      calendarMatchKey({ ...base, title: 'Rapat guru', classId: null })
    )
    assert.equal(calendarMatchKey({ ...base, kind: 'setting', title: 'x', startsOn: null }), 'x')
  })

  test('the nearest frame setting wins; academic year and default fill the gaps', ({ assert }) => {
    assert.equal(frame.source, 'layer')
    assert.equal(frame.schoolDaysPerWeek, 6)
    const fallback = frameOf(
      [],
      { startsOn: '2026-07-15', evenSemesterStartsOn: '2027-01-04', endsOn: '2027-06-26' },
      '2026/2027'
    )
    assert.equal(fallback.source, 'academic_year')
    assert.equal(fallback.startsOn, '2026-07-15')
    const differs = frameOf(
      [item('FRAME-starts_on', { kind: 'setting', settingValue: '2026-07-13' }, 'province')],
      { startsOn: '2026-07-15', evenSemesterStartsOn: '2027-01-04', endsOn: '2027-06-26' },
      '2026/2027'
    )
    assert.isTrue(differs.academicYearDiffers)
  })

  test('each non-effective day counts once: holiday before assessment before activity', ({
    assert,
  }) => {
    const items = [
      item('A', { kind: 'national_holiday', startsOn: '2026-08-17', endsOn: '2026-08-17' }),
      item(
        'B',
        { kind: 'exam', examType: 'sts', startsOn: '2026-08-17', endsOn: '2026-08-18' },
        'school'
      ),
      item('C', { kind: 'school_event', startsOn: '2026-08-18', endsOn: '2026-08-19' }, 'school'),
      item('N', { kind: 'note', startsOn: '2026-08-20', endsOn: '2026-08-20' }, 'province'),
    ]
    const august = effectiveDays({ frame, items, classId: null }).rows.find(
      (row) => row.month === '2026-08'
    )!
    assert.equal(august.holidays, 1)
    assert.equal(august.assessments, 1)
    assert.equal(august.activities, 1)
    // August 2026 has 26 Monday–Saturday days; notes never count.
    assert.equal(august.schoolDays, 26)
    assert.equal(august.effectiveDays, 23)
  })

  test('a 5-day week skips Saturdays', ({ assert }) => {
    const fiveDays = { ...frame, schoolDaysPerWeek: 5 as const }
    const result = effectiveDays({ frame: fiveDays, items: [], classId: null })
    assert.equal(result.daysPerWeek, 5)
    const august = result.rows.find((row) => row.month === '2026-08')!
    assert.equal(august.schoolDays, 21)
  })

  test('STS or SAS on a national holiday or joint leave is refused; other exams are not', ({
    assert,
  }) => {
    const items = [
      item('HOL', {
        kind: 'national_holiday',
        title: 'Proklamasi Kemerdekaan',
        startsOn: '2026-08-17',
        endsOn: '2026-08-17',
      }),
      item('CB', {
        kind: 'joint_leave',
        title: 'Cuti bersama',
        startsOn: '2027-03-12',
        endsOn: '2027-03-12',
      }),
    ]
    const sts = ConflictChecker.checkEvent(
      {
        kind: 'exam',
        examType: 'sts',
        startsOn: '2026-08-15',
        endsOn: '2026-08-19',
        classId: null,
      },
      { frame, items }
    )
    assert.deepEqual(sts.errors, [
      {
        key: 'calendar.errors.exam_on_holiday',
        values: { date: '17/08/2026', name: 'Proklamasi Kemerdekaan' },
      },
    ])
    const sas = ConflictChecker.checkEvent(
      {
        kind: 'exam',
        examType: 'sas',
        startsOn: '2027-03-12',
        endsOn: '2027-03-12',
        classId: null,
      },
      { frame, items }
    )
    assert.lengthOf(sas.errors, 1)
    const other = ConflictChecker.checkEvent(
      {
        kind: 'exam',
        examType: 'other',
        startsOn: '2026-08-17',
        endsOn: '2026-08-17',
        classId: null,
      },
      { frame, items }
    )
    assert.lengthOf(other.errors, 0)
  })

  test('outside the school year is refused; a Sunday is only a warning', ({ assert }) => {
    const outside = ConflictChecker.checkEvent(
      {
        kind: 'school_event',
        examType: null,
        startsOn: '2026-07-06',
        endsOn: '2026-07-06',
        classId: null,
      },
      { frame, items: [] }
    )
    assert.equal(outside.errors[0].key, 'calendar.errors.outside_year')
    const sunday = ConflictChecker.checkEvent(
      {
        kind: 'school_event',
        examType: null,
        startsOn: '2026-08-16',
        endsOn: '2026-08-16',
        classId: null,
      },
      { frame, items: [] }
    )
    assert.lengthOf(sunday.errors, 0)
    assert.deepEqual(sunday.warnings, [
      { key: 'calendar.warnings.non_school_day', values: { date: '16/08/2026', day: 'Minggu' } },
    ])
    const holiday = ConflictChecker.checkEvent(
      {
        kind: 'holiday',
        examType: null,
        startsOn: '2026-08-16',
        endsOn: '2026-08-16',
        classId: null,
      },
      { frame, items: [] }
    )
    assert.lengthOf(holiday.warnings, 0)
  })
})
