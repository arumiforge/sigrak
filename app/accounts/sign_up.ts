import { DateTime } from 'luxon'
import User from '#models/user'
import { EmailTakenError } from '#accounts/errors'
import { normalizeEmail } from '#accounts/invitations'

/**
 * Self sign-up (D-459): a teacher makes an account alone (SIGRAK Guru)
 * and the trial starts now. The account belongs to no school until an
 * operator, or Tim SIGRAK, invites the same email; accepting that
 * invitation joins this same account to the school.
 */
export async function signUp(input: { name: string; email: string; password: string }) {
  const email = normalizeEmail(input.email)
  const taken = await User.query().whereRaw('lower(email) = ?', [email]).first()
  if (taken) throw new EmailTakenError()

  try {
    return await User.create({
      name: input.name.trim(),
      email,
      password: input.password,
      nip: null,
      trialStartedAt: DateTime.now(),
    })
  } catch (error) {
    // Two sign-ups for one email at the same moment: the unique index decides.
    if ((error as { code?: string }).code === '23505') throw new EmailTakenError()
    throw error
  }
}
