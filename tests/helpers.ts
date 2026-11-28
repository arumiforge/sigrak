import type { ApiClient, ApiResponse } from '@japa/api-client'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { hosts, type Area } from '#config/hosts'
import { sessionCookieNames } from '#config/session'
import Region from '#models/region'
import School from '#models/school'
import User from '#models/user'
import SchoolMembership from '#models/school_membership'
import StaffUser from '#models/staff_user'
import StaffRoleAssignment from '#models/staff_role_assignment'
import type { StaffRole } from '#staff/roles'
import ExamSession from '#models/exam_session'
import ExamParticipant from '#models/exam_participant'
import AiCredential from '#models/ai_credential'
import { seedRegionList } from '#regions/region_list'
import { syncLayerDomains } from '#layers/domains/registry'

export const PASSWORD = 'rahasia-uji-123'

let counter = 0
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`

/**
 * Jawa Tengah with an invented Kabupaten Uji (code 33.99, not a real
 * Kemendagri code) and its Kecamatan Uji, for tests (R1-04).
 */
export async function testRegions() {
  await seedRegionList(db.connection(), {
    kemendagriCode: '33',
    dapodikCode: '030000',
    name: 'Jawa Tengah',
    children: [
      {
        kemendagriCode: '33.99',
        name: 'Uji',
        regencyKind: 'kabupaten',
        children: [{ kemendagriCode: '33.99.01', name: 'Uji' }],
      },
    ],
  })
  return {
    province: await Region.findByOrFail('kemendagriCode', '33'),
    regency: await Region.findByOrFail('kemendagriCode', '33.99'),
    district: await Region.findByOrFail('kemendagriCode', '33.99.01'),
  }
}

export async function createSchool(name: string) {
  const { regency, district } = await testRegions()
  return School.create({
    name,
    level: 'sd',
    regionId: regency.id,
    districtId: district.id,
    district: district.name,
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

export type TestScope = {
  regionIds?: number[]
  schoolIds?: number[]
  levels?: ('sd' | 'mi')[]
  fields?: string[]
}

/**
 * A staff account with roles (R2-01), each with the same scope, loaded
 * on the model as the auth middleware does.
 */
export async function createStaff(roles: StaffRole[] = ['support'], scope: TestScope = {}) {
  const staff = await StaffUser.create({
    name: 'Staf Uji',
    email: `staf-${unique()}@uji.test`,
    password: PASSWORD,
  })
  await setStaffRoles(staff, roles, scope)
  return staff
}

/** Replaces a staff member's roles (owner connection) and reloads them. */
export async function setStaffRoles(staff: StaffUser, roles: StaffRole[], scope: TestScope = {}) {
  await StaffRoleAssignment.query().where('staff_user_id', staff.id).delete()
  for (const role of roles) {
    await StaffRoleAssignment.create({
      staffUserId: staff.id,
      role,
      regionIds: scope.regionIds ?? [],
      schoolIds: scope.schoolIds ?? [],
      levels: scope.levels ?? [],
      fields: (scope.fields ?? []) as StaffRoleAssignment['fields'],
    })
  }
  await staff.load('roleAssignments')
  return staff
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
 * The school's own calendar package (layer `school`, R1-08) with one
 * school event per given title, from today on (owner connection, so it
 * bypasses the walls under test).
 */
export async function createCalendar(school: School, titles: string[]) {
  const today = DateTime.now().setZone('Asia/Jakarta').startOf('day')
  const startYear = today.month >= 7 ? today.year : today.year - 1
  const schoolYear = `${startYear}/${startYear + 1}`
  const now = new Date()
  // A test truncate empties the domain registry; restore it.
  await syncLayerDomains(db.connection())
  const [pkg] = (await db
    .table('layer_packages')
    .insert({
      code: `SCHOOL-${school.id}-CALENDAR-${schoolYear.replace('/', '-')}`,
      domain: 'calendar',
      layer: 'school',
      school_id: school.id,
      line: 'all',
      kind: 'school',
      level_scope: 'both',
      name: 'Perubahan sekolah',
      status: 'active',
      applies_from_school_year: schoolYear,
      version: 1,
      created_at: now,
      updated_at: now,
    })
    .returning('id')) as { id: number }[]
  const itemIds: number[] = []
  for (const [index, title] of titles.entries()) {
    const date = today.plus({ days: index }).toISODate()!
    const [item] = (await db
      .table('calendar_items')
      .insert({
        package_id: pkg.id,
        item_key: `CAL-SCH-T${unique()}`,
        shape: 'list',
        force: 'free',
        origin: 'school',
        match_key: `${date}|${title}`,
        kind: 'school_event',
        title,
        starts_on: date,
        ends_on: date,
        created_at: now,
        updated_at: now,
      })
      .returning('id')) as { id: number }[]
    itemIds.push(Number(item.id))
  }
  return { packageId: Number(pkg.id), itemIds, schoolYear }
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
