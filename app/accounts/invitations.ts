import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { areaUrl } from '#config/hosts'
import Invitation from '#models/invitation'
import School from '#models/school'
import SchoolMembership, { type MembershipRole } from '#models/school_membership'
import type StaffUser from '#models/staff_user'
import User from '#models/user'
import InvitationMail from '#mails/invitation_mail'
import { SchoolContext } from '#tenancy/school_context'
import { TENANT_CONNECTION } from '#tenancy/database_roles'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import { hashToken, newToken, TOKEN_PATTERN, tokenMatches } from '#accounts/tokens'
import {
  AlreadyMemberError,
  EmailTakenError,
  InvitationEmailMismatchError,
  InvitationUnavailableError,
  PrincipalTakenError,
} from '#accounts/errors'

/**
 * Invitations into a school (D-182):
 *
 * - In the school app only the operator invites, and only teachers.
 *   Tim SIGRAK invites any role from the console.
 * - A link is valid for 7 days. Sending again to the same school, email
 *   and role renews the open row with a new token.
 * - Accepting with the invited email joins that account to the school:
 *   a new account is made, or an existing one (a teacher who signed up
 *   alone, D-459) keeps everything it owns (see `acceptInvitation`).
 *
 * The functions that write run inside the caller's transaction: a
 * tenant transaction of the school (operator) or a staff transaction
 * (console). Mail is queued only after that transaction commits.
 */
export const INVITATION_VALID_DAYS = 7

export type Inviter = { user: User } | { staff: StaffUser }

/** What to mail once the invitation is saved. */
export type PendingInvitationMail = {
  invitation: Invitation
  token: string
  schoolName: string
  inviterName: string | null
}

function openTransaction(): TransactionClientContract {
  const trx = SchoolContext.current()?.trx
  if (!trx) {
    throw new Error('Invitations are written inside a tenant or staff transaction')
  }
  return trx
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function hasActiveRole(
  trx: TransactionClientContract,
  schoolId: number,
  email: string,
  role: MembershipRole
) {
  const row = await trx
    .from('school_memberships as m')
    .join('users as u', 'u.id', 'm.user_id')
    .where('m.school_id', schoolId)
    .where('m.role', role)
    .where('m.status', 'active')
    .whereRaw('lower(u.email) = ?', [email])
    .first()
  return Boolean(row)
}

async function principalTaken(trx: TransactionClientContract, schoolId: number) {
  const row = await trx
    .from('school_memberships')
    .where('school_id', schoolId)
    .where('role', 'principal')
    .where('status', 'active')
    .first()
  return Boolean(row)
}

/**
 * Creates an invitation, or renews the open one for the same school,
 * email and role with a fresh token and expiry.
 */
export async function inviteToSchool(input: {
  school: School
  email: string
  role: MembershipRole
  inviter: Inviter
}): Promise<PendingInvitationMail> {
  const trx = openTransaction()
  const email = normalizeEmail(input.email)

  if (await hasActiveRole(trx, input.school.id, email, input.role)) {
    throw new AlreadyMemberError()
  }
  if (input.role === 'principal' && (await principalTaken(trx, input.school.id))) {
    throw new PrincipalTakenError()
  }

  const { token, hash } = newToken()
  const now = DateTime.now()
  const inviterColumns =
    'user' in input.inviter
      ? { invitedBy: input.inviter.user.id, invitedByStaffId: null }
      : { invitedBy: null, invitedByStaffId: input.inviter.staff.id }

  let invitation = await Invitation.query()
    .where('school_id', input.school.id)
    .where('email', email)
    .where('role', input.role)
    .whereNull('accepted_at')
    .forUpdate()
    .first()

  if (invitation) {
    invitation.merge({
      tokenHash: hash,
      expiresAt: now.plus({ days: INVITATION_VALID_DAYS }),
      sentAt: now,
      sendCount: invitation.sendCount + 1,
      ...inviterColumns,
    })
    await invitation.save()
  } else {
    invitation = await Invitation.create({
      schoolId: input.school.id,
      email,
      role: input.role,
      tokenHash: hash,
      expiresAt: now.plus({ days: INVITATION_VALID_DAYS }),
      sentAt: now,
      sendCount: 1,
      ...inviterColumns,
    })
  }

  return {
    invitation,
    token,
    schoolName: input.school.name,
    inviterName: 'user' in input.inviter ? input.inviter.user.name : null,
  }
}

/**
 * Sends an open invitation again: a new token (only the hash is kept,
 * so the old link cannot be re-sent) and a new 7-day expiry.
 */
export async function resendInvitation(
  invitation: Invitation,
  inviter: Inviter
): Promise<PendingInvitationMail> {
  if (invitation.acceptedAt) {
    throw new InvitationUnavailableError()
  }
  const school = await School.findOrFail(invitation.schoolId, { client: openTransaction() })
  return inviteToSchool({ school, email: invitation.email, role: invitation.role, inviter })
}

/**
 * Cancels an open invitation: the row is deleted, so its link stops
 * working at once. An accepted invitation stays as the record.
 */
export async function cancelInvitation(invitation: Invitation) {
  if (invitation.acceptedAt) {
    throw new InvitationUnavailableError()
  }
  await invitation.delete()
}

/**
 * Queues the invitation mail (worker-default sends it). Call after the
 * transaction that saved the invitation has committed.
 */
export async function mailInvitation(pending: PendingInvitationMail) {
  await mail.sendLater(
    new InvitationMail({
      email: pending.invitation.email,
      schoolName: pending.schoolName,
      role: pending.invitation.role,
      inviterName: pending.inviterName,
      url: areaUrl('app', `/undangan/${pending.token}`),
      expiresAt: pending.invitation.expiresAt,
    })
  )
}

/**
 * The school of the invitation with this token, or null. Opening a link
 * happens before there is a session or a school, so this asks the
 * narrow SECURITY DEFINER function, which answers only with a school id.
 */
async function schoolIdForToken(token: string): Promise<number | null> {
  if (!TOKEN_PATTERN.test(token)) return null
  const result = await db
    .connection(TENANT_CONNECTION)
    .rawQuery('SELECT invitation_school_id(?) AS school_id', [hashToken(token)])
  const schoolId = result.rows[0]?.school_id
  return schoolId === null || schoolId === undefined ? null : Number(schoolId)
}

export type OpenInvitation = {
  invitation: Invitation
  school: School
  /** The account that already uses the invited email, if any. */
  existingUser: User | null
}

/**
 * Reads an open invitation by its token inside a tenant transaction of
 * its school, or null when the link is unknown, used or expired (the
 * controller shows one neutral page for all three, D-182). `lock`
 * holds the row until the transaction ends (acceptance).
 */
async function readOpenInvitation(
  trx: TransactionClientContract,
  token: string,
  lock = false
): Promise<OpenInvitation | null> {
  const query = Invitation.query().where('token_hash', hashToken(token))
  if (lock) query.forUpdate()
  const invitation = await query.first()
  if (!invitation || !tokenMatches(token, invitation.tokenHash) || invitation.state !== 'open') {
    return null
  }
  const school = await School.findOrFail(invitation.schoolId, { client: trx })
  const existingUser = await User.query({ client: trx })
    .whereRaw('lower(email) = ?', [invitation.email])
    .first()
  return { invitation, school, existingUser }
}

export async function findOpenInvitation(token: string): Promise<OpenInvitation | null> {
  const schoolId = await schoolIdForToken(token)
  if (schoolId === null) return null
  return tenantTransaction((trx) => readOpenInvitation(trx, token), { schoolId, userId: null })
}

export type AcceptedInvitation = {
  user: User
  membership: SchoolMembership
  school: School
  createdAccount: boolean
}

/**
 * Accepts an invitation, as one transaction in the invited school:
 *
 * - `account: { user }`: the signed-in account (or the one that just
 *   proved its password). Its email must be the invited one.
 * - `account: { name, password }`: a new account with the invited email;
 *   refused when that email already has an account.
 *
 * The membership is created, or an ended one for the same school and
 * role is opened again. The email counts as verified (D-183) and the
 * trial starts if it never did.
 *
 * Ownership rule when an existing account joins (D-459, "without
 * losing documents"): nothing the account owns moves or changes owner.
 * Rows it made without a school (school_id NULL: generations, their
 * steps and AI usage, later documents) stay its own and stay visible to
 * it in every school context through the row-level security rule
 * `school_id IS NULL AND user_id = app_user_id()`; other members of the
 * school, the principal included, do not see them. AI keys belong to
 * the person, never to a school (D-012). Work made after joining, under
 * the school's membership, carries the school's id. Copying older work
 * into the school is a separate, explicit action (open question).
 */
export async function acceptInvitation(
  token: string,
  account: { user: User } | { name: string; password: string }
): Promise<AcceptedInvitation> {
  const schoolId = await schoolIdForToken(token)
  if (schoolId === null) throw new InvitationUnavailableError()
  const signedIn = 'user' in account ? account.user : null

  return tenantTransaction(
    async (trx) => {
      const open = await readOpenInvitation(trx, token, true)
      if (!open) throw new InvitationUnavailableError()
      const { invitation, school } = open
      const now = DateTime.now()

      let user: User
      let createdAccount = false
      if (signedIn) {
        if (normalizeEmail(signedIn.email) !== invitation.email) {
          throw new InvitationEmailMismatchError()
        }
        user = await User.findOrFail(signedIn.id, { client: trx })
      } else {
        if (open.existingUser) throw new EmailTakenError()
        const fresh = account as { name: string; password: string }
        user = await User.create(
          { name: fresh.name, email: invitation.email, password: fresh.password, nip: null },
          { client: trx }
        )
        createdAccount = true
      }

      user.useTransaction(trx)
      user.emailVerifiedAt = user.emailVerifiedAt ?? now
      user.trialStartedAt = user.trialStartedAt ?? now
      await user.save()

      if (invitation.role === 'principal' && (await principalTaken(trx, school.id))) {
        throw new PrincipalTakenError()
      }

      let membership = await SchoolMembership.query({ client: trx })
        .where('school_id', school.id)
        .where('user_id', user.id)
        .where('role', invitation.role)
        .forUpdate()
        .first()
      if (membership && membership.status === 'active') {
        // Already a member with this role (e.g. invited twice): the link still counts as used.
      } else if (membership) {
        membership.useTransaction(trx)
        membership.merge({ status: 'active', startedOn: now, endedOn: null })
        await membership.save()
      } else {
        membership = await SchoolMembership.create(
          {
            schoolId: school.id,
            userId: user.id,
            role: invitation.role,
            status: 'active',
            startedOn: now,
          },
          { client: trx }
        )
      }

      invitation.merge({ acceptedAt: now, acceptedUserId: user.id })
      await invitation.save()

      return { user, membership, school, createdAccount }
    },
    { schoolId, userId: signedIn?.id ?? null }
  )
}
