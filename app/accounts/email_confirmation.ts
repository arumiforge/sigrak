import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import { areaUrl } from '#config/hosts'
import EmailConfirmationToken from '#models/email_confirmation_token'
import User from '#models/user'
import EmailConfirmationMail from '#mails/email_confirmation_mail'
import { hashToken, newToken, TOKEN_PATTERN, tokenMatches } from '#accounts/tokens'
import { normalizeEmail } from '#accounts/invitations'

/**
 * Sign-up confirmation (D-469). A self sign-up gets a mail with a link;
 * the teacher uses the app meanwhile and sees a reminder until the
 * email is confirmed. Accepting an invitation or using a reset link
 * also confirms it (only the reader of the mailbox has those links).
 *
 * Like the other mailed links, only the token's hash is stored. One
 * open link per user: asking again replaces it. A link works once,
 * for 3 days, and only for the address it was sent to.
 */
export const CONFIRMATION_VALID_HOURS = 72

/**
 * Mails a new confirmation link through the queue. Returns false, and
 * sends nothing, when the email is already confirmed.
 */
export async function sendEmailConfirmation(user: User): Promise<boolean> {
  if (user.emailVerifiedAt) return false

  const { token, hash } = newToken()
  const expiresAt = DateTime.now().plus({ hours: CONFIRMATION_VALID_HOURS })
  const email = normalizeEmail(user.email)
  await db.transaction(async (trx) => {
    await EmailConfirmationToken.query({ client: trx }).where('user_id', user.id).delete()
    await EmailConfirmationToken.create(
      { userId: user.id, email, tokenHash: hash, expiresAt },
      { client: trx }
    )
  })

  await mail.sendLater(
    new EmailConfirmationMail({
      email: user.email,
      name: user.name,
      url: areaUrl('app', `/konfirmasi-email/${token}`),
      expiresAt,
    })
  )
  return true
}

/**
 * The open link for a token, with its user, or null (unknown, used,
 * expired, or the account's address changed since: one answer).
 */
async function openLink(token: string, client: QueryClientContract, forUpdate = false) {
  if (!TOKEN_PATTERN.test(token)) return null
  const query = EmailConfirmationToken.query({ client }).where('token_hash', hashToken(token))
  if (forUpdate) query.forUpdate()
  const row = await query.first()
  if (!row || !tokenMatches(token, row.tokenHash) || row.expiresAt <= DateTime.now()) return null
  const user = await User.find(row.userId, { client })
  if (!user || normalizeEmail(user.email) !== row.email) return null
  return { row, user }
}

/** The address a valid link confirms, or null. */
export async function findConfirmationEmail(token: string): Promise<string | null> {
  const open = await openLink(token, db.connection())
  return open?.user.email ?? null
}

/**
 * Confirms the email of a valid link and spends it. Returns the user,
 * or null when the link is no longer valid.
 */
export async function confirmEmail(token: string): Promise<User | null> {
  if (!TOKEN_PATTERN.test(token)) return null
  return db.transaction(async (trx) => {
    const open = await openLink(token, trx, true)
    if (!open) return null
    open.user.useTransaction(trx)
    open.user.emailVerifiedAt = open.user.emailVerifiedAt ?? DateTime.now()
    await open.user.save()
    await open.row.delete()
    return open.user
  })
}

/**
 * Removes a user's open confirmation link, once the email is confirmed
 * another way (invitation, reset link).
 */
export async function spendConfirmationLinks(userId: number, client: QueryClientContract) {
  await EmailConfirmationToken.query({ client }).where('user_id', userId).delete()
}
