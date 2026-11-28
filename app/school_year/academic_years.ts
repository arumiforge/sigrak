import { DateTime } from 'luxon'
import AcademicYear from './models/academic_year.js'
import SchoolClass from './models/school_class.js'
import { SchoolYearRuleError } from './errors.js'

const ZONE = 'Asia/Jakarta'

/**
 * Academic years (D-241): the name follows the start date, a year lasts
 * at most 12 months and never overlaps another year of the school, the
 * form suggests the year after the latest one, and a year with classes
 * cannot be deleted. A closed year is read-only (D-318).
 *
 * Every function here runs inside a tenant transaction of the school.
 */

export interface YearDates {
  startsOn: DateTime
  evenSemesterStartsOn: DateTime
  endsOn: DateTime
}

/** `2026-07-13` → `2026/2027`. */
export function yearName(startsOn: DateTime) {
  return `${startsOn.year}/${startsOn.year + 1}`
}

/** Today in WIB (D-165), as a date. */
export function today(now: DateTime = DateTime.now()) {
  return now.setZone(ZONE).startOf('day')
}

/**
 * Dates the form suggests: the year after the latest one (1 July to
 * 30 June, semester 2 from 1 January); with no year yet, the school
 * year that holds today.
 */
export function suggestedDates(latest: YearDates | null, now = today()): YearDates {
  let start: DateTime
  if (latest) {
    start = DateTime.fromObject(
      { year: latest.startsOn.year + 1, month: 7, day: 1 },
      { zone: ZONE }
    )
    if (start <= latest.endsOn) start = latest.endsOn.plus({ days: 1 })
  } else {
    const year = now.month >= 7 ? now.year : now.year - 1
    start = DateTime.fromObject({ year, month: 7, day: 1 }, { zone: ZONE })
  }
  return {
    startsOn: start,
    evenSemesterStartsOn: DateTime.fromObject(
      { year: start.year + 1, month: 1, day: 1 },
      { zone: ZONE }
    ),
    endsOn: DateTime.fromObject({ year: start.year + 1, month: 6, day: 30 }, { zone: ZONE }),
  }
}

/**
 * The "current" year (D-241): the one that holds today, else the next
 * one, else the latest. `years` in any order.
 */
export function currentYear<T extends YearDates>(years: T[], now = today()): T | null {
  const sorted = [...years].sort((a, b) => a.startsOn.toMillis() - b.startsOn.toMillis())
  const date = now.toISODate()!
  return (
    sorted.find((year) => year.startsOn.toISODate()! <= date && date <= year.endsOn.toISODate()!) ??
    sorted.find((year) => year.startsOn.toISODate()! > date) ??
    sorted.at(-1) ??
    null
  )
}

/** The school's years, oldest first. */
export function yearsOfSchool() {
  return AcademicYear.query().orderBy('starts_on', 'asc')
}

/**
 * The latest year of the school that starts before `target` (the source
 * of a class copy, D-246).
 */
export function previousYear(target: AcademicYear) {
  return AcademicYear.query()
    .where('starts_on', '<', target.startsOn.toISODate()!)
    .whereNot('id', target.id)
    .orderBy('starts_on', 'desc')
    .first()
}

export function refuseClosed(year: AcademicYear) {
  if (year.isClosed) {
    throw new SchoolYearRuleError(null, 'classes.errors.year_closed', { year: year.name })
  }
}

/**
 * Checks the dates and saves a new year, or changes `existing`.
 */
export async function saveAcademicYear(dates: YearDates, existing?: AcademicYear) {
  if (existing) refuseClosed(existing)

  const { startsOn, evenSemesterStartsOn, endsOn } = dates
  if (!(startsOn < evenSemesterStartsOn)) {
    throw new SchoolYearRuleError('even_semester_starts_on', 'classes.errors.even_after_start')
  }
  if (!(evenSemesterStartsOn < endsOn)) {
    throw new SchoolYearRuleError('ends_on', 'classes.errors.end_after_even')
  }
  if (!(endsOn < startsOn.plus({ years: 1 }))) {
    throw new SchoolYearRuleError('ends_on', 'classes.errors.at_most_a_year')
  }

  const name = yearName(startsOn)
  const others = () => {
    const query = AcademicYear.query()
    if (existing) query.whereNot('id', existing.id)
    return query
  }
  const overlap = await others()
    .where('starts_on', '<=', endsOn.toISODate()!)
    .where('ends_on', '>=', startsOn.toISODate()!)
    .first()
  if (overlap) {
    throw new SchoolYearRuleError('starts_on', 'classes.errors.year_overlap', {
      year: overlap.name,
    })
  }
  const sameName = await others().where('name', name).first()
  if (sameName) {
    throw new SchoolYearRuleError('starts_on', 'classes.errors.year_name_taken', { year: name })
  }

  const year = existing ?? new AcademicYear()
  year.merge({ name, startsOn, evenSemesterStartsOn, endsOn })
  await year.save()
  return year
}

/**
 * Deletes a year without classes (D-241).
 */
export async function deleteAcademicYear(year: AcademicYear) {
  refuseClosed(year)
  const hasClasses = await SchoolClass.query().where('academic_year_id', year.id).first()
  if (hasClasses) {
    throw new SchoolYearRuleError(null, 'classes.errors.year_has_classes', { year: year.name })
  }
  await year.delete()
}
