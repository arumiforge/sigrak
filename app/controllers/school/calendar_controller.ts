import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import User from '#models/user'
import { SchoolCalendar } from '#services/school_calendar'

/**
 * Kalender (read-only spike): school events and national holidays for
 * the signed-in user's school, as a month view and a list. The entries
 * are a deferred prop, so the page shell renders at once with a
 * skeleton.
 */
export default class CalendarController {
  async index({ inertia, auth }: HttpContext) {
    const user = auth.use('web').getUserOrFail()
    if (!(user instanceof User)) {
      throw new Error('Expected a school user')
    }

    const membership = await user.currentMembership()
    const today = DateTime.now().setZone('Asia/Jakarta').toISODate()!

    if (!membership) {
      return inertia.render('school/calendar', {
        school: null,
        calendar: null,
        today,
        entries: inertia.defer(async () => []),
      })
    }

    const schoolCalendar = new SchoolCalendar(membership.schoolId)
    const calendar = await schoolCalendar.current()

    return inertia.render('school/calendar', {
      school: { name: membership.school.name },
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
