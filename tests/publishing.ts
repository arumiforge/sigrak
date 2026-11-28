import type { ApiClient } from '@japa/api-client'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { hosts, publicHost } from '#config/hosts'
import { sessionCookieNames } from '#config/session'
import Announcement from '#models/announcement'
import Region from '#models/region'
import School from '#models/school'
import { seedRegionList } from '#regions/region_list'
import { cookieOf, type Session } from '#tests/accounts'
import { testRegions, visit } from '#tests/helpers'

/**
 * Test helpers for Kabar, Acara, Cerita Sekolah and the legal pages
 * (R2-05).
 */

/**
 * Two kabupaten in Jawa Tengah: Kabupaten Uji (33.99, with Kecamatan
 * Uji) from testRegions and Kabupaten Uji Dua (33.98, with Kecamatan
 * Uji Dua). Invented codes, not real Kemendagri codes.
 */
export async function twoRegencies() {
  const first = await testRegions()
  await seedRegionList(db.connection(), {
    kemendagriCode: '33',
    dapodikCode: '030000',
    name: 'Jawa Tengah',
    children: [
      {
        kemendagriCode: '33.98',
        name: 'Uji Dua',
        regencyKind: 'kabupaten',
        children: [{ kemendagriCode: '33.98.01', name: 'Uji Dua' }],
      },
    ],
  })
  return {
    ...first,
    otherRegency: await Region.findByOrFail('kemendagriCode', '33.98'),
    otherDistrict: await Region.findByOrFail('kemendagriCode', '33.98.01'),
  }
}

export async function schoolIn(
  name: string,
  regency: Region,
  district: Region,
  level: 'sd' | 'mi' = 'sd'
) {
  return School.create({
    name,
    level,
    regionId: regency.id,
    districtId: district.id,
    district: district.name,
    address: 'Jalan Uji',
  })
}

type AnnouncementFields = Partial<
  Pick<
    Announcement,
    | 'kind'
    | 'showInApp'
    | 'showPublic'
    | 'targetRegionIds'
    | 'targetSchoolIds'
    | 'targetLevels'
    | 'targetRoles'
    | 'startsAt'
    | 'endsAt'
    | 'status'
    | 'summary'
    | 'body'
  >
>

let counter = 0

/** A Kabar written straight to the table (published unless asked otherwise). */
export async function createAnnouncement(title: string, fields: AnnouncementFields = {}) {
  const status = fields.status ?? 'published'
  return Announcement.create({
    slug: `kabar-uji-${Date.now().toString(36)}-${counter++}`,
    title,
    summary: null,
    body: `Isi ${title}`,
    kind: 'general',
    showInApp: true,
    showPublic: false,
    targetRegionIds: [],
    targetSchoolIds: [],
    targetLevels: [],
    targetRoles: [],
    startsAt: null,
    endsAt: null,
    ...fields,
    status,
    publishedAt: status === 'published' ? DateTime.now().minus({ minutes: 5 }) : null,
  })
}

/** POSTs JSON as Inertia does, with the CSRF token from a GET of `csrfFrom`. */
export async function postJson(
  client: ApiClient,
  session: Session,
  path: string,
  data: Record<string, unknown>,
  csrfFrom = '/'
) {
  const page = await visit(client, session.area, csrfFrom, cookieOf(session))
  const csrfToken = page.cookie('XSRF-TOKEN')?.value as string | undefined
  if (!csrfToken) throw new Error(`No CSRF cookie from ${csrfFrom}`)
  const sessionId =
    (page.cookie(sessionCookieNames[session.area])?.value as string) ?? session.sessionId
  return client
    .post(path)
    .header('host', hosts[session.area])
    .header('x-csrf-token', csrfToken)
    .withCookie(sessionCookieNames[session.area], sessionId)
    .json(data)
    .redirects(0)
}

/** A GET on sigrak.com (the bare domain). */
export function visitPublic(client: ApiClient, path: string) {
  return client.get(path).header('host', publicHost).redirects(0)
}

/** The status of a GET on sigrak.com. */
export async function publicStatus(client: ApiClient, path: string) {
  const response = await visitPublic(client, path)
  return response.status()
}
