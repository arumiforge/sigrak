import { Exception } from '@adonisjs/core/exceptions'

/**
 * Errors the account services raise for the controllers to turn into a
 * message on the form. Codes are stable; the copy lives in
 * resources/lang/id.
 */
export class AccountError extends Exception {
  static status = 422
}

/** Sign-up or invitation for an email that already has an account. */
export class EmailTakenError extends AccountError {
  static code = 'E_EMAIL_TAKEN'
}

/** The invitation is unknown, used or expired (one neutral answer, D-182). */
export class InvitationUnavailableError extends AccountError {
  static status = 404
  static code = 'E_INVITATION_UNAVAILABLE'
}

/** Accepting with an account whose email is not the invited one. */
export class InvitationEmailMismatchError extends AccountError {
  static status = 403
  static code = 'E_INVITATION_EMAIL_MISMATCH'
}

/** Inviting someone who already holds that role in the school. */
export class AlreadyMemberError extends AccountError {
  static code = 'E_ALREADY_MEMBER'
}

/** A second active principal (one per school, data model). */
export class PrincipalTakenError extends AccountError {
  static code = 'E_PRINCIPAL_TAKEN'
}
