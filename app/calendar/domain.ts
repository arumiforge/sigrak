import vine from '@vinejs/vine'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { itemInput, type DomainAdapter, type LayeredRow } from '../layers/domains/domain_adapter.js'
import { LayerRuleException } from '../layers/layer_rules.js'
import type { ResolvedItem } from '../layers/resolver/resolve_core.js'
import type { SchoolResolution } from '../layers/resolver/layer_resolver.js'
import { ConflictChecker } from './conflict_checker.js'
import { isIsoDate, shortDate, toIsoDate } from './dates.js'
import { frameOf, type YearDates } from './frame.js'
import { calendarMatchKey } from './keys.js'
import {
  CALENDAR_DOMAIN,
  CALENDAR_ITEM_KINDS,
  EVENT_KINDS,
  EXAM_TYPES,
  type CalendarEventPayload,
  type CalendarValue,
} from './types.js'

/**
 * The calendar's layer adapter (docs/drafts/regional-layers.md §5.6):
 * `calendar_items` rows, match key = dates + kind + class + title,
 * frame settings, and the conflict checker as the domain's own rule
 * (D-260) on every school addition or change.
 */

type Row = LayeredRow & {
  kind: CalendarValue['kind']
  exam_type: CalendarValue['examType']
  title: string
  starts_on: string | Date | null
  ends_on: string | Date | null
  class_id: number | string | null
  setting_value: string | null
}

const payloadValidator = vine.create({
  kind: vine.enum(EVENT_KINDS),
  exam_type: vine.enum(EXAM_TYPES).optional(),
  title: vine.string().trim().minLength(3).maxLength(150),
  starts_on: vine.string().trim(),
  ends_on: vine.string().trim().optional(),
  class_id: vine.number().withoutDecimals().positive().optional(),
})

const kindOrder = new Map<string, number>(CALENDAR_ITEM_KINDS.map((kind, index) => [kind, index]))

function rangeLabel(startsOn: string | null, endsOn: string | null) {
  if (!startsOn) return ''
  if (!endsOn || endsOn === startsOn) return shortDate(startsOn)
  return `${shortDate(startsOn)}–${shortDate(endsOn)}`
}

/**
 * The school's academic year dates for the frame, read in the open
 * tenant transaction (RLS keeps it to the school).
 */
export async function academicYearDates(
  client: QueryClientContract,
  schoolId: number,
  schoolYear: string
): Promise<YearDates | null> {
  const row = (await client
    .from('academic_years')
    .where('school_id', schoolId)
    .where('name', schoolYear)
    .select('starts_on', 'even_semester_starts_on', 'ends_on')
    .first()) as
    | { starts_on: string | Date; even_semester_starts_on: string | Date; ends_on: string | Date }
    | undefined
  if (!row) return null
  return {
    startsOn: toIsoDate(row.starts_on),
    evenSemesterStartsOn: toIsoDate(row.even_semester_starts_on),
    endsOn: toIsoDate(row.ends_on),
  }
}

export const calendarAdapter: DomainAdapter<CalendarValue, CalendarEventPayload> = {
  domain: CALENDAR_DOMAIN,
  itemTable: 'calendar_items',
  keyPrefix: 'CAL',

  async loadItems(client: QueryClientContract, packageIds: number[]) {
    if (packageIds.length === 0) return []
    const rows = (await client
      .from('calendar_items')
      .whereIn('package_id', packageIds)
      .whereNot('status', 'retired')
      .select('*')) as Row[]
    return rows.map((row) =>
      itemInput<CalendarValue>(row, {
        kind: row.kind,
        examType: row.exam_type,
        title: row.title,
        startsOn: row.starts_on === null ? null : toIsoDate(row.starts_on),
        endsOn: row.ends_on === null ? null : toIsoDate(row.ends_on),
        classId: row.class_id === null ? null : Number(row.class_id),
        settingValue: row.setting_value,
      })
    )
  },

  async validatePayload(input: unknown) {
    const data = await payloadValidator.validate(input)
    const endsOn = data.ends_on && data.ends_on !== '' ? data.ends_on : data.starts_on
    if (!isIsoDate(data.starts_on) || !isIsoDate(endsOn)) {
      throw new LayerRuleException('calendar.errors.date')
    }
    if (endsOn < data.starts_on) throw new LayerRuleException('calendar.errors.end_before_start')
    if (data.kind === 'exam' && !data.exam_type) {
      throw new LayerRuleException('calendar.errors.exam_type')
    }
    const payload: CalendarEventPayload = {
      kind: data.kind,
      title: data.title,
      starts_on: data.starts_on,
      ends_on: endsOn,
    }
    if (data.kind === 'exam') payload.exam_type = data.exam_type
    if (data.class_id) payload.class_id = data.class_id
    return payload
  },

  matchKeyOf(payload) {
    return calendarMatchKey({
      itemKey: '',
      kind: payload.kind,
      startsOn: payload.starts_on,
      endsOn: payload.ends_on,
      classId: payload.class_id ?? null,
      title: payload.title,
    })
  },

  groupKeyOf() {
    return null
  },

  columnsOf(payload) {
    return {
      kind: payload.kind,
      exam_type: payload.kind === 'exam' ? (payload.exam_type ?? null) : null,
      title: payload.title,
      starts_on: payload.starts_on,
      ends_on: payload.ends_on,
      class_id: payload.class_id ?? null,
      setting_value: null,
    }
  },

  labelOf(value) {
    if ('kind' in value && 'startsOn' in value) {
      const range = rangeLabel(value.startsOn, value.endsOn)
      return range ? `${value.title} (${range})` : value.title
    }
    const payload = value as CalendarEventPayload
    return `${payload.title} (${rangeLabel(payload.starts_on, payload.ends_on)})`
  },

  compare(a: ResolvedItem<CalendarValue>, b: ResolvedItem<CalendarValue>) {
    const start = (item: ResolvedItem<CalendarValue>) => item.value.startsOn ?? ''
    return (
      start(a).localeCompare(start(b)) ||
      (a.value.endsOn ?? '').localeCompare(b.value.endsOn ?? '') ||
      (kindOrder.get(a.value.kind) ?? 99) - (kindOrder.get(b.value.kind) ?? 99) ||
      a.value.title.localeCompare(b.value.title, 'id') ||
      a.itemKey.localeCompare(b.itemKey)
    )
  },

  async checkChange(
    client: QueryClientContract,
    resolution: SchoolResolution<CalendarValue>,
    payload: CalendarEventPayload,
    options: { replacing: string | null }
  ) {
    if (payload.class_id) {
      const own = await client
        .from('classes as c')
        .join('academic_years as y', 'y.id', 'c.academic_year_id')
        .where('c.id', payload.class_id)
        .where('y.school_id', resolution.schoolId)
        .where('y.name', resolution.schoolYear)
        .select('c.id')
        .first()
      if (!own) throw new LayerRuleException('calendar.errors.class_not_found')
    }
    const items = resolution.items.filter((item) => item.itemKey !== options.replacing)
    const frame = frameOf(
      items,
      await academicYearDates(client, resolution.schoolId, resolution.schoolYear),
      resolution.schoolYear
    )
    const result = ConflictChecker.checkEvent(
      {
        kind: payload.kind,
        examType: payload.exam_type ?? null,
        startsOn: payload.starts_on,
        endsOn: payload.ends_on,
        classId: payload.class_id ?? null,
      },
      { frame, items }
    )
    const error = result.errors[0]
    if (error) throw new LayerRuleException(error.key, error.values)
  },
}
