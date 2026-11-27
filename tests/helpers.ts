import type { ApiClient, ApiResponse } from '@japa/api-client'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import { hosts, type Area } from '#config/hosts'
import { sessionCookieNames } from '#config/session'
import Region from '#models/region'
import School from '#models/school'
import User from '#models/user'
import SchoolMembership from '#models/school_membership'
import StaffUser from '#models/staff_user'
import Calendar from '#models/calendar'
import CalendarEvent from '#models/calendar_event'
import ExamSession from '#models/exam_session'
import ExamParticipant from '#models/exam_participant'
import AiCredential from '#models/ai_credential'

export const PASSWORD = 'rahasia-uji-123'

let counter = 0
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`

export async function createSchool(name: string) {
  const region = await Region.firstOrCreate({ province: 'Jawa Tengah', regency: 'Kabupaten Uji' })
  return School.create({
    name,
    level: 'sd',
    regionId: region.id,
    district: 'Kecamatan Uji',
    address: 'Jalan Uji',
  })
}

export async function createTeacher(school: School) {
  const user = await User.create({
    name: 'Guru Uji',
    email: `guru-${unique()}@uji.test`,
    password: PASSWORD,
    nip: null,
  })
  await SchoolMembership.create({
    schoolId: school.id,
    userId: user.id,
    role: 'teacher',
    status: 'active',
    startedOn: DateTime.fromISO('2026-07-01'),
  })
  return user
}

export async function createStaff() {
  return StaffUser.create({
    name: 'Staf Uji',
    email: `staf-${unique()}@uji.test`,
    password: PASSWORD,
    role: 'support',
  })
}

export async function createParticipant(school: School, status: ExamSession['status'] = 'open') {
  const session = await ExamSession.create({
    schoolId: school.id,
    title: 'Simulasi Uji',
    opensAt: DateTime.now().minus({ hours: 1 }),
    closesAt: DateTime.now().plus({ hours: 2 }),
    status,
  })
  return ExamParticipant.create({
    examSessionId: session.id,
    username: `peserta-${unique()}`,
    password: ExamParticipant.encryptPassword(PASSWORD),
    status: 'not_started',
  })
}

/**
 * A school calendar for the academic year that holds today, with one
 * event per given title.
 */
export async function createCalendar(school: School, titles: string[]) {
  const today = DateTime.now().setZone('Asia/Jakarta').startOf('day')
  const calendar = await Calendar.create({
    schoolId: school.id,
    academicYear: `${today.year}/${today.year + 1}`,
    name: `Kalender ${school.name}`,
    status: 'active',
    schoolDaysPerWeek: 6,
    startsOn: today.minus({ months: 3 }),
    evenSemesterStartsOn: today.plus({ months: 2 }),
    endsOn: today.plus({ months: 8 }),
    jointLeaveSchoolDays: [],
    meta: {},
  })
  for (const [index, title] of titles.entries()) {
    await CalendarEvent.create({
      calendarId: calendar.id,
      kind: 'school_event',
      examType: null,
      title,
      startsOn: today.plus({ days: index }),
      endsOn: today.plus({ days: index }),
    })
  }
  return calendar
}

/**
 * AI keys for a user, labelled A, B, C… in id order; `backup` marks the
 * given labels as backup keys (D-119).
 */
export async function createAiKeys(user: User, count = 3, backup: string[] = []) {
  const keys: AiCredential[] = []
  for (let index = 0; index < count; index++) {
    const label = String.fromCharCode(65 + index)
    const key = new AiCredential()
    key.fill({
      userId: user.id,
      label: `Kunci ${label}`,
      projectLabel: `Project ${label}`,
      accountLabel: null,
      status: 'active',
      isBackup: backup.includes(label),
      consecutiveFailures: 0,
    })
    key.setSecret(`test-key-${unique()}-${label}`)
    await key.save()
    keys.push(key)
  }
  return keys
}

/**
 * Cookies of a response, keyed by name (values decoded by the AdonisJS
 * cookie serializer).
 */
function cookieValue(response: ApiResponse, name: string) {
  return response.cookie(name)?.value as string | undefined
}

/**
 * Signs in through the real login form of an area: GET /masuk for the
 * session and CSRF token, then POST /masuk. Returns the session id of
 * the signed-in session and the POST response.
 */
export async function login(
  client: ApiClient,
  area: Area,
  credentials: Record<string, string>
): Promise<{ sessionId: string | undefined; response: ApiResponse }> {
  const cookieName = sessionCookieNames[area]
  const page = await client.get('/masuk').header('host', hosts[area]).redirects(0)
  const sessionId = cookieValue(page, cookieName)
  const csrfToken = cookieValue(page, 'XSRF-TOKEN')
  if (!sessionId || !csrfToken) {
    throw new Error(`No session or CSRF cookie from ${hosts[area]}/masuk`)
  }

  const response = await client
    .post('/masuk')
    .header('host', hosts[area])
    .header('x-csrf-token', csrfToken)
    .withCookie(cookieName, sessionId)
    .form(credentials)
    .redirects(0)

  return { sessionId: cookieValue(response, cookieName) ?? sessionId, response }
}

/**
 * A GET on an area's host carrying a session id under a cookie name.
 */
export function visit(
  client: ApiClient,
  area: Area,
  path: string,
  cookie?: { name: string; sessionId: string }
) {
  const request = client.get(path).header('host', hosts[area]).redirects(0)
  if (cookie) {
    request.withCookie(cookie.name, cookie.sessionId)
  }
  return request
}

/**
 * Sets config values for one test; returns the function that restores
 * them (use it as a Japa cleanup).
 */
export function overrideConfig(values: Record<string, unknown>) {
  const previous = Object.entries(values).map(([key]) => [key, app.config.get(key)] as const)
  for (const [key, value] of Object.entries(values)) {
    app.config.set(key, value)
  }
  return () => {
    for (const [key, value] of previous) {
      app.config.set(key, value)
    }
  }
}

/**
 * Polls until `check` returns a value other than undefined/false, or
 * fails after `timeoutMs`.
 */
export async function eventually<T>(
  check: () => Promise<T | undefined | false>,
  timeoutMs = 10_000,
  what = 'condition'
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await check()
    if (value !== undefined && value !== false) return value
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`Timed out after ${timeoutMs} ms waiting for ${what}`)
}
