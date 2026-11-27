import { NationalHolidaySchema } from '#database/schema'

export type NationalHolidayKind = 'national_holiday' | 'joint_leave'

/**
 * Central, read-only list of SKB holidays and joint leave (D-253).
 */
export default class NationalHoliday extends NationalHolidaySchema {
  declare kind: NationalHolidayKind
}
