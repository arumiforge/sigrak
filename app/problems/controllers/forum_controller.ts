import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { authorizeStaff, staffCan } from '#staff/access'
import { staffReadTransaction } from '#tenancy/tenant_transaction'
import { AGENDA_STATUSES, FORUM_OUTCOMES, problemNumber } from '../catalog.js'
import {
  addToAgenda,
  ForumChangeRefusedException,
  ForumMeetingNotFoundException,
  markHeld,
  moveOnAgenda,
  planMeeting,
  recordDecision,
  removeFromAgenda,
  updateMeeting,
} from '../forum.js'
import { ProblemChangeRefusedException } from '../problems.js'
import {
  agendaMoveValidator,
  agendaValidator,
  decisionValidator,
  meetingUpdateValidator,
  meetingValidator,
} from '../validators.js'

const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null)
const dateOnly = (value: DateTime) => value.toISODate()!

/**
 * Konsol: Forum Masalah→Solusi (R2-07, D-439). `forum.view` reads the
 * meetings, agendas and decisions (all three teams); `forum.manage`
 * plans a meeting, builds the agenda from analysed problems, orders
 * it, writes the notes and closes the meeting; `problems.decide` (the
 * owner) records the decision on each item. Reads as read-only staff;
 * changes in forum.ts, logged.
 */
export default class ForumController {
  async index(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'forum.view')
    const meetings = (await staffReadTransaction((trx) =>
      trx
        .from('forum_meetings as m')
        .orderBy('m.held_on', 'desc')
        .orderBy('m.id', 'desc')
        .limit(100)
        .select(
          'm.id',
          'm.held_on',
          'm.status',
          trx.raw('(SELECT count(*) FROM forum_decisions d WHERE d.meeting_id = m.id) AS items'),
          trx.raw(
            '(SELECT count(*) FROM forum_decisions d WHERE d.meeting_id = m.id AND d.outcome IS NULL) AS open_items'
          )
        )
    )) as { id: number; held_on: string; status: string; items: string; open_items: string }[]
    const waiting = (await staffReadTransaction((trx) =>
      trx
        .from('problems')
        .whereIn('status', [...AGENDA_STATUSES])
        .count('* as count')
        .first()
    )) as { count: string }

    return ctx.inertia.render('console/forum_meetings', {
      meetings: meetings.map((row) => ({
        id: Number(row.id),
        heldOn: String(row.held_on),
        status: row.status,
        items: Number(row.items),
        openItems: Number(row.open_items),
      })),
      waiting: Number(waiting.count),
      today: DateTime.now().setZone('Asia/Jakarta').toISODate()!,
      can: { manage: staffCan(staff, 'forum.manage') },
    })
  }

  async store(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'forum.manage')
    const { held_on: heldOn } = await ctx.request.validateUsing(meetingValidator)
    const id = await planMeeting(staff, dateOnly(heldOn))
    ctx.session.flash('success', ctx.i18n.t('problems.forum.flash.planned'))
    return ctx.response.redirect().toPath(`/forum/${id}`)
  }

  async show(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'forum.view')
    const meetingId = Number(ctx.params.meeting)

    const data = await staffReadTransaction(async (trx) => {
      const meeting = (await trx
        .from('forum_meetings as m')
        .leftJoin('staff_users as st', 'st.id', 'm.created_by_staff_id')
        .where('m.id', meetingId)
        .select('m.*', 'st.name as created_by')
        .first()) as Record<string, any> | undefined
      if (!meeting) throw new ForumMeetingNotFoundException()
      const items = (await trx
        .from('forum_decisions as d')
        .join('problems as p', 'p.id', 'd.problem_id')
        .leftJoin('staff_users as st', 'st.id', 'd.decided_by_staff_id')
        .where('d.meeting_id', meetingId)
        .orderBy('d.position', 'asc')
        .select(
          'd.problem_id',
          'd.position',
          'd.outcome',
          'd.note',
          'd.decided_at',
          'p.title',
          'p.status',
          'st.name as decided_by',
          trx.raw(
            '(SELECT count(*) FROM problem_reports pr WHERE pr.problem_id = p.id) AS reports'
          ),
          trx.raw('(SELECT count(*) FROM problem_analyses a WHERE a.problem_id = p.id) AS analyses')
        )) as Record<string, any>[]
      const candidates =
        meeting.status === 'planned'
          ? ((await trx
              .from('problems as p')
              .whereIn('p.status', [...AGENDA_STATUSES])
              .whereNull('p.merged_into_id')
              .whereNotExists((sub) =>
                sub
                  .from('forum_decisions as d')
                  .whereColumn('d.problem_id', 'p.id')
                  .where('d.meeting_id', meetingId)
              )
              .orderBy('p.status_changed_at', 'asc')
              .limit(100)
              .select('p.id', 'p.title')) as { id: number; title: string }[])
          : []
      return { meeting, items, candidates }
    })

    const { meeting } = data
    const planned = meeting.status === 'planned'
    return ctx.inertia.render('console/forum_meeting', {
      meeting: {
        id: Number(meeting.id),
        heldOn: String(meeting.held_on),
        status: meeting.status,
        notes: meeting.notes,
        heldAt: iso(meeting.held_at),
        createdBy: meeting.created_by ?? null,
      },
      items: data.items.map((item) => ({
        problemId: Number(item.problem_id),
        number: problemNumber(Number(item.problem_id)),
        title: item.title,
        problemStatus: item.status,
        reports: Number(item.reports),
        analyses: Number(item.analyses),
        outcome: item.outcome,
        note: item.note,
        decidedBy: item.decided_by ?? null,
        decidedAt: iso(item.decided_at),
      })),
      candidates: data.candidates.map((row) => ({
        id: Number(row.id),
        number: problemNumber(Number(row.id)),
        title: row.title,
      })),
      outcomes: [...FORUM_OUTCOMES],
      can: {
        manage: planned && staffCan(staff, 'forum.manage'),
        notes: staffCan(staff, 'forum.manage'),
        decide: planned && staffCan(staff, 'problems.decide'),
        viewProblems: staffCan(staff, 'problems.view'),
      },
    })
  }

  async update(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'forum.manage')
    const meetingId = Number(ctx.params.meeting)
    const input = await ctx.request.validateUsing(meetingUpdateValidator)
    await updateMeeting(staff, meetingId, {
      heldOn: dateOnly(input.held_on),
      notes: input.notes || null,
    })
    ctx.session.flash('success', ctx.i18n.t('problems.forum.flash.saved'))
    return ctx.response.redirect().toPath(`/forum/${meetingId}`)
  }

  async addItem(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'forum.manage')
    const meetingId = Number(ctx.params.meeting)
    const { problem_id: problemId } = await ctx.request.validateUsing(agendaValidator)
    return this.#run(ctx, meetingId, async () => {
      await addToAgenda(staff, meetingId, problemId)
      return ctx.i18n.t('problems.forum.flash.added', { number: problemNumber(problemId) })
    })
  }

  async removeItem(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'forum.manage')
    const meetingId = Number(ctx.params.meeting)
    const { problem_id: problemId } = await ctx.request.validateUsing(agendaValidator)
    return this.#run(ctx, meetingId, async () => {
      await removeFromAgenda(staff, meetingId, problemId)
      return ctx.i18n.t('problems.forum.flash.removed', { number: problemNumber(problemId) })
    })
  }

  async moveItem(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'forum.manage')
    const meetingId = Number(ctx.params.meeting)
    const input = await ctx.request.validateUsing(agendaMoveValidator)
    return this.#run(ctx, meetingId, async () => {
      await moveOnAgenda(staff, meetingId, input.problem_id, input.direction)
      return null
    })
  }

  async decide(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'problems.decide')
    const meetingId = Number(ctx.params.meeting)
    const input = await ctx.request.validateUsing(decisionValidator)
    return this.#run(ctx, meetingId, async () => {
      await recordDecision(staff, meetingId, input.problem_id, {
        outcome: input.outcome,
        note: input.note || null,
      })
      return ctx.i18n.t('problems.forum.flash.decided', {
        number: problemNumber(input.problem_id),
        outcome: ctx.i18n.t(`problems.forum.outcomes.${input.outcome}`),
      })
    })
  }

  async held(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'forum.manage')
    const meetingId = Number(ctx.params.meeting)
    return this.#run(ctx, meetingId, async () => {
      await markHeld(staff, meetingId)
      return ctx.i18n.t('problems.forum.flash.held')
    })
  }

  async #run(ctx: HttpContext, meetingId: number, work: () => Promise<string | null>) {
    try {
      const message = await work()
      if (message) ctx.session.flash('success', message)
    } catch (error) {
      if (error instanceof ForumChangeRefusedException) {
        ctx.session.flash('error', ctx.i18n.t(`problems.forum.errors.${error.reason}`))
      } else if (error instanceof ProblemChangeRefusedException) {
        ctx.session.flash('error', ctx.i18n.t(`problems.errors.${error.reason}`))
      } else {
        throw error
      }
    }
    return ctx.response.redirect().toPath(`/forum/${meetingId}`)
  }
}
