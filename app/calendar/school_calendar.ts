import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { hiddenByProps, sourceProps } from '../layers/presenters.js'
import type { HiddenItem, ResolvedItem } from '../layers/resolver/resolve_core.js'
import { LayerResolver, type SchoolResolution } from '../layers/resolver/layer_resolver.js'
import { schoolYearBounds } from '../layers/school_years.js'
import { academicYearDates } from './domain.js'
import { effectiveDays, nonEffectiveDays, type EffectiveDays } from './effective_days.js'
import { frameOf, type CalendarFrame } from './frame.js'
import { CALENDAR_DOMAIN, type CalendarValue } from './types.js'

/**
 * Kalender for one school and school year, read through the layer
 * resolver (never from `calendar_items` directly, §5.1) inside the
 * request's tenant transaction (RLS, D-429).
 */
export interface CalendarView {
  schoolYear: string
  resolution: SchoolResolution<CalendarValue>
  frame: CalendarFrame
  /** Dated items (events, holidays, notes) of the year, in display order. */
  items: ResolvedItem<CalendarValue>[]
  hidden: HiddenItem<CalendarValue>[]
  /** True once a national or area package is active (else the data is still under review). */
  ready: boolean
}

function overlaps(item: ResolvedItem<CalendarValue>, from: string, to: string) {
  return (
    item.value.startsOn !== null && item.value.startsOn <= to && (item.value.endsOn ?? '') >= from
  )
}

export async function loadCalendar(
  client: QueryClientContract,
  schoolId: number,
  schoolYear: string
): Promise<CalendarView> {
  const resolution = await LayerResolver.resolve<CalendarValue>(
    CALENDAR_DOMAIN,
    schoolId,
    schoolYear,
    { client }
  )
  const frame = frameOf(
    resolution.items,
    await academicYearDates(client, schoolId, schoolYear),
    schoolYear
  )
  const bounds = schoolYearBounds(schoolYear)
  const from = frame.startsOn < bounds.startsOn ? frame.startsOn : bounds.startsOn
  const to = frame.endsOn > bounds.endsOn ? frame.endsOn : bounds.endsOn
  return {
    schoolYear,
    resolution,
    frame,
    items: resolution.items.filter((item) => overlaps(item, from, to)),
    hidden: resolution.hidden.filter((item) => overlaps(item, from, to)),
    ready: Object.keys(resolution.stamp).some((code) => !code.startsWith('SCHOOL-')),
  }
}

export function effectiveDaysOf(view: CalendarView, classId: number | null): EffectiveDays {
  return effectiveDays({ frame: view.frame, items: view.items, classId })
}

/** Non-effective school days of the whole school: date → title. */
export function offDaysOf(view: CalendarView) {
  const days = nonEffectiveDays({ frame: view.frame, items: view.items, classId: null })
  return Object.fromEntries([...days].map(([date, day]) => [date, day.title]))
}

/** What the page needs of one item. `classes` maps class ids to their public id and name. */
export function entryProps(
  item: ResolvedItem<CalendarValue>,
  classes: Map<number, { id: string; name: string }>
) {
  return {
    key: item.itemKey,
    title: item.value.title,
    kind: item.value.kind,
    examType: item.value.examType,
    startsOn: item.value.startsOn!,
    endsOn: item.value.endsOn!,
    class: item.value.classId === null ? null : (classes.get(item.value.classId) ?? null),
    own: item.source.layer === 'school',
    provisional: item.source.sourceRef?.provisional === true,
    source: sourceProps(item),
  }
}

export function hiddenEntryProps(
  item: HiddenItem<CalendarValue>,
  classes: Map<number, { id: string; name: string }>
) {
  return { ...entryProps(item, classes), hiddenBy: hiddenByProps(item) }
}

export function frameProps(frame: CalendarFrame) {
  return {
    startsOn: frame.startsOn,
    evenSemesterStartsOn: frame.evenSemesterStartsOn,
    endsOn: frame.endsOn,
    schoolDaysPerWeek: frame.schoolDaysPerWeek,
    from: frame.source,
    source: frame.sourceItem ? sourceProps(frame.sourceItem) : null,
    academicYearDiffers: frame.academicYearDiffers,
  }
}
