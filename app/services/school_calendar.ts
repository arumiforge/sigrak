import { DateTime } from 'luxon'
import Calendar from '#models/calendar'
import CalendarEvent from '#models/calendar_event'
import NationalHoliday from '#models/national_holiday'

export type CalendarEntry = {
  id: string
  title: string
  /** Event kinds plus the two national holiday kinds. */
  kind: CalendarEvent['kind'] | NationalHoliday['kind']
  examType: CalendarEvent['examType']
  startsOn: string
  endsOn: string
  source: 'school' | 'national'
  isProvisional: boolean
  /** A joint-leave date the school keeps as a school day (D-255). */
  isSchoolDay: boolean
}

const today = () => DateTime.now().setZone('Asia/Jakarta').toISODate()!

/**
 * Read side of Kalender for one school. Every query is filtered on the
 * school's id, so another school's calendar never reaches the page.
 */
export class SchoolCalendar {
  constructor(private schoolId: number) {}

  /**
   * The calendar of the academic year that holds today, else the most
   * recent one.
   */
  async current() {
    const date = today()
    const running = await Calendar.query()
      .where('school_id', this.schoolId)
      .where('starts_on', '<=', date)
      .where('ends_on', '>=', date)
      .first()
    if (running) {
      return running
    }
    return Calendar.query().where('school_id', this.schoolId).orderBy('starts_on', 'desc').first()
  }

  /**
   * School events and national holidays inside the calendar's year,
   * sorted by date.
   */
  async entries(calendar: Calendar): Promise<CalendarEntry[]> {
    if (calendar.schoolId !== this.schoolId) {
      throw new Error('Calendar does not belong to this school')
    }

    const [events, holidays] = await Promise.all([
      CalendarEvent.query()
        .where('calendar_id', calendar.id)
        .orderBy('starts_on', 'asc')
        .orderBy('id', 'asc'),
      NationalHoliday.query()
        .whereBetween('date', [calendar.startsOn.toISODate()!, calendar.endsOn.toISODate()!])
        .orderBy('date', 'asc'),
    ])

    const schoolDays = new Set(calendar.jointLeaveSchoolDays ?? [])

    const entries: CalendarEntry[] = [
      ...events.map((event) => ({
        id: event.publicId,
        title: event.title,
        kind: event.kind,
        examType: event.examType,
        startsOn: event.startsOn.toISODate()!,
        endsOn: event.endsOn.toISODate()!,
        source: 'school' as const,
        isProvisional: false,
        isSchoolDay: false,
      })),
      ...holidays.map((holiday) => {
        const date = holiday.date.toISODate()!
        return {
          id: `national-${holiday.id}`,
          title: holiday.name,
          kind: holiday.kind,
          examType: null,
          startsOn: date,
          endsOn: date,
          source: 'national' as const,
          isProvisional: holiday.isProvisional,
          isSchoolDay: holiday.kind === 'joint_leave' && schoolDays.has(date),
        }
      }),
    ]

    return entries.sort(
      (a, b) => a.startsOn.localeCompare(b.startsOn) || a.endsOn.localeCompare(b.endsOn)
    )
  }
}
