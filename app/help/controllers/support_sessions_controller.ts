import type { HttpContext } from '@adonisjs/core/http'
import { authorizeStaff } from '#staff/access'
import { SUPPORT_SESSION_HOURS } from '../catalog.js'
import {
  endSupportSession,
  listSupportSessions,
  openSupportSessionOf,
  readSchoolView,
  startSupportSession,
} from '../support_sessions.js'
import { supportSessionListValidator } from '../validators.js'

const PER_PAGE = 50

/** A date or timestamp column as an ISO string (dates stay YYYY-MM-DD). */
function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

/** A `date` column as YYYY-MM-DD in WIB terms. */
function isoDate(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Date) {
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
    return local.toISOString().slice(0, 10)
  }
  return null
}

/**
 * Konsol: support sessions (R2-06, D-341, D-469). "Lihat sekolah ini"
 * (`support_sessions.start`, within the area scope) opens a session and
 * the read-only school view at /lihat-sekolah; "Akhiri" closes it; a
 * session times out after two hours. The internal list of sessions is
 * `support_sessions.view` (owner, admin). Nothing here is shown to the
 * school.
 */
export default class SupportSessionsController {
  async start(ctx: HttpContext) {
    const schoolId = Number(ctx.params.school)
    const staff = await authorizeStaff(ctx, 'support_sessions.start', schoolId)
    await startSupportSession(staff, schoolId)
    return ctx.response.redirect().toPath('/lihat-sekolah')
  }

  async show(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'support_sessions.start')
    const session = await openSupportSessionOf(staff.id)
    if (!session) {
      ctx.session.flash('error', ctx.i18n.t('help.support.none'))
      return ctx.response.redirect().toPath('/sekolah')
    }
    // The scope may have changed since the session began.
    await authorizeStaff(ctx, 'support_sessions.start', session.schoolId)
    const view = await readSchoolView(session.schoolId)

    return ctx.inertia.render('console/support_view', {
      session: {
        id: session.id,
        startedAt: session.startedAt.toISO()!,
        expiresAt: session.expiresAt.toISO()!,
        hours: SUPPORT_SESSION_HOURS,
      },
      school: {
        id: Number(view.school.id),
        name: view.school.name,
        npsn: view.school.npsn,
        level: view.school.level,
        address: view.school.address,
        regionName: view.school.regency_name,
        regionKind: view.school.regency_kind ?? 'kabupaten',
        districtName: view.school.district_name,
      },
      members: view.members.map((row: Record<string, any>) => ({
        publicId: row.public_id,
        name: row.name,
        email: row.email,
        role: row.role,
        status: row.status,
        startedOn: isoDate(row.started_on),
      })),
      years: view.years.map((row: Record<string, any>) => ({
        publicId: row.public_id,
        name: row.name,
        startsOn: isoDate(row.starts_on),
        endsOn: isoDate(row.ends_on),
        closed: row.closed_at !== null,
      })),
      classes: view.classes.map((row: Record<string, any>) => ({
        publicId: row.public_id,
        grade: Number(row.grade),
        name: row.name,
        yearName: row.year_name,
        homeroomName: row.homeroom_name,
        assignments: Number(row.assignments),
      })),
      events: view.events.map((row: Record<string, any>) => ({
        id: Number(row.id),
        title: row.title,
        startsOn: isoDate(row.starts_on),
        endsOn: isoDate(row.ends_on),
      })),
    })
  }

  async end(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'support_sessions.start')
    const ended = await endSupportSession(staff)
    if (ended) ctx.session.flash('success', ctx.i18n.t('help.support.ended'))
    return ctx.response.redirect().toPath(ended ? `/sekolah/${ended.schoolId}` : '/sekolah')
  }

  async index(ctx: HttpContext) {
    await authorizeStaff(ctx, 'support_sessions.view')
    const { halaman } = await supportSessionListValidator.validate(ctx.request.qs())
    const page = halaman ?? 1
    const { total, rows } = await listSupportSessions(page, PER_PAGE)
    return ctx.inertia.render('console/support_sessions', {
      page,
      lastPage: Math.max(1, Math.ceil(total / PER_PAGE)),
      total,
      sessions: rows.map((row) => ({
        id: Number(row.id),
        staffName: row.staff_name,
        schoolId: Number(row.school_id),
        schoolName: row.school_name,
        startedAt: iso(row.started_at)!,
        endedAt: iso(row.ended_at),
      })),
    })
  }
}
