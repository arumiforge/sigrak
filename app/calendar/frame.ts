import type { ResolvedItem } from '../layers/resolver/resolve_core.js'
import { schoolYearBounds } from '../layers/school_years.js'
import type { CalendarValue, FrameKey } from './types.js'

/**
 * The school-year frame a calendar counts in (D-259, D-323): first day,
 * start of semester 2, last day and school days per week.
 *
 * Each value comes from the nearest layer that sets it as a `setting`
 * item (the Jawa Tengah kaldik sets all four, mandatory for its
 * schools, D-466). Without one, the school's academic year (R1-06)
 * gives the dates; without that, 1 July – 30 June with semester 2 from
 * 1 January. Days per week default to 6 (D-323) until the timetable
 * (R1-09) gives each class its own days.
 */
export interface CalendarFrame {
  startsOn: string
  evenSemesterStartsOn: string
  endsOn: string
  schoolDaysPerWeek: 5 | 6
  /** Where the dates came from. */
  source: 'layer' | 'academic_year' | 'default'
  /** The frame item that set the first day, for its source badge. */
  sourceItem: ResolvedItem<CalendarValue> | null
  /** The school's academic year differs from an official frame (shown to the operator). */
  academicYearDiffers: boolean
}

export interface YearDates {
  startsOn: string
  evenSemesterStartsOn: string
  endsOn: string
}

export function frameOf(
  items: ResolvedItem<CalendarValue>[],
  academicYear: YearDates | null,
  schoolYear: string
): CalendarFrame {
  const settings = new Map<string, ResolvedItem<CalendarValue>>()
  for (const item of items) {
    if (item.value.kind === 'setting' && item.value.settingValue !== null) {
      settings.set(item.itemKey, item)
    }
  }
  const setting = (key: FrameKey) => settings.get(key)?.value.settingValue ?? null
  const bounds = schoolYearBounds(schoolYear)
  const start = Number(bounds.startsOn.slice(0, 4))
  const fallback: YearDates = academicYear ?? {
    startsOn: bounds.startsOn,
    evenSemesterStartsOn: `${start + 1}-01-01`,
    endsOn: bounds.endsOn,
  }

  const startsOn = setting('FRAME-starts_on') ?? fallback.startsOn
  const evenSemesterStartsOn =
    setting('FRAME-even_semester_starts_on') ?? fallback.evenSemesterStartsOn
  const endsOn = setting('FRAME-ends_on') ?? fallback.endsOn
  const days = Number(setting('FRAME-school_days_per_week') ?? 6) === 5 ? 5 : 6
  const fromLayer = settings.has('FRAME-starts_on') || settings.has('FRAME-ends_on')

  return {
    startsOn,
    evenSemesterStartsOn,
    endsOn,
    schoolDaysPerWeek: days,
    source: fromLayer ? 'layer' : academicYear ? 'academic_year' : 'default',
    sourceItem: settings.get('FRAME-starts_on') ?? null,
    academicYearDiffers:
      fromLayer &&
      academicYear !== null &&
      (academicYear.startsOn !== startsOn ||
        academicYear.evenSemesterStartsOn !== evenSemesterStartsOn ||
        academicYear.endsOn !== endsOn),
  }
}

/** Weekdays with lessons (ISO 1 Monday … 6 Saturday) for a 5- or 6-day week. */
export function schoolWeekdays(daysPerWeek: 5 | 6) {
  return new Set(daysPerWeek === 5 ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6])
}
