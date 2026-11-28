import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Mailed link tokens (invitations, password reset; D-182, D-183): 32
 * random bytes as base64url (43 characters). Only the SHA-256 hash is
 * stored, so a database copy holds no usable link.
 */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function newToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token) }
}

export function hashToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/**
 * Whether a presented token matches a stored hash, compared in
 * constant time. A malformed token never matches.
 */
export function tokenMatches(token: string, storedHash: string) {
  if (!TOKEN_PATTERN.test(token)) return false
  const presented = Buffer.from(hashToken(token), 'hex')
  const stored = Buffer.from(storedHash, 'hex')
  return presented.length === stored.length && timingSafeEqual(presented, stored)
}
