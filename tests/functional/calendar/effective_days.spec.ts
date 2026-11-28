import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { effectiveDaysOf } from '#calendar/school_calendar'
import { holidayKey } from '#calendar/keys'
import { SchoolLayer } from '#layers/school_layer'
import { asSchool, createMember } from '#tests/tenancy'
import {
  YEAR,
  calendarFixtures,
  calendarOf,
  createClassIn,
  createJatengYear,
} from '#tests/calendar'

/**
 * D-323 acceptance: with the Jawa Tengah kaldik (6-day week) and the
 * checked SKB list, an SD/MI has 254 effective days, 134 in semester 1
 * and 120 in semester 2 (Lampiran XIII). R1-07 resolver case 5 checks
 * the five joint-leave hides; here the hides feed the counts.
 */
test.group('Calendar | effective days (D-259, D-323)', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.timeout(60_000)

  test('every Jawa Tengah school gets 254 / 134 / 120, SD and MI alike', async ({ assert }) => {
    const { sdJati, miJati, sdDawe, sdJepara } = await calendarFixtures()

    for (const school of [sdJati, miJati, sdDawe, sdJepara]) {
      const view = await calendarOf(school)
      const days = effectiveDaysOf(view, null)
      assert.equal(days.daysPerWeek, 6, school.name)
      assert.equal(days.total.effectiveDays, 254, school.name)
      assert.equal(days.semesters[0].effectiveDays, 134, school.name)
      assert.equal(days.semesters[1].effectiveDays, 120, school.name)
      assert.equal(view.frame.startsOn, '2026-07-13')
      assert.equal(view.frame.evenSemesterStartsOn, '2027-01-02')
      assert.equal(view.frame.endsOn, '2027-06-19')
      assert.equal(view.frame.source, 'layer')
      // The five joint-leave days the kaldik keeps open are hidden by the province.
      assert.lengthOf(
        view.hidden.filter((item) => item.hiddenBy.layer === 'province'),
        5,
        school.name
      )
    }
  })

  test('the month table follows Lampiran XIII except the documented May/June shift', async ({
    assert,
  }) => {
    const { sdJati } = await calendarFixtures()
    const days = effectiveDaysOf(await calendarOf(sdJati), null)
    const byMonth = Object.fromEntries(
      days.rows.map((row) => [`${row.semester}|${row.month}`, row])
    )

    assert.equal(byMonth['2|2027-05'].effectiveDays, 22)
    assert.equal(byMonth['2|2027-06'].effectiveDays, 15)
    // Semester 1 ends on 1 January 2027 (a national holiday and part of the break).
    assert.equal(byMonth['1|2027-01'].effectiveDays, 0)
    assert.equal(byMonth['2|2027-01'].effectiveDays, 24)
    const sum = days.rows.reduce((total, row) => total + row.effectiveDays, 0)
    assert.equal(sum, 254)
    assert.closeTo(days.total.effectiveWeeks, 254 / 6, 0.0001)
    for (const row of days.rows) {
      assert.equal(
        row.schoolDays,
        row.holidays + row.assessments + row.activities + row.effectiveDays,
        row.month
      )
    }
  })

  test('school events count for the whole school, class events only for that class (D-258)', async ({
    assert,
  }) => {
    const { sdJati } = await calendarFixtures()
    const operator = await createMember(sdJati, 'operator')
    const year = await createJatengYear(sdJati)
    const fourA = await createClassIn(sdJati, year.id, '4A')
    const fourB = await createClassIn(sdJati, year.id, '4B')
    const actor = { schoolId: sdJati.id, userId: operator.user.id }

    await asSchool(sdJati, async () => {
      // STS of the whole school: a Monday to Saturday week in September.
      await SchoolLayer.add(actor, 'calendar', YEAR, {
        kind: 'exam',
        exam_type: 'sts',
        title: 'Sumatif Tengah Semester Gasal',
        starts_on: '2026-09-21',
        ends_on: '2026-09-26',
      })
      // A class trip of 4A on one Wednesday.
      await SchoolLayer.add(actor, 'calendar', YEAR, {
        kind: 'no_lessons',
        title: 'Karyawisata kelas 4A',
        starts_on: '2026-10-14',
        ends_on: '2026-10-14',
        class_id: fourA.id,
      })
    })

    const view = await calendarOf(sdJati)
    assert.equal(effectiveDaysOf(view, null).total.effectiveDays, 248)
    assert.equal(effectiveDaysOf(view, fourA.id).total.effectiveDays, 247)
    assert.equal(effectiveDaysOf(view, fourB.id).total.effectiveDays, 248)
    const sts = effectiveDaysOf(view, null).rows.find((row) => row.month === '2026-09')!
    assert.equal(sts.assessments, 6)
  })

  test('a joint-leave day the school keeps open becomes an effective day (D-255)', async ({
    assert,
  }) => {
    const { sdJati } = await calendarFixtures()
    const operator = await createMember(sdJati, 'operator')
    const actor = { schoolId: sdJati.id, userId: operator.user.id }
    // 24 December 2026 falls inside the semester break, 12 March 2027 does not.
    await asSchool(sdJati, () =>
      SchoolLayer.hide(actor, 'calendar', YEAR, holidayKey('2027-03-12', 'joint_leave'), null)
    )
    const view = await calendarOf(sdJati)
    assert.equal(effectiveDaysOf(view, null).total.effectiveDays, 255)
    assert.isTrue(
      view.hidden.some(
        (item) => item.itemKey === 'HOL-2027-03-12-joint_leave' && item.hiddenBy.layer === 'school'
      )
    )
  })

  test('a national holiday cannot be kept open: refused by the rules and by the database', async ({
    assert,
  }) => {
    const { sdJati } = await calendarFixtures()
    const operator = await createMember(sdJati, 'operator')
    const actor = { schoolId: sdJati.id, userId: operator.user.id }
    await assert.rejects(
      () =>
        asSchool(sdJati, () =>
          SchoolLayer.hide(
            actor,
            'calendar',
            YEAR,
            holidayKey('2026-08-17', 'national_holiday'),
            null
          )
        ),
      /layers\.errors\.mandatory/
    )
    // Official region events are mandatory for the region's schools too (D-466).
    const view = await calendarOf(sdJati)
    const tka = view.items.find((item) => item.value.title.includes('TKA'))!
    assert.equal(tka.force, 'mandatory')
    await assert.rejects(
      () => asSchool(sdJati, () => SchoolLayer.hide(actor, 'calendar', YEAR, tka.itemKey, null)),
      /layers\.errors\.mandatory/
    )
  })

  test('without an official frame the academic year gives the dates; else 1 July – 30 June', async ({
    assert,
  }) => {
    const { sdJati } = await calendarFixtures({ activate: false })
    const before = await calendarOf(sdJati)
    assert.isFalse(before.ready)
    assert.equal(before.frame.source, 'default')
    assert.equal(before.frame.startsOn, '2026-07-01')
    assert.equal(before.frame.endsOn, '2027-06-30')

    await createJatengYear(sdJati)
    const after = await calendarOf(sdJati)
    assert.equal(after.frame.source, 'academic_year')
    assert.equal(after.frame.startsOn, '2026-07-13')
  })
})
