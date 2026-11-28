import { Exception } from '@adonisjs/core/exceptions'
import mail from '@adonisjs/mail/services/main'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import { logStaffActivity } from '#accounts/activity_log'
import type StaffUser from '#models/staff_user'
import type User from '#models/user'
import { schoolScopeOf, withinScope } from '#staff/access'
import type { StaffAbility } from '#staff/abilities'
import type { ActiveMembership } from '#tenancy/active_membership'
import { staffTransaction, tenantTransaction } from '#tenancy/tenant_transaction'
import type { HelpCategory, HelpStatus } from './catalog.js'
import HelpReplyMail from './help_reply_mail.js'
import HelpRequest from './models/help_request.js'
import HelpRequestNote from './models/help_request_note.js'

/**
 * Minta Bantuan (R2-06, D-320): school users send requests and read
 * the answers; staff answer, change the status (Baru, Diproses,
 * Selesai) and the sender is told in the app (an unread mark on
 * "Bantuan saya", mail optional).
 *
 * App side: every read and write runs in the sender's tenant
 * transaction, so row-level security keeps each school to its own
 * requests, and every query also filters by the sender. Console side:
 * the staff member's ability and area scope are checked first, then
 * rows are changed as staff (`staffTransaction`) and every change is
 * logged (`help_request.*`).
 */

export class HelpRequestNotFoundException extends Exception {
  static status = 404
  static code = 'E_HELP_REQUEST_NOT_FOUND'
  static message = 'Help request not found.'
}

/* ----------------------------------------------------------------------
 * App side (the sender)
 * -------------------------------------------------------------------- */

/** Sends a request for the signed-in user, for the school they act for (or none). */
export async function sendHelpRequest(
  user: User,
  membership: ActiveMembership | undefined,
  input: { category: HelpCategory; message: string; pageUrl: string | null }
) {
  const schoolId = membership?.schoolId ?? null
  return tenantTransaction(
    async (trx) => {
      const now = DateTime.now()
      return HelpRequest.create(
        {
          schoolId,
          userId: user.id,
          membershipRole: membership?.role ?? null,
          category: input.category,
          message: input.message,
          pageUrl: input.pageUrl,
          status: 'new',
          statusChangedAt: now,
        },
        { client: trx }
      )
    },
    { schoolId, userId: user.id }
  )
}

/** The sender's own requests visible in the current context, newest first. */
export async function myHelpRequests(userId: number) {
  return tenantTransaction(async (trx) => {
    const rows = await HelpRequest.query({ client: trx })
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(100)
    const counts = await trx
      .from('help_request_notes')
      .whereIn(
        'help_request_id',
        rows.map((row) => row.id)
      )
      .where('kind', 'reply')
      .groupBy('help_request_id')
      .select('help_request_id')
      .count('* as replies')
    const replies = new Map(
      (counts as { help_request_id: number; replies: string }[]).map((row) => [
        Number(row.help_request_id),
        Number(row.replies),
      ])
    )
    return rows.map((row) => ({ request: row, replies: replies.get(row.id) ?? 0 }))
  })
}

/**
 * One of the sender's requests with the entries they may see (replies
 * and status changes; RLS hides internal notes). Opening it clears the
 * unread mark. 404 for any request that is not theirs.
 */
export async function openMyHelpRequest(userId: number, publicId: string) {
  return tenantTransaction(async (trx) => {
    const request = await HelpRequest.query({ client: trx })
      .where('public_id', publicId)
      .where('user_id', userId)
      .first()
    if (!request) throw new HelpRequestNotFoundException()
    const notes = await HelpRequestNote.query({ client: trx })
      .where('help_request_id', request.id)
      .whereIn('kind', ['reply', 'status'])
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
    if (request.senderUnreadAt) {
      await trx
        .from('help_requests')
        .where('id', request.id)
        .where('user_id', userId)
        .update({ sender_unread_at: null })
    }
    return { request, notes }
  })
}

/** How many of the user's requests have news they have not opened (account menu). */
export async function unreadHelpCount(userId: number): Promise<number> {
  return tenantTransaction(async (trx) => {
    const row = (await trx
      .from('help_requests')
      .where('user_id', userId)
      .whereNotNull('sender_unread_at')
      .count('* as count')
      .first()) as { count: string } | undefined
    return Number(row?.count ?? 0)
  })
}

/* ----------------------------------------------------------------------
 * Console side (staff)
 * -------------------------------------------------------------------- */

/**
 * Whether `ability` reaches this request: requests of a school follow
 * the school's area scope (D-338); a request without a school only
 * reaches staff whose scope is unlimited.
 */
export async function staffReaches(
  staff: StaffUser,
  ability: StaffAbility,
  request: { schoolId: number | null }
) {
  if (request.schoolId === null) return schoolScopeOf(staff, ability).all
  return withinScope(staff, ability, request.schoolId)
}

type Change = {
  staff: StaffUser
  requestId: number
}

/** Loads the request inside a staff transaction (404 when missing). */
async function lockRequest(trx: TransactionClientContract, requestId: number) {
  const request = await HelpRequest.query({ client: trx })
    .where('id', requestId)
    .forUpdate()
    .first()
  if (!request) throw new HelpRequestNotFoundException()
  return request
}

/** Status change inside an open staff transaction: a timeline entry, the sender told. */
async function applyStatus(
  trx: TransactionClientContract,
  staff: StaffUser,
  request: HelpRequest,
  status: HelpStatus
) {
  if (request.status === status) return false
  const from = request.status
  const now = DateTime.now()
  request.merge({ status, statusChangedAt: now, senderUnreadAt: now })
  await request.useTransaction(trx).save()
  await HelpRequestNote.create(
    { helpRequestId: request.id, staffUserId: staff.id, kind: 'status', status, body: null },
    { client: trx }
  )
  await logStaffActivity(
    staff,
    'help_request.status',
    'help_request',
    request.id,
    { from, to: status, school_id: request.schoolId },
    trx
  )
  return true
}

/**
 * For Bank Masalah (R2-07), inside its open staff transaction: locks
 * the request, then tells the sender with a reply on their timeline
 * (the in-app notice) and an optional status change, logged as
 * `action`. Returns the request.
 */
export async function noticeToSender(
  trx: TransactionClientContract,
  staff: StaffUser,
  requestId: number,
  input: { body: string; status?: HelpStatus; action: string; changes: Record<string, unknown> }
) {
  const request = await lockRequest(trx, requestId)
  if (input.status) await applyStatus(trx, staff, request, input.status)
  const note = await HelpRequestNote.create(
    { helpRequestId: request.id, staffUserId: staff.id, kind: 'reply', body: input.body },
    { client: trx }
  )
  request.merge({ senderUnreadAt: DateTime.now() })
  await request.useTransaction(trx).save()
  await logStaffActivity(
    staff,
    input.action,
    'help_request',
    request.id,
    { ...input.changes, note_id: note.id, school_id: request.schoolId },
    trx
  )
  return request
}

/** Changes the status; the sender sees it as news (D-320). */
export async function changeHelpStatus({ staff, requestId }: Change, status: HelpStatus) {
  return staffTransaction(async (trx) => {
    const request = await lockRequest(trx, requestId)
    await applyStatus(trx, staff, request, status)
    return request
  })
}

/**
 * Answers the sender: a reply on their timeline, optionally a status
 * change in the same step, and optionally a mail with a link to the
 * request (the mail is queued after the transaction).
 */
export async function replyToHelpRequest(
  { staff, requestId }: Change,
  input: { body: string; status?: HelpStatus; email?: boolean }
) {
  const result = await staffTransaction(async (trx) => {
    const request = await lockRequest(trx, requestId)
    const recipient = input.email
      ? ((await trx
          .from('users')
          .where('id', request.userId ?? 0)
          .select('email', 'name')
          .first()) as { email: string; name: string } | undefined)
      : undefined
    const note = await HelpRequestNote.create(
      {
        helpRequestId: request.id,
        staffUserId: staff.id,
        kind: 'reply',
        body: input.body,
        status: null,
        emailed: Boolean(recipient),
      },
      { client: trx }
    )
    if (input.status) await applyStatus(trx, staff, request, input.status)
    request.merge({ senderUnreadAt: DateTime.now() })
    await request.useTransaction(trx).save()
    await logStaffActivity(
      staff,
      'help_request.reply',
      'help_request',
      request.id,
      { note_id: note.id, emailed: Boolean(recipient), school_id: request.schoolId },
      trx
    )
    return { request, recipient }
  })
  if (result.recipient) {
    await mail.sendLater(
      new HelpReplyMail({
        email: result.recipient.email,
        name: result.recipient.name,
        publicId: result.request.publicId,
      })
    )
  }
  return result.request
}

/** An internal note for the team; the sender never sees it. */
export async function addHelpNote({ staff, requestId }: Change, body: string) {
  return staffTransaction(async (trx) => {
    const request = await lockRequest(trx, requestId)
    const note = await HelpRequestNote.create(
      { helpRequestId: request.id, staffUserId: staff.id, kind: 'note', body, status: null },
      { client: trx }
    )
    await logStaffActivity(
      staff,
      'help_request.note',
      'help_request',
      request.id,
      { note_id: note.id, school_id: request.schoolId },
      trx
    )
    return request
  })
}

/** "Ambil": the staff member takes the request. */
export async function assignHelpRequestToSelf({ staff, requestId }: Change) {
  return staffTransaction(async (trx) => {
    const request = await lockRequest(trx, requestId)
    if (request.assigneeStaffId === staff.id) return request
    const from = request.assigneeStaffId
    request.merge({ assigneeStaffId: staff.id })
    await request.useTransaction(trx).save()
    await logStaffActivity(
      staff,
      'help_request.assign',
      'help_request',
      request.id,
      { from, to: staff.id, school_id: request.schoolId },
      trx
    )
    return request
  })
}
