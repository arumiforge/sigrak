import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import School from '#models/school'
import { SchoolCalendar } from '#services/school_calendar'

/**
 * Kalender (read-only spike): school events and national holidays for
 * the signed-in user's school, as a month view and a list. The entries
 * are a deferred prop, so the page shell renders at once with a
 * skeleton.
 */
export default class CalendarController {
  async index({ inertia, membership }: HttpContext) {
    // Set by the school context middleware; unset for a teacher without a school.
    const today = DateTime.now().setZone('Asia/Jakarta').toISODate()!

    if (!membership) {
      return inertia.render('school/calendar', {
        school: null,
        calendar: null,
        today,
        entries: inertia.defer(async () => []),
      })
    }

    const school = await School.findOrFail(membership.schoolId)
    const schoolCalendar = new SchoolCalendar(membership.schoolId)
    const calendar = await schoolCalendar.current()

    return inertia.render('school/calendar', {
      school: { name: school.name },
      calendar: calendar
        ? {
            name: calendar.name,
            academicYear: calendar.academicYear,
            startsOn: calendar.startsOn.toISODate()!,
            endsOn: calendar.endsOn.toISODate()!,
          }
        : null,
      today,
      entries: inertia.defer(async () => (calendar ? schoolCalendar.entries(calendar) : [])),
    })
  }
}
