import type { HttpContext } from '@adonisjs/core/http'
import {
  applySchoolScope,
  authorizeStaff,
  schoolScopeOf,
  staffCan,
  StaffForbiddenException,
  withinScope,
} from '#staff/access'
import type { StaffAbility } from '#staff/abilities'
import type StaffUser from '#models/staff_user'
import { staffReadTransaction } from '#tenancy/tenant_transaction'
import { HELP_CATEGORIES, HELP_STATUSES, SUPPORT_SESSION_HOURS } from '../catalog.js'
import {
  addHelpNote,
  assignHelpRequestToSelf,
  changeHelpStatus,
  HelpRequestNotFoundException,
  replyToHelpRequest,
  staffReaches,
} from '../help_requests.js'
import { PROBLEM_HOOK_READY } from '../problem_hook.js'
import {
  helpFilterValidator,
  helpNoteValidator,
  helpReplyValidator,
  helpStatusValidator,
} from '../validators.js'

const PER_PAGE = 50

const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null)

/**
 * Konsol: Permintaan bantuan (R2-06, D-320). Abilities:
 * `help_requests.view` for the list and a request, `help_requests.
 * manage` to reply, add an internal note, change the status and take
 * a request (app/staff/powers.ts). Both follow the staff member's area
 * scope: a request of a school outside it is a 403, a request without
 * a school is only for unlimited scopes. Reads run as read-only staff;
 * changes in help_requests.ts as staff, logged.
 */
export default class ConsoleHelpRequestsController {
  async index(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'help_requests.view')
    const filters = await helpFilterValidator.validate(ctx.request.qs())
    const page = filters.halaman ?? 1
    const scope = schoolScopeOf(staff, 'help_requests.view')

    const data = await staffReadTransaction(async (trx) => {
      const base = () => {
        const query = trx.from('help_requests as h').leftJoin('schools as s', 's.id', 'h.school_id')
        if (!scope.all) {
          query.whereNotNull('h.school_id')
          applySchoolScope(query, scope, 's')
        }
        return query
      }

      // Kabupaten/kota that have requests inside the scope: the region filter's choices.
      const regionRows = (await base()
        .join('regions as r', 'r.id', 's.region_id')
        .distinct('r.id', 'r.name', 'r.regency_kind')
        .orderBy('r.name', 'asc')
        .limit(300)) as { id: number; name: string; regency_kind: string | null }[]
      const regionIds = new Set(regionRows.map((row) => Number(row.id)))
      const region = filters.wilayah && regionIds.has(filters.wilayah) ? filters.wilayah : null

      const query = base()
      if (filters.status) query.where('h.status', filters.status)
      if (filters.jenis) query.where('h.category', filters.jenis)
      if (region) query.where('s.region_id', region)
      if (filters.petugas === 'saya') query.where('h.assignee_staff_id', staff.id)
      if (filters.petugas === 'kosong') query.whereNull('h.assignee_staff_id')

      const total = Number(
        ((await query.clone().count('* as count').first()) as { count: string }).count
      )
      const rows = (await query
        .leftJoin('users as u', 'u.id', 'h.user_id')
        .leftJoin('staff_users as a', 'a.id', 'h.assignee_staff_id')
        .orderByRaw(`CASE h.status WHEN 'new' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END`)
        .orderBy('h.created_at', 'desc')
        .orderBy('h.id', 'desc')
        .limit(PER_PAGE)
        .offset((page - 1) * PER_PAGE)
        .select(
          'h.id',
          'h.category',
          'h.status',
          'h.message',
          'h.created_at',
          'h.membership_role',
          's.name as school_name',
          'u.name as sender_name',
          'a.name as assignee_name'
        )) as {
        id: number
        category: string
        status: string
        message: string
        created_at: Date
        membership_role: string | null
        school_name: string | null
        sender_name: string | null
        assignee_name: string | null
      }[]
      return { total, rows, regionRows, region }
    })

    return ctx.inertia.render('console/help_requests', {
      filters: {
        status: filters.status ?? '',
        category: filters.jenis ?? '',
        region: data.region,
        assignee: filters.petugas ?? '',
      },
      page,
      lastPage: Math.max(1, Math.ceil(data.total / PER_PAGE)),
      total: data.total,
      requests: data.rows.map((row) => ({
        id: Number(row.id),
        category: row.category,
        status: row.status,
        excerpt: row.message.length > 120 ? `${row.message.slice(0, 117)}…` : row.message,
        createdAt: iso(row.created_at)!,
        senderRole: row.membership_role,
        senderName: row.sender_name,
        schoolName: row.school_name,
        assigneeName: row.assignee_name,
      })),
      regions: data.regionRows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        kind: row.regency_kind ?? 'kabupaten',
      })),
      categories: [...HELP_CATEGORIES],
      statuses: [...HELP_STATUSES],
    })
  }

  async show(ctx: HttpContext) {
    const requestId = Number(ctx.params.request)
    const staff = await this.#authorize(ctx, 'help_requests.view', requestId)

    const data = await staffReadTransaction(async (trx) => {
      const request = (await trx
        .from('help_requests as h')
        .leftJoin('schools as s', 's.id', 'h.school_id')
        .leftJoin('regions as r', 'r.id', 's.region_id')
        .leftJoin('users as u', 'u.id', 'h.user_id')
        .leftJoin('staff_users as a', 'a.id', 'h.assignee_staff_id')
        .where('h.id', requestId)
        .select(
          'h.id',
          'h.category',
          'h.status',
          'h.message',
          'h.page_url',
          'h.created_at',
          'h.status_changed_at',
          'h.membership_role',
          'h.school_id',
          'h.assignee_staff_id',
          's.name as school_name',
          's.npsn as school_npsn',
          'r.name as region_name',
          'r.regency_kind',
          'u.name as sender_name',
          'u.email as sender_email',
          'a.name as assignee_name'
        )
        .first()) as Record<string, any> | undefined
      if (!request) throw new HelpRequestNotFoundException()
      const notes = (await trx
        .from('help_request_notes as n')
        .leftJoin('staff_users as st', 'st.id', 'n.staff_user_id')
        .where('n.help_request_id', requestId)
        .orderBy('n.created_at', 'asc')
        .orderBy('n.id', 'asc')
        .select(
          'n.id',
          'n.kind',
          'n.body',
          'n.status',
          'n.emailed',
          'n.created_at',
          'st.name'
        )) as {
        id: number
        kind: string
        body: string | null
        status: string | null
        emailed: boolean
        created_at: Date
        name: string | null
      }[]
      return { request, notes }
    })

    const { request, notes } = data
    const schoolId = request.school_id === null ? null : Number(request.school_id)
    const canManage = staffCan(staff, 'help_requests.manage')
      ? await staffReaches(staff, 'help_requests.manage', { schoolId })
      : false

    return ctx.inertia.render('console/help_request', {
      request: {
        id: Number(request.id),
        category: request.category,
        status: request.status,
        message: request.message,
        pageUrl: request.page_url,
        createdAt: iso(request.created_at)!,
        statusChangedAt: iso(request.status_changed_at)!,
        senderRole: request.membership_role,
        senderName: request.sender_name,
        senderEmail: request.sender_email,
        school: schoolId
          ? {
              id: schoolId,
              name: request.school_name,
              npsn: request.school_npsn,
              regionName: request.region_name,
              regionKind: request.regency_kind ?? 'kabupaten',
            }
          : null,
        assigneeName: request.assignee_name,
        assignedToMe: Number(request.assignee_staff_id) === staff.id,
      },
      notes: notes.map((note) => ({
        id: Number(note.id),
        kind: note.kind as 'reply' | 'note' | 'status',
        body: note.body,
        status: note.status,
        emailed: note.emailed,
        at: iso(note.created_at)!,
        staffName: note.name,
      })),
      statuses: [...HELP_STATUSES],
      supportSessionHours: SUPPORT_SESSION_HOURS,
      can: {
        manage: canManage,
        openSchool:
          schoolId !== null && staffCan(staff, 'support_sessions.start')
            ? await withinScope(staff, 'support_sessions.start', schoolId)
            : false,
        viewSchool:
          schoolId !== null && staffCan(staff, 'schools.view')
            ? await withinScope(staff, 'schools.view', schoolId)
            : false,
        toProblem: PROBLEM_HOOK_READY && staffCan(staff, 'problems.record'),
      },
    })
  }

  async reply(ctx: HttpContext) {
    const requestId = Number(ctx.params.request)
    const staff = await this.#authorize(ctx, 'help_requests.manage', requestId)
    const input = await ctx.request.validateUsing(helpReplyValidator)
    await replyToHelpRequest({ staff, requestId }, input)
    ctx.session.flash(
      'success',
      ctx.i18n.t(input.email ? 'help.console.replied_mailed' : 'help.console.replied')
    )
    return ctx.response.redirect().toPath(`/bantuan/${requestId}`)
  }

  async note(ctx: HttpContext) {
    const requestId = Number(ctx.params.request)
    const staff = await this.#authorize(ctx, 'help_requests.manage', requestId)
    const { body } = await ctx.request.validateUsing(helpNoteValidator)
    await addHelpNote({ staff, requestId }, body)
    ctx.session.flash('success', ctx.i18n.t('help.console.noted'))
    return ctx.response.redirect().toPath(`/bantuan/${requestId}`)
  }

  async status(ctx: HttpContext) {
    const requestId = Number(ctx.params.request)
    const staff = await this.#authorize(ctx, 'help_requests.manage', requestId)
    const { status } = await ctx.request.validateUsing(helpStatusValidator)
    await changeHelpStatus({ staff, requestId }, status)
    ctx.session.flash(
      'success',
      ctx.i18n.t('help.console.status_saved', { status: ctx.i18n.t(`help.statuses.${status}`) })
    )
    return ctx.response.redirect().toPath(`/bantuan/${requestId}`)
  }

  async assign(ctx: HttpContext) {
    const requestId = Number(ctx.params.request)
    const staff = await this.#authorize(ctx, 'help_requests.manage', requestId)
    await assignHelpRequestToSelf({ staff, requestId })
    ctx.session.flash('success', ctx.i18n.t('help.console.assigned'))
    return ctx.response.redirect().toPath(`/bantuan/${requestId}`)
  }

  /**
   * The staff member when `ability` reaches the request's school (403
   * otherwise, 404 for an unknown request). The request's school is
   * read as read-only staff only to decide.
   */
  async #authorize(ctx: HttpContext, ability: StaffAbility, requestId: number): Promise<StaffUser> {
    const staff = await authorizeStaff(ctx, ability)
    const row = await staffReadTransaction((trx) =>
      trx.from('help_requests').where('id', requestId).select('school_id').first()
    )
    if (!row) throw new HelpRequestNotFoundException()
    const schoolId = row.school_id === null ? null : Number(row.school_id)
    if (!(await staffReaches(staff, ability, { schoolId }))) throw new StaffForbiddenException()
    return staff
  }
}
