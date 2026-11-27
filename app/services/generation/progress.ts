import { createHmac, timingSafeEqual } from 'node:crypto'
import transmit from '@adonisjs/transmit/services/main'
import env from '#start/env'
import type Generation from '#models/generation'
import { snapshotOf, type GenerationSnapshot } from '#services/generation/snapshot'

/**
 * Live progress of generations over Transmit (SSE, D-388): one channel
 * per user. Users have no public id, so the channel carries an opaque
 * token (HMAC of the user id with the app key) instead of the id.
 */
export function channelToken(userId: number) {
  return createHmac('sha256', env.get('APP_KEY').release())
    .update(`generations:${userId}`)
    .digest('base64url')
    .slice(0, 32)
}

export function userChannel(userId: number) {
  return `users/${channelToken(userId)}/generations`
}

export function ownsChannelToken(userId: number, token: string) {
  const expected = Buffer.from(channelToken(userId))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export type ProgressMessage = {
  type: 'generation'
  /** When the state changed on the server (epoch ms), for latency checks. */
  changedAt: number
  generation: GenerationSnapshot
}

/**
 * Sends the generation's current state to its owner's channel. A full
 * snapshot (not a delta), so a client that missed a message is right
 * again with the next one.
 */
export async function broadcastProgress(generation: Generation, changedAt = Date.now()) {
  const message: ProgressMessage = {
    type: 'generation',
    changedAt,
    generation: await snapshotOf(generation),
  }
  transmit.broadcast(userChannel(generation.userId), message)
}
