import { Exception } from '@adonisjs/core/exceptions'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { logStaffActivity } from '#accounts/activity_log'
import type StaffUser from '#models/staff_user'
import { staffCan, StaffForbiddenException } from '#staff/access'
import type { StaffAbility } from '#staff/abilities'
import { staffTransaction } from '#tenancy/tenant_transaction'
import { AGENDA_STATUSES, type ForumOutcome } from './catalog.js'
import { applyProblemStatus, lockProblem } from './problems.js'

/**
 * Forum Masalah→Solusi (R2-07, D-439): the three teams meet every two
 * weeks. Staff with `forum.manage` plan a meeting, build its agenda
 * from analysed problems (add, order, remove) and write the notes; the
 * owner (`problems.decide`) records the decision on each item: go
 * ahead (the problem moves to Diputuskan), not pursued (Ditutup) or
 * later (it stays Dianalisis for a next forum). Every change is logged
 * on the meeting (`forum_meeting.*`) and status moves on the problem.
 */

export class ForumMeetingNotFoundException extends Exception {
  static status = 404
  static code = 'E_FORUM_MEETING_NOT_FOUND'
  static message = 'Forum meeting not found.'
}

export type ForumRefusal =
  | 'meeting_held'
  | 'not_on_agenda'
  | 'agenda_status'
  | 'already_on_agenda'
  | 'already_decided'
  | 'open_items'

export class ForumChangeRefusedException extends Exception {
  static status = 422
  static code = 'E_FORUM_CHANGE_REFUSED'

  constructor(readonly reason: ForumRefusal) {
    super(`Forum change refused: ${reason}`)
  }
}

function requireAbility(staff: StaffUser, ability: StaffAbility) {
  if (!staffCan(staff, ability)) throw new StaffForbiddenException()
}

async function lockMeeting(trx: TransactionClientContract, meetingId: number) {
  const meeting = (await trx.from('forum_meetings').where('id', meetingId).forUpdate().first()) as
    { id: number; status: string; held_on: string } | undefined
  if (!meeting) throw new ForumMeetingNotFoundException()
  return { ...meeting, id: Number(meeting.id) }
}

async function openMeeting(trx: TransactionClientContract, meetingId: number) {
  const meeting = await lockMeeting(trx, meetingId)
  if (meeting.status === 'held') throw new ForumChangeRefusedException('meeting_held')
  return meeting
}

/** Plans a meeting on a date (WIB calendar date, `YYYY-MM-DD`). */
export async function planMeeting(staff: StaffUser, heldOn: string) {
  requireAbility(staff, 'forum.manage')
  return staffTransaction(async (trx) => {
    const now = new Date()
    const [row] = await trx
      .table('forum_meetings')
      .insert({
        held_on: heldOn,
        status: 'planned',
        created_by_staff_id: staff.id,
        created_at: now,
        updated_at: now,
      })
      .returning('id')
    const id = Number(row.id ?? row)
    await logStaffActivity(
      staff,
      'forum_meeting.create',
      'forum_meeting',
      id,
      { held_on: heldOn },
      trx
    )
    return id
  })
}

/** Saves the date and the notes of a planned meeting. */
export async function updateMeeting(
  staff: StaffUser,
  meetingId: number,
  input: { heldOn: string; notes: string | null }
) {
  requireAbility(staff, 'forum.manage')
  return staffTransaction(async (trx) => {
    const meeting = await lockMeeting(trx, meetingId)
    // Notes may still be completed after the meeting; the date may not move then.
    const update: Record<string, unknown> = { notes: input.notes, updated_at: new Date() }
    if (meeting.status !== 'held') update.held_on = input.heldOn
    await trx.from('forum_meetings').where('id', meeting.id).update(update)
    await logStaffActivity(
      staff,
      'forum_meeting.update',
      'forum_meeting',
      meeting.id,
      { held_on: update.held_on ?? meeting.held_on, notes: Boolean(input.notes) },
      trx
    )
  })
}

/** Puts an analysed problem on a planned meeting's agenda, at the end. */
export async function addToAgenda(staff: StaffUser, meetingId: number, problemId: number) {
  requireAbility(staff, 'forum.manage')
  return staffTransaction(async (trx) => {
    const meeting = await openMeeting(trx, meetingId)
    const problem = await lockProblem(trx, problemId)
    if (!AGENDA_STATUSES.includes(problem.status) || problem.merged_into_id) {
      throw new ForumChangeRefusedException('agenda_status')
    }
    const existing = await trx
      .from('forum_decisions')
      .where('meeting_id', meeting.id)
      .where('problem_id', problem.id)
      .first()
    if (existing) throw new ForumChangeRefusedException('already_on_agenda')
    const last = (await trx
      .from('forum_decisions')
      .where('meeting_id', meeting.id)
      .max('position as position')
      .first()) as { position: number | null } | undefined
    await trx.table('forum_decisions').insert({
      meeting_id: meeting.id,
      problem_id: problem.id,
      position: Number(last?.position ?? 0) + 1,
      added_by_staff_id: staff.id,
      created_at: new Date(),
    })
    await logStaffActivity(
      staff,
      'forum_meeting.agenda_add',
      'forum_meeting',
      meeting.id,
      { problem_id: problem.id },
      trx
    )
  })
}

async function agendaItem(trx: TransactionClientContract, meetingId: number, problemId: number) {
  const item = (await trx
    .from('forum_decisions')
    .where('meeting_id', meetingId)
    .where('problem_id', problemId)
    .forUpdate()
    .first()) as { id: number; position: number; outcome: string | null } | undefined
  if (!item) throw new ForumChangeRefusedException('not_on_agenda')
  return item
}

/** Takes an undecided item off a planned meeting's agenda. */
export async function removeFromAgenda(staff: StaffUser, meetingId: number, problemId: number) {
  requireAbility(staff, 'forum.manage')
  return staffTransaction(async (trx) => {
    const meeting = await openMeeting(trx, meetingId)
    const item = await agendaItem(trx, meeting.id, problemId)
    if (item.outcome) throw new ForumChangeRefusedException('already_decided')
    await trx.from('forum_decisions').where('id', item.id).delete()
    await logStaffActivity(
      staff,
      'forum_meeting.agenda_remove',
      'forum_meeting',
      meeting.id,
      { problem_id: problemId },
      trx
    )
  })
}

/** Moves an agenda item one place up or down (swaps with its neighbour). */
export async function moveOnAgenda(
  staff: StaffUser,
  meetingId: number,
  problemId: number,
  direction: 'up' | 'down'
) {
  requireAbility(staff, 'forum.manage')
  return staffTransaction(async (trx) => {
    const meeting = await openMeeting(trx, meetingId)
    const item = await agendaItem(trx, meeting.id, problemId)
    const neighbour = (await trx
      .from('forum_decisions')
      .where('meeting_id', meeting.id)
      .where('position', direction === 'up' ? '<' : '>', item.position)
      .orderBy('position', direction === 'up' ? 'desc' : 'asc')
      .forUpdate()
      .first()) as { id: number; position: number } | undefined
    if (!neighbour) return
    await trx.from('forum_decisions').where('id', item.id).update({ position: neighbour.position })
    await trx.from('forum_decisions').where('id', neighbour.id).update({ position: item.position })
    await logStaffActivity(
      staff,
      'forum_meeting.agenda_move',
      'forum_meeting',
      meeting.id,
      { problem_id: problemId, direction },
      trx
    )
  })
}

const OUTCOME_STATUS = { go: 'decided', decline: 'closed', defer: null } as const

/**
 * The owner's decision on an agenda item (D-439: the owner decides in
 * the forum). Go ahead → Diputuskan, not pursued → Ditutup, later →
 * stays Dianalisis. A decision is final for that meeting; a deferred
 * problem goes on a later agenda.
 */
export async function recordDecision(
  staff: StaffUser,
  meetingId: number,
  problemId: number,
  input: { outcome: ForumOutcome; note: string | null }
) {
  requireAbility(staff, 'problems.decide')
  return staffTransaction(async (trx) => {
    const meeting = await lockMeeting(trx, meetingId)
    const item = await agendaItem(trx, meeting.id, problemId)
    if (item.outcome) throw new ForumChangeRefusedException('already_decided')
    const problem = await lockProblem(trx, problemId)
    if (problem.status !== 'analysed' || problem.merged_into_id) {
      throw new ForumChangeRefusedException('agenda_status')
    }
    await trx.from('forum_decisions').where('id', item.id).update({
      outcome: input.outcome,
      note: input.note,
      decided_by_staff_id: staff.id,
      decided_at: new Date(),
    })
    await logStaffActivity(
      staff,
      'forum_meeting.decision',
      'forum_meeting',
      meeting.id,
      { problem_id: problem.id, outcome: input.outcome },
      trx
    )
    const status = OUTCOME_STATUS[input.outcome]
    if (status) {
      await applyProblemStatus(trx, staff, problem, status, { via: 'forum', meetingId: meeting.id })
    }
  })
}

/** Marks the meeting as held; every agenda item needs a decision first. */
export async function markHeld(staff: StaffUser, meetingId: number) {
  requireAbility(staff, 'forum.manage')
  return staffTransaction(async (trx) => {
    const meeting = await openMeeting(trx, meetingId)
    const open = await trx
      .from('forum_decisions')
      .where('meeting_id', meeting.id)
      .whereNull('outcome')
      .first()
    if (open) throw new ForumChangeRefusedException('open_items')
    const now = new Date()
    await trx
      .from('forum_meetings')
      .where('id', meeting.id)
      .update({ status: 'held', held_at: now, updated_at: now })
    await logStaffActivity(staff, 'forum_meeting.held', 'forum_meeting', meeting.id, {}, trx)
  })
}
