import vine from '@vinejs/vine'
import { TRIAL_INPUT_RANGE } from '#accounts/settings'

/**
 * School account passwords: at least 8 characters with letters and
 * numbers (D-183).
 */
const newPassword = () =>
  vine
    .string()
    .minLength(8)
    .maxLength(200)
    .regex(/\p{L}/u)
    .regex(/\p{N}/u)
    .confirmed({ confirmationField: 'password_confirmation' })

const email = () => vine.string().trim().toLowerCase().email().maxLength(254)
const personName = () => vine.string().trim().minLength(2).maxLength(150)

export const signUpValidator = vine.create({
  name: personName(),
  email: email(),
  password: newPassword(),
})

export const forgotPasswordValidator = vine.create({
  email: email(),
})

export const resetPasswordValidator = vine.create({
  password: newPassword(),
})

/**
 * Accepting an invitation: a new account names itself and picks a
 * password; an existing account signs in with its password.
 */
export const acceptNewAccountValidator = vine.create({
  name: personName(),
  password: newPassword(),
})

export const acceptExistingAccountValidator = vine.create({
  password: vine.string().minLength(1).maxLength(200),
})

export const profileValidator = vine.create({
  name: personName(),
  nip: vine
    .string()
    .trim()
    .regex(/^[0-9]{18}$/)
    .optional()
    .transform((value) => value || null),
})

export const changePasswordValidator = vine.create({
  current_password: vine.string().minLength(1).maxLength(200),
  password: newPassword(),
})

export const switchRoleValidator = vine.create({
  membership: vine.string().uuid(),
})

/** The operator invites teachers only (D-182). */
export const inviteTeacherValidator = vine.create({
  email: email(),
})

/** Tim SIGRAK invites any role (D-182). */
export const staffInviteValidator = vine.create({
  email: email(),
  role: vine.enum(['principal', 'operator', 'teacher'] as const),
})

const trialDays = () =>
  vine.number().withoutDecimals().min(TRIAL_INPUT_RANGE.min).max(TRIAL_INPUT_RANGE.max)

/**
 * Console trial changes: add days, set a length, or clear the own
 * length (follow the school or the default).
 */
export const trialChangeValidator = vine.create({
  mode: vine.enum(['extend', 'set', 'clear'] as const),
  days: trialDays().optional().requiredWhen('mode', 'in', ['extend', 'set']),
})

export const defaultTrialValidator = vine.create({
  days: trialDays(),
})
