import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import {
  acceptInvitation,
  findOpenInvitation,
  normalizeEmail,
  type AcceptedInvitation,
} from '#accounts/invitations'
import {
  EmailTakenError,
  InvitationEmailMismatchError,
  InvitationUnavailableError,
  PrincipalTakenError,
} from '#accounts/errors'
import { backWithFieldError } from '#accounts/http'
import { attemptLogin } from '#services/login_attempts'
import { ACTIVE_MEMBERSHIP_SESSION_KEY } from '#tenancy/active_membership'
import { acceptExistingAccountValidator, acceptNewAccountValidator } from '#validators/accounts'

type Mode = 'new_account' | 'sign_in' | 'join' | 'other_account'

/**
 * /undangan/{token} (D-182, D-459). Works with or without a session:
 *
 * - no account for the invited email: name and password make one;
 * - an account exists (a teacher who signed up alone): its password, or
 *   the open session of that account, joins it to the school, keeping
 *   everything it owns;
 * - signed in as someone else: the page asks to sign out first.
 *
 * An unknown, used or expired link shows one neutral page.
 */
export default class InvitationController {
  async show(ctx: HttpContext) {
    const open = await findOpenInvitation(ctx.params.token)
    if (!open) {
      return ctx.inertia.render('auth/invitation', { invitation: null })
    }
    const mode = await this.#modeFor(ctx, open.invitation.email, open.existingUser !== null)
    return ctx.inertia.render('auth/invitation', {
      invitation: {
        mode,
        email: open.invitation.email,
        schoolName: open.school.name,
        role: open.invitation.role,
      },
    })
  }

  async store(ctx: HttpContext) {
    const token = ctx.params.token as string
    const back = `/undangan/${token}`
    const open = await findOpenInvitation(token)
    if (!open) {
      ctx.session.flash('error', ctx.i18n.t('accounts.invitation.unavailable'))
      return ctx.response.redirect().toPath(back)
    }

    const mode = await this.#modeFor(ctx, open.invitation.email, open.existingUser !== null)
    let accepted: AcceptedInvitation
    try {
      if (mode === 'other_account') {
        throw new InvitationEmailMismatchError()
      } else if (mode === 'join') {
        accepted = await acceptInvitation(token, { user: ctx.auth.use('web').user as User })
      } else if (mode === 'sign_in') {
        const { password } = await ctx.request.validateUsing(acceptExistingAccountValidator)
        const email = open.invitation.email
        const result = await attemptLogin(
          ctx,
          'app',
          email,
          'password',
          ctx.i18n.t('accounts.invitation.wrong_password'),
          () => User.verifyCredentials(email, password).catch(() => null)
        )
        if (!result.ok) return backWithFieldError(ctx, back, result.field, result.message)
        accepted = await acceptInvitation(token, { user: result.account })
      } else {
        const data = await ctx.request.validateUsing(acceptNewAccountValidator)
        accepted = await acceptInvitation(token, data)
      }
    } catch (error) {
      const message = this.#messageFor(ctx, error)
      if (!message) throw error
      ctx.session.flash('error', message)
      return ctx.response.redirect().toPath(back)
    }

    await ctx.auth.use('web').login(accepted.user)
    ctx.session.put(ACTIVE_MEMBERSHIP_SESSION_KEY, accepted.membership.publicId)
    ctx.session.flash(
      'success',
      ctx.i18n.t('accounts.invitation.joined', { school: accepted.school.name })
    )
    return ctx.response.redirect().toPath('/')
  }

  async #modeFor(ctx: HttpContext, invitedEmail: string, accountExists: boolean): Promise<Mode> {
    if (await ctx.auth.use('web').check()) {
      const user = ctx.auth.use('web').user as User
      return normalizeEmail(user.email) === invitedEmail ? 'join' : 'other_account'
    }
    return accountExists ? 'sign_in' : 'new_account'
  }

  #messageFor(ctx: HttpContext, error: unknown): string | null {
    if (error instanceof InvitationUnavailableError) {
      return ctx.i18n.t('accounts.invitation.unavailable')
    }
    if (error instanceof InvitationEmailMismatchError) {
      return ctx.i18n.t('accounts.invitation.other_account')
    }
    if (error instanceof EmailTakenError) {
      return ctx.i18n.t('accounts.invitation.account_exists')
    }
    if (error instanceof PrincipalTakenError) {
      return ctx.i18n.t('accounts.errors.principal_taken')
    }
    return null
  }
}
