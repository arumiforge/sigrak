import type { HttpContext } from '@adonisjs/core/http'
import Invitation from '#models/invitation'
import School from '#models/school'
import SchoolMembership from '#models/school_membership'
import {
  cancelInvitation,
  inviteToSchool,
  mailInvitation,
  resendInvitation,
} from '#accounts/invitations'
import { AlreadyMemberError, InvitationUnavailableError } from '#accounts/errors'
import { backWithFieldError, requireRole, schoolUser } from '#accounts/http'
import { tenantTransaction } from '#tenancy/tenant_transaction'
import { inviteTeacherValidator } from '#validators/accounts'

/**
 * Guru (operator only, D-182): the school's teachers, open invitations,
 * and invite, send again and cancel. Everything runs in a tenant
 * transaction of the operator's school, so an invitation of another
 * school is never found (404).
 */
export default class TeachersController {
  async index(ctx: HttpContext) {
    const membership = requireRole(ctx, 'operator')

    const data = await tenantTransaction(async (trx) => {
      const teachers = await SchoolMembership.query({ client: trx })
        .where('school_id', membership.schoolId)
        .where('role', 'teacher')
        .where('status', 'active')
        .preload('user')
        .orderBy('started_on', 'asc')
      const invitations = await Invitation.query()
        .where('role', 'teacher')
        .whereNull('accepted_at')
        .orderBy('sent_at', 'desc')
      return { teachers, invitations }
    })

    return ctx.inertia.render('accounts/teachers', {
      teachers: data.teachers.map((teacher) => ({
        publicId: teacher.publicId,
        name: teacher.user.name,
        email: teacher.user.email,
        startedOn: teacher.startedOn.toISODate()!,
      })),
      invitations: data.invitations.map((invitation) => ({
        publicId: invitation.publicId,
        email: invitation.email,
        state: invitation.state,
        sentAt: invitation.sentAt.toISO()!,
        expiresAt: invitation.expiresAt.toISO()!,
      })),
    })
  }

  async invite(ctx: HttpContext) {
    const membership = requireRole(ctx, 'operator')
    const user = schoolUser(ctx)
    const { email } = await ctx.request.validateUsing(inviteTeacherValidator)

    let pending
    try {
      pending = await tenantTransaction(async (trx) => {
        const school = await School.findOrFail(membership.schoolId, { client: trx })
        return inviteToSchool({ school, email, role: 'teacher', inviter: { user } })
      })
    } catch (error) {
      if (!(error instanceof AlreadyMemberError)) throw error
      return backWithFieldError(ctx, '/guru', 'email', ctx.i18n.t('accounts.errors.already_member'))
    }
    await mailInvitation(pending)
    ctx.session.flash('success', ctx.i18n.t('accounts.teachers.invited', { email }))
    return ctx.response.redirect().toPath('/guru')
  }

  async resend(ctx: HttpContext) {
    requireRole(ctx, 'operator')
    const user = schoolUser(ctx)
    try {
      const pending = await tenantTransaction(async () => {
        const invitation = await this.#ownInvitation(ctx)
        return resendInvitation(invitation, { user })
      })
      await mailInvitation(pending)
      ctx.session.flash(
        'success',
        ctx.i18n.t('accounts.teachers.resent', { email: pending.invitation.email })
      )
    } catch (error) {
      if (!(error instanceof AlreadyMemberError || error instanceof InvitationUnavailableError)) {
        throw error
      }
      ctx.session.flash('error', ctx.i18n.t('accounts.errors.not_resendable'))
    }
    return ctx.response.redirect().toPath('/guru')
  }

  async cancel(ctx: HttpContext) {
    requireRole(ctx, 'operator')
    const email = await tenantTransaction(async () => {
      const invitation = await this.#ownInvitation(ctx)
      await cancelInvitation(invitation)
      return invitation.email
    })
    ctx.session.flash('success', ctx.i18n.t('accounts.teachers.cancelled', { email }))
    return ctx.response.redirect().toPath('/guru')
  }

  /**
   * An open teacher invitation of the operator's school, else 404.
   */
  async #ownInvitation(ctx: HttpContext) {
    return Invitation.query()
      .where('public_id', ctx.params.invitation)
      .where('role', 'teacher')
      .whereNull('accepted_at')
      .firstOrFail()
  }
}
