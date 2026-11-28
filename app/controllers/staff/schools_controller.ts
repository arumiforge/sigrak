import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import Invitation from '#models/invitation'
import School, { type SchoolLevel } from '#models/school'
import SchoolMembership from '#models/school_membership'
import {
  cancelInvitation,
  inviteToSchool,
  mailInvitation,
  resendInvitation,
} from '#accounts/invitations'
import { logStaffActivity } from '#accounts/activity_log'
import { authorizeTrialChange, changeSchoolTrial, TRIAL_EXTEND_MAX_DAYS } from '#accounts/console'
import {
  AlreadyMemberError,
  InvitationUnavailableError,
  PrincipalTakenError,
} from '#accounts/errors'
import { backWithFieldError } from '#accounts/http'
import { defaultTrialDays } from '#accounts/settings'
import { applySchoolScope, authorizeStaff, schoolScopeOf, withinScope } from '#staff/access'
import { staffReadTransaction, staffTransaction } from '#tenancy/tenant_transaction'
import { staffInviteValidator, trialChangeValidator } from '#validators/accounts'

const searchValidator = vine.create({ q: vine.string().trim().maxLength(100).optional() })

/**
 * Konsol: schools, their members and invitations, and the school's
 * trial (D-182, D-459, D-469). Abilities: `schools.view` (list and
 * profile, limited to the staff member's area, D-338), `invitations.
 * manage`, `trials.manage` or `trials.extend` (app/staff/powers.ts).
 * After the check, the view pages read school-owned rows as read-only
 * staff (`staffReadTransaction`, SET LOCAL ROLE sigrak_staff_readonly);
 * only changes run as full staff (`staffTransaction`).
 */
export default class SchoolsController {
  async index(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'schools.view')
    const scope = schoolScopeOf(staff, 'schools.view')
    const { q } = await searchValidator.validate(ctx.request.qs())

    const schools = await staffReadTransaction(async (trx) => {
      const query = trx
        .from('schools as s')
        .select('s.id', 's.name', 's.npsn', 's.level', 's.trial_days')
        .select(
          trx.raw(
            `(SELECT count(*)::int FROM school_memberships m WHERE m.school_id = s.id AND m.status = 'active') AS members`
          )
        )
        .orderBy('s.name', 'asc')
        .limit(100)
      applySchoolScope(query, scope, 's')
      if (q) {
        query.where((where) => {
          where.whereILike('s.name', `%${q}%`).orWhere('s.npsn', q)
        })
      }
      return query
    })

    return ctx.inertia.render('console/schools', {
      q: q ?? '',
      schools: schools.map(
        (school: {
          id: number
          name: string
          npsn: string | null
          level: SchoolLevel
          trial_days: number | null
          members: number
        }) => ({
          id: school.id,
          name: school.name,
          npsn: school.npsn,
          level: school.level,
          trialDays: school.trial_days,
          members: school.members,
        })
      ),
    })
  }

  async show(ctx: HttpContext) {
    const schoolId = Number(ctx.params.school)
    const staff = await authorizeStaff(ctx, 'schools.view', schoolId)

    const data = await staffReadTransaction(async (trx) => {
      const school = await School.findOrFail(schoolId, { client: trx })
      const members = await SchoolMembership.query({ client: trx })
        .where('school_id', school.id)
        .preload('user')
        .orderBy('status', 'asc')
        .orderBy('role', 'asc')
        .orderBy('started_on', 'asc')
      const invitations = await Invitation.query()
        .where('school_id', school.id)
        .whereNull('accepted_at')
        .orderBy('sent_at', 'desc')
      return { school, members, invitations }
    })

    return ctx.inertia.render('console/school', {
      school: {
        id: data.school.id,
        name: data.school.name,
        npsn: data.school.npsn,
        level: data.school.level,
        trialDays: data.school.trialDays,
        trialExtendedUntil: data.school.trialExtendedUntil?.toISO() ?? null,
      },
      defaultTrialDays: await defaultTrialDays(),
      trialExtendMaxDays: TRIAL_EXTEND_MAX_DAYS,
      members: data.members.map((member) => ({
        publicId: member.publicId,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
        status: member.status,
        startedOn: member.startedOn.toISODate()!,
      })),
      invitations: data.invitations.map((invitation) => ({
        publicId: invitation.publicId,
        email: invitation.email,
        role: invitation.role,
        state: invitation.state,
        sentAt: invitation.sentAt.toISO()!,
        expiresAt: invitation.expiresAt.toISO()!,
      })),
      can: {
        manageInvitations: await withinScope(staff, 'invitations.manage', schoolId),
        manageTrials: await withinScope(staff, 'trials.manage', schoolId),
        extendTrials: await withinScope(staff, 'trials.extend', schoolId),
      },
    })
  }

  async invite(ctx: HttpContext) {
    const schoolId = Number(ctx.params.school)
    const staff = await authorizeStaff(ctx, 'invitations.manage', schoolId)
    const back = `/sekolah/${schoolId}`
    const { email, role } = await ctx.request.validateUsing(staffInviteValidator)

    let pending
    try {
      pending = await staffTransaction(async (trx) => {
        const school = await School.findOrFail(schoolId, { client: trx })
        const invited = await inviteToSchool({ school, email, role, inviter: { staff } })
        await logStaffActivity(
          staff,
          'invitation.create',
          'invitation',
          invited.invitation.publicId,
          { school_id: school.id, email, role },
          trx
        )
        return invited
      })
    } catch (error) {
      if (error instanceof AlreadyMemberError) {
        return backWithFieldError(ctx, back, 'email', ctx.i18n.t('accounts.errors.already_member'))
      }
      if (error instanceof PrincipalTakenError) {
        return backWithFieldError(ctx, back, 'role', ctx.i18n.t('accounts.errors.principal_taken'))
      }
      throw error
    }
    await mailInvitation(pending)
    ctx.session.flash('success', ctx.i18n.t('console.school.invited', { email }))
    return ctx.response.redirect().toPath(back)
  }

  async resend(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'invitations.manage', Number(ctx.params.school))
    const back = `/sekolah/${Number(ctx.params.school)}`
    try {
      const pending = await staffTransaction(async (trx) => {
        const resent = await resendInvitation(await this.#invitation(ctx), { staff })
        await logStaffActivity(
          staff,
          'invitation.resend',
          'invitation',
          resent.invitation.publicId,
          { school_id: Number(ctx.params.school), email: resent.invitation.email },
          trx
        )
        return resent
      })
      await mailInvitation(pending)
      ctx.session.flash(
        'success',
        ctx.i18n.t('console.school.resent', { email: pending.invitation.email })
      )
    } catch (error) {
      if (!(
        error instanceof AlreadyMemberError ||
        error instanceof InvitationUnavailableError ||
        error instanceof PrincipalTakenError
      )) {
        throw error
      }
      ctx.session.flash('error', ctx.i18n.t('accounts.errors.not_resendable'))
    }
    return ctx.response.redirect().toPath(back)
  }

  async cancel(ctx: HttpContext) {
    const staff = await authorizeStaff(ctx, 'invitations.manage', Number(ctx.params.school))
    const email = await staffTransaction(async (trx) => {
      const invitation = await this.#invitation(ctx)
      await cancelInvitation(invitation)
      await logStaffActivity(
        staff,
        'invitation.cancel',
        'invitation',
        invitation.publicId,
        { school_id: invitation.schoolId, email: invitation.email },
        trx
      )
      return invitation.email
    })
    ctx.session.flash('success', ctx.i18n.t('console.school.cancelled', { email }))
    return ctx.response.redirect().toPath(`/sekolah/${Number(ctx.params.school)}`)
  }

  async updateTrial(ctx: HttpContext) {
    const schoolId = Number(ctx.params.school)
    const change = await ctx.request.validateUsing(trialChangeValidator)
    const staff = await authorizeTrialChange(ctx, change, { schoolId })
    const school = await changeSchoolTrial(staff, schoolId, change)
    ctx.session.flash('success', ctx.i18n.t('console.trial.saved'))
    return ctx.response.redirect().toPath(`/sekolah/${school.id}`)
  }

  /** An open invitation of the school in the URL, else 404. */
  async #invitation(ctx: HttpContext) {
    return Invitation.query()
      .where('school_id', Number(ctx.params.school))
      .where('public_id', ctx.params.invitation)
      .whereNull('accepted_at')
      .firstOrFail()
  }
}
