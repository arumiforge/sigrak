import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { hosts, type Area } from '#config/hosts'
import { sessionCookieNames } from '#config/session'
import type School from '#models/school'
import type { StaffRole } from '#staff/roles'
import {
  activateCalendarPackage,
  importNationalHolidays,
  importRegionCalendar,
  NATIONAL_PACKAGE_CODE,
} from '#calendar/data_files'
import { loadCalendar } from '#calendar/school_calendar'
import { LayerResolver } from '#layers/resolver/layer_resolver'
import { saveAcademicYear } from '#school_year/academic_years'
import SchoolClass from '#school_year/models/school_class'
import { PASSWORD, createStaff, login, visit } from '#tests/helpers'
import { layerFixtures } from '#tests/layers'
import { asSchool, createMember } from '#tests/tenancy'
import { SchoolContext } from '#tenancy/school_context'

/**
 * Test helpers for the calendar (R1-08): the §11.3 areas (R1-07
 * fixtures) with the repository's national holidays and Jawa Tengah
 * kaldik imported and activated, sessions and form posts.
 */

export const YEAR = '2026/2027'
export const JATENG_FILE = () =>
  app.makePath('docs/data/calendar/region-jawa-tengah-2026-2027.json')
export const JATENG_CODE = 'KALDIK-JATENG-2026-2027-6H'

export async function importCalendars(options: { activate?: boolean } = {}) {
  await db.transaction(async (trx) => {
    await importNationalHolidays(trx)
    await importRegionCalendar(trx, { file: JATENG_FILE() })
    if (options.activate !== false) {
      await activateCalendarPackage(trx, NATIONAL_PACKAGE_CODE, null)
      await activateCalendarPackage(trx, JATENG_CODE, null)
    }
  })
  LayerResolver.clearCache()
}

/** SD and MI in Jati (Kudus), SD in Dawe, SD in Jepara without kecamatan; calendars active. */
export async function calendarFixtures(options: { activate?: boolean } = {}) {
  const schools = await layerFixtures()
  await importCalendars(options)
  return schools
}

/** The resolved calendar of a school, read as its own request would. */
export function calendarOf(school: School, schoolYear = YEAR) {
  return asSchool(school, () => loadCalendar(SchoolContext.current()!.trx!, school.id, schoolYear))
}

/** The academic year 2026/2027 of the Jawa Tengah kaldik (13 July – 19 June). */
export function createJatengYear(school: School) {
  return asSchool(school, () =>
    saveAcademicYear({
      startsOn: DateTime.fromISO('2026-07-13'),
      evenSemesterStartsOn: DateTime.fromISO('2027-01-02'),
      endsOn: DateTime.fromISO('2027-06-19'),
    })
  )
}

export function createClassIn(school: School, academicYearId: number, name = '4A', grade = 4) {
  return asSchool(school, () =>
    SchoolClass.create({ academicYearId, name, grade, artBranch: null, homeroomTeacherId: null })
  )
}

export type Session = { area: Area; sessionId: string; csrf: string }

export async function sessionFor(client: ApiClient, area: Area, email: string): Promise<Session> {
  const { sessionId } = await login(client, area, { email, password: PASSWORD })
  const page = await visit(client, area, area === 'app' ? '/kalender' : '/', {
    name: sessionCookieNames[area],
    sessionId: sessionId!,
  })
  return { area, sessionId: sessionId!, csrf: page.cookie('XSRF-TOKEN')?.value as string }
}

export async function member(
  client: ApiClient,
  school: School,
  role: 'operator' | 'teacher' | 'principal'
) {
  const fixture = await createMember(school, role)
  return { ...fixture, session: await sessionFor(client, 'app', fixture.user.email) }
}

export async function staff(client: ApiClient, role: StaffRole) {
  const account = await createStaff([role])
  return { account, session: await sessionFor(client, 'admin', account.email) }
}

export function get(client: ApiClient, session: Session, path: string) {
  return visit(client, session.area, path, {
    name: sessionCookieNames[session.area],
    sessionId: session.sessionId,
  })
}

export function post(
  client: ApiClient,
  session: Session,
  path: string,
  body: Record<string, unknown> = {}
) {
  return client
    .post(path)
    .header('host', hosts[session.area])
    .header('x-csrf-token', session.csrf)
    .withCookie(sessionCookieNames[session.area], session.sessionId)
    .form(body)
    .redirects(0)
}

/** The deferred props of Kalender (one partial reload). */
export async function deferredCalendar(client: ApiClient, session: Session, query = '') {
  const page = await get(client, session, `/kalender${query}`).withInertiaPartialReload(
    'school/calendar',
    ['entries', 'hidden', 'frame', 'effective', 'changes']
  )
  return page.inertiaProps as {
    entries: {
      key: string
      title: string
      kind: string
      own: boolean
      startsOn: string
      class: { id: string; name: string } | null
      source: { layer: string; force: string; regionName: string | null }
    }[]
    hidden: { key: string; kind: string; hiddenBy: { layer: string; own: boolean } }[]
    frame: { startsOn: string; endsOn: string; ready: boolean; academicYearDiffers: boolean }
    effective: { total: { effectiveDays: number }; semesters: { effectiveDays: number }[] }
    changes: {
      area: {
        added: { title: string }[]
        changed: { title: string }[]
        removed: { title: string }[]
      }
      days: { nowOff: { date: string }[]; nowSchoolDays: { date: string }[] }
      effectiveDays: { before: number; after: number }
    } | null
  }
}

/** The flash a redirect left: read on the next page. */
export async function flashOf(client: ApiClient, session: Session, path = '/kalender') {
  const page = await get(client, session, path).withInertia()
  return page.body().flash as { success?: string; error?: string }
}

export async function flashError(client: ApiClient, session: Session) {
  const flash = await flashOf(client, session)
  return flash.error
}

export async function changesFor(client: ApiClient, session: Session) {
  const props = await deferredCalendar(client, session)
  return props.changes
}
