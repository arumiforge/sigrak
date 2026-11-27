import { CalendarEventSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Calendar from '#models/calendar'
import { withPublicId } from '#models/mixins/with_public_id'

export const calendarEventKinds = ['holiday', 'exam', 'school_event', 'no_lessons'] as const
export type CalendarEventKind = (typeof calendarEventKinds)[number]

export const examTypes = ['sts', 'sas', 'other'] as const
export type ExamType = (typeof examTypes)[number]

export default class CalendarEvent extends compose(CalendarEventSchema, withPublicId) {
  declare kind: CalendarEventKind
  declare examType: ExamType | null

  @belongsTo(() => Calendar)
  declare calendar: BelongsTo<typeof Calendar>
}
