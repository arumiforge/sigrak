import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { authorizeStaff } from '../access.js'
import { activityFilterValidator } from '../validators.js'

const PER_PAGE = 50
const ZONE = 'Asia/Jakarta'

type LogRow = {
  id: number
  action: string
  subject_type: string
  subject_id: string
  changes: Record<string, unknown>
  created_at: Date
  staff_user_id: number | null
  staff_name: string | null
}

/**
 * Konsol: Log aktivitas (R2-01). Every logged staff change, newest
 * first, filtered by staff member, action and date (WIB days).
 * Ability `audit.view`. The subject is named where it is a staff
 * member, a school or a school user; the rest shows its type and id.
 * Read-only: nobody edits or deletes log rows from the console.
 */
export default class ActivityLogController {
  async index(ctx: HttpContext) {
    await authorizeStaff(ctx, 'audit.view')
    const filters = await ctx.request.validateUsing(activityFilterValidator, {
      data: ctx.request.qs(),
    })
    const page = filters.halaman ?? 1

    const query = db
      .from('staff_activity_logs as l')
      .leftJoin('staff_users as s', 's.id', 'l.staff_user_id')
      .orderBy('l.created_at', 'desc')
      .orderBy('l.id', 'desc')
    if (filters.staf) query.where('l.staff_user_id', filters.staf)
    if (filters.aksi) query.where('l.action', filters.aksi)
    const from = filters.dari ? DateTime.fromISO(filters.dari, { zone: ZONE }) : null
    const to = filters.sampai ? DateTime.fromISO(filters.sampai, { zone: ZONE }) : null
    if (from?.isValid) query.where('l.created_at', '>=', from.startOf('day').toJSDate())
    if (to?.isValid)
      query.where('l.created_at', '<', to.plus({ days: 1 }).startOf('day').toJSDate())

    const total = Number(
      ((await query.clone().clearOrder().count('* as count').first()) as { count: string }).count
    )
    const rows = (await query
      .select(
        'l.id',
        'l.action',
        'l.subject_type',
        'l.subject_id',
        'l.changes',
        'l.created_at',
        'l.staff_user_id',
        's.name as staff_name'
      )
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE)) as LogRow[]

    const names = await this.#subjectNames(rows)
    const staffOptions = await db.from('staff_users').orderBy('name', 'asc').select('id', 'name')
    const actions = await db
      .from('staff_activity_logs')
      .distinct('action')
      .orderBy('action', 'asc')
      .limit(200)

    return ctx.inertia.render('console/activity_log', {
      filters: {
        staff: filters.staf ?? null,
        action: filters.aksi ?? '',
        from: filters.dari ?? '',
        to: filters.sampai ?? '',
      },
      page,
      lastPage: Math.max(1, Math.ceil(total / PER_PAGE)),
      total,
      entries: rows.map((row) => ({
        id: Number(row.id),
        at: new Date(row.created_at).toISOString(),
        staff: row.staff_name,
        action: row.action,
        subjectType: row.subject_type,
        subjectId: row.subject_id,
        subjectName: names.get(`${row.subject_type}:${row.subject_id}`) ?? null,
        role: typeof row.changes?.role === 'string' ? row.changes.role : null,
        details:
          row.changes && Object.keys(row.changes).length > 0
            ? JSON.stringify(row.changes, null, 2)
            : null,
      })),
      staffOptions: staffOptions.map((row: { id: number; name: string }) => ({
        id: Number(row.id),
        name: row.name,
      })),
      actions: actions.map((row: { action: string }) => row.action),
    })
  }

  /** Names of the staff members, schools and users on this page, by "type:id". */
  async #subjectNames(rows: LogRow[]) {
    const names = new Map<string, string>()
    const idsOf = (type: string) =>
      [
        ...new Set(
          rows.filter((row) => row.subject_type === type).map((row) => Number(row.subject_id))
        ),
      ].filter((id) => Number.isSafeInteger(id))
    const tables = [
      ['staff', 'staff_users'],
      ['school', 'schools'],
      ['user', 'users'],
    ] as const
    for (const [type, table] of tables) {
      const ids = idsOf(type)
      if (ids.length === 0) continue
      const found = await db.from(table).whereIn('id', ids).select('id', 'name')
      for (const row of found as { id: number; name: string }[]) {
        names.set(`${type}:${row.id}`, row.name)
      }
    }
    return names
  }
}
