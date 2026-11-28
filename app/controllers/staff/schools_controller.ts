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
import { changeSchoolTrial } from '#accounts/console'
import {
  AlreadyMemberError,
  InvitationUnavailableError,
  PrincipalTakenError,
} from '#accounts/errors'
import { backWithFieldError, staffUser } from '#accounts/http'
import { defaultTrialDays } from '#accounts/settings'
import { authorizeStaff, staffCan } from '#accounts/staff_access'
import { staffTransaction } from '#tenancy/tenant_transaction'
import { staffInviteValidator, trialChangeValidator } from '#validators/accounts'

const searchValidator = vine.create({ q: vine.string().trim().maxLength(100).optional() })

/**
 * Konsol: schools, their members and invitations, and the school's
 * trial length (D-182, D-459). School-owned rows are read in a staff
 * transaction (SET LOCAL ROLE sigrak_staff) after the role check.
 */
export default class SchoolsController {
  async index(ctx: HttpContext) {
    authorizeStaff(staffUser(ctx), 'schools.view')
    const { q } = await searchValidator.validate(ctx.request.qs())

    const schools = await staffTransaction(async (trx) => {
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
    const staff = staffUser(ctx)
    authorizeStaff(staff, 'schools.view')
    const schoolId = Number(ctx.params.school)

    const data = await staffTransaction(async (trx) => {
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
      },
      defaultTrialDays: await defaultTrialDays(),
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
        manageInvitations: staffCan(staff, 'invitations.manage'),
        manageTrials: staffCan(staff, 'trials.manage'),
      },
    })
  }

  async invite(ctx: HttpContext) {
    const staff = staffUser(ctx)
    authorizeStaff(staff, 'invitations.manage')
    const schoolId = Number(ctx.params.school)
    const back = `/sekolah/${schoolId}`
    const { email, role } = await ctx.request.validateUsing(staffInviteValidator)

    let pending
    try {
      pending = await staffTransaction(async (trx) => {
        const school = await School.findOrFail(schoolId, { client: trx })
        return inviteToSchool({ school, email, role, inviter: { staff } })
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
    const staff = staffUser(ctx)
    authorizeStaff(staff, 'invitations.manage')
    const back = `/sekolah/${Number(ctx.params.school)}`
    try {
      const pending = await staffTransaction(async () =>
        resendInvitation(await this.#invitation(ctx), { staff })
      )
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
    const staff = staffUser(ctx)
    authorizeStaff(staff, 'invitations.manage')
    const email = await staffTransaction(async () => {
      const invitation = await this.#invitation(ctx)
      await cancelInvitation(invitation)
      return invitation.email
    })
    ctx.session.flash('success', ctx.i18n.t('console.school.cancelled', { email }))
    return ctx.response.redirect().toPath(`/sekolah/${Number(ctx.params.school)}`)
  }

  async updateTrial(ctx: HttpContext) {
    const staff = staffUser(ctx)
    authorizeStaff(staff, 'trials.manage')
    const change = await ctx.request.validateUsing(trialChangeValidator)
    const school = await changeSchoolTrial(staff, Number(ctx.params.school), change)
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
