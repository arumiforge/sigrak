import { TimetableSettingSchema } from '#database/schema'
import { compose } from '@adonisjs/core/helpers'
import { column } from '@adonisjs/lucid/orm'
import { withSchoolScope } from '#tenancy/with_school_scope'

/** Stored shape of a frame day (`timetable_settings.days`). */
export interface StoredFrameDay {
  weekday: number
  starts_at: string
  lessons: number
  opening: { kind: 'ceremony' | 'activity'; label: string | null; minutes: number } | null
}

/** Stored shape of a break (`timetable_settings.breaks`). */
export interface StoredFrameBreak {
  after_lesson: number
  minutes: number
}

/**
 * The school's frame and switches for the draft timetable (D-262). No
 * row means the defaults in `app/timetable/settings.ts`.
 */
export default class TimetableSetting extends compose(TimetableSettingSchema, withSchoolScope) {
  /** JSON arrays are sent as text; the driver would send a Postgres array. */
  @column({ prepare: (value: StoredFrameDay[]) => JSON.stringify(value) })
  declare days: StoredFrameDay[]

  @column({ prepare: (value: StoredFrameBreak[]) => JSON.stringify(value) })
  declare breaks: StoredFrameBreak[]
}
