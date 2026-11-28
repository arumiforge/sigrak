import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import { areaUrl } from '#config/hosts'
import PasswordResetToken from '#models/password_reset_token'
import User from '#models/user'
import PasswordResetMail from '#mails/password_reset_mail'
import { hashToken, newToken, TOKEN_PATTERN, tokenMatches } from '#accounts/tokens'
import { normalizeEmail } from '#accounts/invitations'

/**
 * "Lupa kata sandi" for school users (D-183). The request gets the same
 * answer whether or not the email has an account. A link works once,
 * for 60 minutes; asking again replaces the open link. Using a link
 * also marks the email as verified, since only its reader has it.
 */
export const RESET_VALID_MINUTES = 60

export async function requestPasswordReset(email: string) {
  const user = await User.query()
    .whereRaw('lower(email) = ?', [normalizeEmail(email)])
    .first()
  if (!user) return

  const { token, hash } = newToken()
  const expiresAt = DateTime.now().plus({ minutes: RESET_VALID_MINUTES })
  await db.transaction(async (trx) => {
    await PasswordResetToken.query({ client: trx }).where('user_id', user.id).delete()
    await PasswordResetToken.create(
      { userId: user.id, tokenHash: hash, expiresAt },
      { client: trx }
    )
  })

  await mail.sendLater(
    new PasswordResetMail({
      email: user.email,
      name: user.name,
      url: areaUrl('app', `/kata-sandi-baru/${token}`),
      expiresAt,
    })
  )
}

/**
 * The user a valid reset link belongs to, or null (unknown, used or
 * expired: one neutral answer).
 */
export async function findResetUser(token: string): Promise<User | null> {
  if (!TOKEN_PATTERN.test(token)) return null
  const row = await PasswordResetToken.query()
    .where('token_hash', hashToken(token))
    .where('expires_at', '>', DateTime.now().toSQL()!)
    .preload('user')
    .first()
  return row && tokenMatches(token, row.tokenHash) ? row.user : null
}

/**
 * Sets the new password and spends the link. Returns the user, or null
 * when the link is no longer valid.
 */
export async function resetPassword(token: string, password: string): Promise<User | null> {
  if (!TOKEN_PATTERN.test(token)) return null
  return db.transaction(async (trx) => {
    const row = await PasswordResetToken.query({ client: trx })
      .where('token_hash', hashToken(token))
      .forUpdate()
      .first()
    if (!row || !tokenMatches(token, row.tokenHash) || row.expiresAt <= DateTime.now()) {
      return null
    }
    const user = await User.findOrFail(row.userId, { client: trx })
    user.password = password
    user.emailVerifiedAt = user.emailVerifiedAt ?? DateTime.now()
    await user.save()
    await row.delete()
    return user
  })
}
