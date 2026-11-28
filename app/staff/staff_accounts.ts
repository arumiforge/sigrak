import { randomBytes } from 'node:crypto'
import { Exception } from '@adonisjs/core/exceptions'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import { areaUrl } from '#config/hosts'
import StaffUser from '#models/staff_user'
import StaffRoleAssignment from '#models/staff_role_assignment'
import StaffPasswordToken from '#models/staff_password_token'
import StaffInvitationMail from '#mails/staff_invitation_mail'
import { logStaffActivity } from '#accounts/activity_log'
import { hashToken, newToken, TOKEN_PATTERN, tokenMatches } from '#accounts/tokens'
import { byEmail } from '#models/email_lookup'
import { hasRole, loadStaffAccess, staffCan, StaffForbiddenException } from './access.js'
import {
  HIGH_ROLES,
  ROLE_SCOPES,
  SCOPE_FIELDS,
  SCOPE_LEVELS,
  type ScopeField,
  type ScopeLevel,
  type StaffRole,
} from './roles.js'

/**
 * Staff accounts, roles and scopes (R2-01, D-338, D-339). Every change
 * is logged in staff_activity_logs (subject `staff`) in the same
 * transaction. The guards:
 *
 * - nobody changes their own roles, scope or account status;
 * - only an owner (`staff.manage_high`) grants or removes `owner` or
 *   `admin`, or changes the roles or status of someone who holds one;
 * - the last active owner cannot lose the role or be disabled.
 */

export const STAFF_LINK_VALID_DAYS = 7

export type ScopeInput = {
  regionIds?: number[]
  schoolIds?: number[]
  levels?: string[]
  fields?: string[]
}

export class StaffChangeRefusedException extends Exception {
  static status = 422
  static code = 'E_STAFF_CHANGE_REFUSED'

  /** Lang key under `staff.errors.*` the page shows. */
  constructor(readonly reason: 'self' | 'last_owner' | 'high_role' | 'email_taken' | 'role_held') {
    super(`Staff change refused: ${reason}`)
  }
}

/* ----------------------------------------------------------------------
 * Guards
 * -------------------------------------------------------------------- */

function refuseSelf(actor: StaffUser, target: StaffUser) {
  if (actor.id === target.id) throw new StaffChangeRefusedException('self')
}

/**
 * Changing anything about `target` that touches a high role, or any
 * account that holds one, needs `staff.manage_high`.
 */
function refuseHigh(actor: StaffUser, target: StaffUser, role?: StaffRole) {
  if (staffCan(actor, 'staff.manage_high')) return
  const touchesHigh =
    (role !== undefined && HIGH_ROLES.includes(role)) ||
    HIGH_ROLES.some((high) => hasRole(target, high))
  if (touchesHigh) throw new StaffChangeRefusedException('high_role')
}

function refuseWithoutManage(actor: StaffUser) {
  if (!staffCan(actor, 'staff.manage')) throw new StaffForbiddenException()
}

/** Active owners other than `exceptId`, counted under a lock. */
async function otherActiveOwners(trx: TransactionClientContract, exceptId: number) {
  const rows = await trx
    .from('staff_role_assignments as a')
    .join('staff_users as u', 'u.id', 'a.staff_user_id')
    .where('a.role', 'owner')
    .whereNull('u.disabled_at')
    .whereNot('u.id', exceptId)
    .select('u.id')
    .forUpdate()
  return rows.length
}

async function refuseLastOwner(trx: TransactionClientContract, target: StaffUser) {
  if (!hasRole(target, 'owner') || target.disabledAt) return
  if ((await otherActiveOwners(trx, target.id)) === 0) {
    throw new StaffChangeRefusedException('last_owner')
  }
}

/* ----------------------------------------------------------------------
 * Scope
 * -------------------------------------------------------------------- */

const uniqueNumbers = (values: number[] | undefined) =>
  [...new Set((values ?? []).filter((value) => Number.isSafeInteger(value) && value > 0))].sort(
    (a, b) => a - b
  )

/**
 * The scope a role keeps: only the parts the role uses, known levels
 * and fields, and region and school ids that exist.
 */
export async function cleanScope(
  role: StaffRole,
  input: ScopeInput,
  client: TransactionClientContract
) {
  const rule = ROLE_SCOPES[role]
  let regionIds = rule.area === 'none' ? [] : uniqueNumbers(input.regionIds)
  let schoolIds = rule.schools ? uniqueNumbers(input.schoolIds) : []
  if (regionIds.length > 0) {
    const found = await client.from('regions').whereIn('id', regionIds).select('id')
    regionIds = found.map((row: { id: number }) => Number(row.id)).sort((a, b) => a - b)
  }
  if (schoolIds.length > 0) {
    const found = await client.from('schools').whereIn('id', schoolIds).select('id')
    schoolIds = found.map((row: { id: number }) => Number(row.id)).sort((a, b) => a - b)
  }
  const levels = rule.levels
    ? (SCOPE_LEVELS.filter((level) => input.levels?.includes(level)) as ScopeLevel[])
    : []
  const fields = rule.fields
    ? (SCOPE_FIELDS.filter((field) => input.fields?.includes(field)) as ScopeField[])
    : []
  return { regionIds, schoolIds, levels, fields }
}

const scopeOf = (assignment: StaffRoleAssignment) => ({
  region_ids: assignment.regionIds,
  school_ids: assignment.schoolIds,
  levels: assignment.levels,
  fields: assignment.fields,
})

/* ----------------------------------------------------------------------
 * Password links
 * -------------------------------------------------------------------- */

/**
 * A new one-time link for `staff` to set a password, replacing an open
 * one; mailed through the queue after the transaction.
 */
async function issuePasswordLink(staff: StaffUser, trx: TransactionClientContract) {
  const { token, hash } = newToken()
  const expiresAt = DateTime.now().plus({ days: STAFF_LINK_VALID_DAYS })
  await StaffPasswordToken.query({ client: trx }).where('staff_user_id', staff.id).delete()
  await StaffPasswordToken.create(
    { staffUserId: staff.id, tokenHash: hash, expiresAt },
    { client: trx }
  )
  return { url: areaUrl('admin', `/kata-sandi-baru/${token}`), expiresAt }
}

async function mailPasswordLink(staff: StaffUser, link: { url: string; expiresAt: DateTime }) {
  await mail.sendLater(
    new StaffInvitationMail({
      email: staff.email,
      name: staff.name,
      url: link.url,
      expiresAt: link.expiresAt,
    })
  )
}

/** The staff member a valid link belongs to, or null. */
export async function findStaffForLink(token: string): Promise<StaffUser | null> {
  if (!TOKEN_PATTERN.test(token)) return null
  const row = await StaffPasswordToken.query()
    .where('token_hash', hashToken(token))
    .where('expires_at', '>', DateTime.now().toSQL()!)
    .preload('staffUser')
    .first()
  if (!row || !tokenMatches(token, row.tokenHash) || row.staffUser.disabledAt) return null
  return row.staffUser
}

/** Sets the password from a link and spends it; null when the link is no longer valid. */
export async function setPasswordFromLink(token: string, password: string) {
  if (!TOKEN_PATTERN.test(token)) return null
  return db.transaction(async (trx) => {
    const row = await StaffPasswordToken.query({ client: trx })
      .where('token_hash', hashToken(token))
      .forUpdate()
      .first()
    if (!row || !tokenMatches(token, row.tokenHash) || row.expiresAt <= DateTime.now()) {
      return null
    }
    const staff = await StaffUser.findOrFail(row.staffUserId, { client: trx })
    if (staff.disabledAt) return null
    staff.password = password
    await staff.save()
    await row.delete()
    return staff
  })
}

/** A password nobody knows, for an account that sets its own from the link. */
const unusablePassword = () => randomBytes(32).toString('base64url')

/* ----------------------------------------------------------------------
 * Changes
 * -------------------------------------------------------------------- */

/**
 * A new staff account with one first role, and the link to set a
 * password mailed to it.
 */
export async function createStaff(
  actor: StaffUser,
  input: { name: string; email: string; role: StaffRole; scope?: ScopeInput }
) {
  refuseWithoutManage(actor)
  if (HIGH_ROLES.includes(input.role) && !staffCan(actor, 'staff.manage_high')) {
    throw new StaffChangeRefusedException('high_role')
  }
  const { staff, link } = await db.transaction(async (trx) => {
    if (await byEmail(StaffUser, input.email).useTransaction(trx).first()) {
      throw new StaffChangeRefusedException('email_taken')
    }
    const created = await StaffUser.create(
      { name: input.name, email: input.email, password: unusablePassword() },
      { client: trx }
    )
    const scope = await cleanScope(input.role, input.scope ?? {}, trx)
    const assignment = await StaffRoleAssignment.create(
      { staffUserId: created.id, role: input.role, createdByStaffId: actor.id, ...scope },
      { client: trx }
    )
    await logStaffActivity(
      actor,
      'staff.create',
      'staff',
      created.id,
      { name: created.name, email: created.email },
      trx
    )
    await logStaffActivity(
      actor,
      'staff.role_grant',
      'staff',
      created.id,
      { role: input.role, scope: scopeOf(assignment) },
      trx
    )
    return { staff: created, link: await issuePasswordLink(created, trx) }
  })
  await mailPasswordLink(staff, link)
  return staff
}

/** Sends a new set-password link (also how an admin resets a forgotten password). */
export async function resendPasswordLink(actor: StaffUser, target: StaffUser) {
  refuseWithoutManage(actor)
  await loadStaffAccess(target)
  refuseHigh(actor, target)
  if (target.disabledAt) throw new StaffForbiddenException()
  const link = await db.transaction(async (trx) => {
    const issued = await issuePasswordLink(target, trx)
    await logStaffActivity(actor, 'staff.link_resend', 'staff', target.id, {}, trx)
    return issued
  })
  await mailPasswordLink(target, link)
}

/** The account in a transaction, locked, with its roles. */
async function lockedTarget(trx: TransactionClientContract, targetId: number) {
  const target = await StaffUser.query({ client: trx })
    .where('id', targetId)
    .forUpdate()
    .preload('roleAssignments')
    .firstOrFail()
  return target
}

export async function grantRole(
  actor: StaffUser,
  targetId: number,
  role: StaffRole,
  scopeInput: ScopeInput = {}
) {
  refuseWithoutManage(actor)
  return db.transaction(async (trx) => {
    const target = await lockedTarget(trx, targetId)
    refuseSelf(actor, target)
    refuseHigh(actor, target, role)
    if (hasRole(target, role)) throw new StaffChangeRefusedException('role_held')
    const scope = await cleanScope(role, scopeInput, trx)
    const assignment = await StaffRoleAssignment.create(
      { staffUserId: target.id, role, createdByStaffId: actor.id, ...scope },
      { client: trx }
    )
    await logStaffActivity(
      actor,
      'staff.role_grant',
      'staff',
      target.id,
      { role, scope: scopeOf(assignment) },
      trx
    )
    return assignment
  })
}

export async function updateScope(
  actor: StaffUser,
  targetId: number,
  role: StaffRole,
  scopeInput: ScopeInput
) {
  refuseWithoutManage(actor)
  return db.transaction(async (trx) => {
    const target = await lockedTarget(trx, targetId)
    refuseSelf(actor, target)
    refuseHigh(actor, target, role)
    const assignment = await StaffRoleAssignment.query({ client: trx })
      .where('staff_user_id', target.id)
      .where('role', role)
      .firstOrFail()
    const before = scopeOf(assignment)
    assignment.merge(await cleanScope(role, scopeInput, trx))
    await assignment.save()
    await logStaffActivity(
      actor,
      'staff.scope_change',
      'staff',
      target.id,
      { role, from: before, to: scopeOf(assignment) },
      trx
    )
    return assignment
  })
}

export async function revokeRole(actor: StaffUser, targetId: number, role: StaffRole) {
  refuseWithoutManage(actor)
  await db.transaction(async (trx) => {
    const target = await lockedTarget(trx, targetId)
    refuseSelf(actor, target)
    refuseHigh(actor, target, role)
    const assignment = await StaffRoleAssignment.query({ client: trx })
      .where('staff_user_id', target.id)
      .where('role', role)
      .firstOrFail()
    if (role === 'owner') await refuseLastOwner(trx, target)
    await assignment.delete()
    await logStaffActivity(
      actor,
      'staff.role_revoke',
      'staff',
      target.id,
      { role, scope: scopeOf(assignment) },
      trx
    )
  })
}

export async function setDisabled(actor: StaffUser, targetId: number, disabled: boolean) {
  refuseWithoutManage(actor)
  await db.transaction(async (trx) => {
    const target = await lockedTarget(trx, targetId)
    refuseSelf(actor, target)
    refuseHigh(actor, target)
    if (disabled === (target.disabledAt !== null)) return
    if (disabled) await refuseLastOwner(trx, target)
    target.disabledAt = disabled ? DateTime.now() : null
    await target.save()
    if (disabled) {
      await StaffPasswordToken.query({ client: trx }).where('staff_user_id', target.id).delete()
    }
    await logStaffActivity(
      actor,
      disabled ? 'staff.disable' : 'staff.enable',
      'staff',
      target.id,
      {},
      trx
    )
  })
}

/**
 * The first owner account (ace `staff:create-owner`): only while no
 * active owner exists. An existing staff account with the email gets
 * the owner role; otherwise a new account is made with `password`.
 * Logged without a staff member (system change).
 */
export async function createFirstOwner(input: { name: string; email: string; password: string }) {
  return db.transaction(async (trx) => {
    if ((await otherActiveOwners(trx, 0)) > 0) {
      throw new StaffChangeRefusedException('role_held')
    }
    let staff = await byEmail(StaffUser, input.email).useTransaction(trx).first()
    if (staff) {
      staff.useTransaction(trx)
      staff.password = input.password
      staff.disabledAt = null
      await staff.save()
    } else {
      staff = await StaffUser.create(
        { name: input.name, email: input.email, password: input.password },
        { client: trx }
      )
    }
    const held = await StaffRoleAssignment.query({ client: trx })
      .where('staff_user_id', staff.id)
      .where('role', 'owner')
      .first()
    if (!held) {
      await StaffRoleAssignment.create({ staffUserId: staff.id, role: 'owner' }, { client: trx })
    }
    await trx.table('staff_activity_logs').insert({
      staff_user_id: null,
      action: 'staff.owner_bootstrap',
      subject_type: 'staff',
      subject_id: String(staff.id),
      changes: JSON.stringify({ email: staff.email }),
      created_at: new Date(),
    })
    return staff
  })
}
