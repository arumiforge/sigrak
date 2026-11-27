import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import type { AiConfig } from '#config/ai'
import AiCredential from '#models/ai_credential'

const store = () => redis.connection('ai')
const settings = () => app.config.get<AiConfig>('ai')

/** Google resets daily quotas at midnight Pacific time. */
const PACIFIC = 'America/Los_Angeles'

function dailyKey(credentialId: number, model: string) {
  const day = DateTime.now().setZone(PACIFIC).toISODate()
  return `daily:${credentialId}:${model}:${day}`
}

/**
 * No key can take the call. `availableAt` is the earliest time one is
 * usable again, when that is known (the teacher is told to retry then).
 */
export class NoUsableKeyError extends Error {
  constructor(
    readonly reason: 'no_keys' | 'all_unavailable',
    readonly availableAt: DateTime | null
  ) {
    super(reason === 'no_keys' ? 'The user has no active AI key' : 'Every AI key is unavailable')
    this.name = 'NoUsableKeyError'
  }
}

/**
 * Health state of keys: cooldowns per (key, model) and daily counters
 * in Redis (D-128), circuit breaker and invalid state in the database.
 */
export const keyHealth = {
  nextPacificMidnight(): DateTime {
    return DateTime.now().setZone(PACIFIC).plus({ days: 1 }).startOf('day')
  },

  async coolDown(credentialId: number, model: string, until: DateTime) {
    const ms = Math.ceil(until.diffNow().as('milliseconds'))
    if (ms > 0) {
      await store().set(`cooldown:${credentialId}:${model}`, until.toISO()!, 'PX', ms)
    }
  },

  async cooldownUntil(credentialId: number, model: string): Promise<DateTime | null> {
    const ms = await store().pttl(`cooldown:${credentialId}:${model}`)
    return ms > 0 ? DateTime.now().plus({ milliseconds: ms }) : null
  },

  /** Counts one request of a key on a model for today (Pacific). */
  async countRequest(credentialId: number, model: string) {
    const key = dailyKey(credentialId, model)
    const count = await store().incr(key)
    if (count === 1) {
      await store().expire(key, 2 * 24 * 3600)
    }
    return count
  },

  async dailyCount(credentialId: number, model: string) {
    return Number((await store().get(dailyKey(credentialId, model))) ?? 0)
  },

  async recordSuccess(credentialId: number) {
    await AiCredential.query().where('id', credentialId).update({
      consecutive_failures: 0,
      circuit_open_until: null,
      last_success_at: new Date(),
    })
  },

  /**
   * A transient failure or timeout. After `threshold` in a row the
   * circuit opens; when it ends, the key gets calls again and the next
   * failure reopens it at once (one probe).
   */
  async recordFailure(credentialId: number) {
    const { threshold, openMs } = settings().circuitBreaker
    await db.rawQuery(
      `UPDATE ai_credentials
          SET consecutive_failures = consecutive_failures + 1,
              circuit_open_until = CASE
                WHEN consecutive_failures + 1 >= ? THEN now() + (? * interval '1 millisecond')
                ELSE circuit_open_until END,
              updated_at = now()
        WHERE id = ?`,
      [threshold, openMs, credentialId]
    )
  },

  async markInvalid(credentialId: number, reason: string) {
    await AiCredential.query()
      .where('id', credentialId)
      .update({ status: 'invalid', invalid_reason: reason })
  },
}

/**
 * Picks the key for a call (ai-provider-engine.md, Key selection):
 * sticky per generation, then round robin over the usable keys, with
 * backup keys only when no normal key is usable (D-119).
 */
export class KeySelector {
  async select(
    userId: number,
    model: string,
    options: { pinnedId?: number | null; excluded?: Set<number> } = {}
  ): Promise<AiCredential> {
    const credentials = await AiCredential.query()
      .where('user_id', userId)
      .where('status', 'active')
      .orderBy('id', 'asc')
    if (credentials.length === 0) {
      throw new NoUsableKeyError('no_keys', null)
    }

    const now = DateTime.now()
    const limit = settings().dailyLimits[model]
    const usable: AiCredential[] = []
    let availableAt: DateTime | null = null
    const later = (time: DateTime) => {
      if (!availableAt || time < availableAt) availableAt = time
    }

    for (const credential of credentials) {
      const cooldown = await keyHealth.cooldownUntil(credential.id, model)
      const circuit = credential.circuitOpenUntil
      const overDailyLimit =
        limit !== undefined && (await keyHealth.dailyCount(credential.id, model)) >= limit

      // A key excluded for this step still tells when it is usable again.
      if (cooldown) later(cooldown)
      else if (circuit && circuit > now) later(circuit)
      else if (overDailyLimit) later(keyHealth.nextPacificMidnight())
      else if (!options.excluded?.has(credential.id)) usable.push(credential)
    }

    const pinned = usable.find((credential) => credential.id === options.pinnedId)
    if (pinned) {
      return pinned
    }

    const normal = usable.filter((credential) => !credential.isBackup)
    const pool = normal.length > 0 ? normal : usable
    if (pool.length === 0) {
      throw new NoUsableKeyError('all_unavailable', availableAt)
    }

    const turn = await store().incr(`rr:${userId}`)
    return pool[(turn - 1) % pool.length]
  }
}
