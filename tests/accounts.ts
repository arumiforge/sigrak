import type { ApiClient, ApiResponse } from '@japa/api-client'
import mail from '@adonisjs/mail/services/main'
import type { BaseMail } from '@adonisjs/mail'
import { hosts, type Area } from '#config/hosts'
import { sessionCookieNames } from '#config/session'
import type { ActionMail } from '#mails/action_mail'
import StaffUser, { type StaffRole } from '#models/staff_user'
import db from '@adonisjs/lucid/services/db'
import Invitation from '#models/invitation'
import type School from '#models/school'
import type SchoolMembership from '#models/school_membership'
import { PASSWORD, login, visit } from '#tests/helpers'
import { createMember } from '#tests/tenancy'

/**
 * Test helpers for accounts (R1-05): a fake mailer, signed-in sessions
 * that can post forms, and the token out of a queued mail.
 */

/**
 * Swaps in the fake mailer for one test; returns it and the restore
 * function (use it as a Japa cleanup). Nothing is ever sent.
 */
export function fakeMail() {
  const fake = mail.fake()
  return { fake, restore: () => mail.restore() }
}

/** The link token at the end of the button URL of a queued mail. */
export function tokenOf(queued: BaseMail) {
  const url = (queued as ActionMail).content.action.url
  return url.split('/').pop()!
}

export type Session = { area: Area; sessionId: string }

/**
 * A session on an area: the cookie a test sends back on each request.
 */
export function cookieOf(session: Session) {
  return { name: sessionCookieNames[session.area], sessionId: session.sessionId }
}

/**
 * Signs in through the real form; fails the test when it does not land
 * on the area's home.
 */
export async function signIn(
  client: ApiClient,
  area: Area,
  email: string,
  password = PASSWORD
): Promise<Session> {
  const { sessionId, response } = await login(client, area, { email, password })
  if (response.header('location') === '/masuk' || !sessionId) {
    throw new Error(`Sign-in of ${email} on ${area} failed`)
  }
  return { area, sessionId }
}

/**
 * A guest session on app. (GET /masuk), for the forms that work
 * without signing in.
 */
export async function guest(client: ApiClient, area: Area = 'app', path = '/masuk') {
  const page = await visit(client, area, path)
  return { area, sessionId: page.cookie(sessionCookieNames[area])!.value as string } as Session
}

/**
 * POSTs a form as a browser would: reads the CSRF token from a GET of
 * `csrfFrom` in the same session, then posts. Returns the response and
 * the session (its id may change, e.g. after signing in).
 */
export async function postForm(
  client: ApiClient,
  session: Session,
  path: string,
  data: Record<string, string | number>,
  csrfFrom = path
): Promise<{ response: ApiResponse; session: Session }> {
  const page = await visit(client, session.area, csrfFrom, cookieOf(session))
  const csrfToken = page.cookie('XSRF-TOKEN')?.value as string | undefined
  if (!csrfToken) throw new Error(`No CSRF cookie from ${csrfFrom}`)
  const sessionId =
    (page.cookie(sessionCookieNames[session.area])?.value as string) ?? session.sessionId

  const response = await client
    .post(path)
    .header('host', hosts[session.area])
    .header('x-csrf-token', csrfToken)
    .withCookie(sessionCookieNames[session.area], sessionId)
    .form(data)
    .redirects(0)
  const next = (response.cookie(sessionCookieNames[session.area])?.value as string) ?? sessionId
  return { response, session: { area: session.area, sessionId: next } }
}

/**
 * The Inertia page at `path` in a session (props, flash).
 */
export async function inertiaPage(client: ApiClient, session: Session, path: string) {
  const page = await visit(client, session.area, path, cookieOf(session)).withInertia()
  return page
}

let counter = 0

export async function createStaffWithRole(role: StaffRole) {
  return StaffUser.create({
    name: `Staf ${role}`,
    email: `staf-${role}-${Date.now().toString(36)}${(counter++).toString(36)}@uji.test`,
    password: PASSWORD,
    role,
  })
}

/** The user of a new membership in `school` (owner connection). */
export async function memberUser(school: School, role: SchoolMembership['role'] = 'teacher') {
  const { user } = await createMember(school, role)
  return user
}

/** A signed-in session of a new member of `school`. */
export async function signInMember(
  client: ApiClient,
  school: School,
  role: SchoolMembership['role']
) {
  const user = await memberUser(school, role)
  return signIn(client, 'app', user.email)
}

/** Every invitation of every school, read past both walls (owner connection). */
export async function allInvitations() {
  return Invitation.withoutSchoolScope({ client: db.connection() })
}
