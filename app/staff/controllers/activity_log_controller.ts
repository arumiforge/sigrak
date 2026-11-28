import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import aiConfig from '#config/ai'
import { problemNumber } from '#problems/catalog'
import { authorizeStaff } from '../access.js'
import { activityFilterValidator } from '../validators.js'

const PER_PAGE = 50
const ZONE = 'Asia/Jakarta'
const AI_PURPOSES = Object.keys(aiConfig.purposes)

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
 * Ability `audit.view`. The subject is named where the log can name
 * it (see #subjectNames); the rest shows its type and id.
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

    const names = await this.#subjectNames(rows, (key, data) => ctx.i18n.t(key, data))
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

  /**
   * Names of the subjects on this page, by "type:id": the row's name or
   * title where one exists (staff, schools, users, R2 content, problems,
   * curriculum versions, the school of a support session), a label for
   * keyed subjects (settings, integrations, AI purposes). A subject that
   * was removed since keeps its type and id.
   */
  async #subjectNames(rows: LogRow[], t: Translate) {
    const names = new Map<string, string>()
    const idsOf = (type: string) =>
      [
        ...new Set(
          rows.filter((row) => row.subject_type === type).map((row) => Number(row.subject_id))
        ),
      ].filter((id) => Number.isSafeInteger(id))

    for (const [type, query] of Object.entries(SUBJECT_QUERIES)) {
      const ids = idsOf(type)
      if (ids.length === 0) continue
      const found = (await query(ids)) as SubjectRow[]
      for (const row of found) {
        const name = nameOf(type, row, t)
        if (name) names.set(`${type}:${row.id}`, name)
      }
    }

    for (const row of rows) {
      const label = keyedLabel(row.subject_type, row.subject_id)
      if (label) names.set(`${row.subject_type}:${row.subject_id}`, t(label))
    }
    return names
  }
}

type Translate = (key: string, data?: Record<string, unknown>) => string

type SubjectRow = {
  id: number
  name?: string | null
  title?: string | null
  code?: string | null
  version?: number | null
  held_on?: Date | string | null
}

/** One query per numeric subject type; each row carries `id`. */
const SUBJECT_QUERIES: Record<string, (ids: number[]) => Promise<unknown[]>> = {
  staff: (ids) => db.from('staff_users').whereIn('id', ids).select('id', 'name'),
  school: (ids) => db.from('schools').whereIn('id', ids).select('id', 'name'),
  user: (ids) => db.from('users').whereIn('id', ids).select('id', 'name'),
  announcement: (ids) => db.from('announcements').whereIn('id', ids).select('id', 'title'),
  event: (ids) => db.from('events').whereIn('id', ids).select('id', 'title'),
  story: (ids) => db.from('stories').whereIn('id', ids).select('id', 'title'),
  good_practice: (ids) => db.from('good_practices').whereIn('id', ids).select('id', 'title'),
  problem: (ids) => db.from('problems').whereIn('id', ids).select('id', 'title'),
  legal_document: (ids) =>
    db.from('legal_documents').whereIn('id', ids).select('id', 'title', 'version'),
  curriculum_version: (ids) =>
    db.from('curriculum_versions').whereIn('id', ids).select('id', 'name', 'code'),
  forum_meeting: (ids) => db.from('forum_meetings').whereIn('id', ids).select('id', 'held_on'),
  support_session: (ids) =>
    db
      .from('support_sessions as ss')
      .join('schools as sc', 'sc.id', 'ss.school_id')
      .whereIn('ss.id', ids)
      .select('ss.id', 'sc.name'),
  // Help requests carry a user's message, so only their number shows.
  help_request: async (ids) => ids.map((id) => ({ id })),
}

function nameOf(type: string, row: SubjectRow, t: Translate) {
  switch (type) {
    case 'problem':
      return `${problemNumber(Number(row.id))} ${row.title ?? ''}`.trim()
    case 'legal_document':
      return t('staff.audit.subject_names.legal_document', {
        title: row.title ?? '',
        version: row.version ?? '',
      })
    case 'curriculum_version':
      return row.code ? `${row.name ?? ''} (${row.code})`.trim() : (row.name ?? null)
    case 'forum_meeting': {
      if (!row.held_on) return null
      const day =
        row.held_on instanceof Date
          ? DateTime.fromJSDate(row.held_on, { zone: ZONE })
          : DateTime.fromISO(String(row.held_on), { zone: ZONE })
      return t('staff.audit.subject_names.forum_meeting', {
        date: day.setLocale('id').toFormat('d LLLL yyyy'),
      })
    }
    case 'help_request':
      return t('staff.audit.subject_names.help_request', { id: row.id })
    default:
      return row.name ?? row.title ?? null
  }
}

/** Lang keys for subjects logged by key rather than by row id. */
const KEYED_LABELS: Record<string, Record<string, string>> = {
  setting: {
    'trial.default_days': 'console.settings.trial_title',
    'trial.extend_max_days': 'console.settings.extend_title',
  },
  integration: {
    mail: 'integrations.mail.title',
    chatbot: 'integrations.chatbot.title',
    storage: 'integrations.storage.title',
    ai_team_key: 'integrations.team_key.title',
  },
}

function keyedLabel(type: string, id: string) {
  if (type === 'ai_model') {
    return AI_PURPOSES.includes(id) ? `integrations.models.purposes.${id}` : null
  }
  return KEYED_LABELS[type]?.[id] ?? null
}
