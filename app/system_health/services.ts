import app from '@adonisjs/core/services/app'
import redis from '@adonisjs/redis/services/main'
import { mailDelivery, type MailSource } from '#integrations/mail'
import { cacheConnectionReady } from '#services/shared_cache'

/**
 * The services around the app that Kesehatan sistem checks (R2-09):
 *
 * - the cache Redis (`redis-cache`, D-480): reachable or not, and its
 *   memory. Losing it only slows pages, so a down cache is a warning,
 *   never an outage, and `/healthz` does not check it.
 * - mail (D-431): where the settings come from and whether mail is
 *   really sent. In production a setup that sends nothing is a warning.
 */

export type CacheStatus = {
  reachable: boolean
  usedBytes: number | null
  maxBytes: number | null
}

export type MailStatus = {
  source: MailSource
  sends: boolean
  /** True in production when no mail would leave the server. */
  warn: boolean
}

export type ServicesStatus = { cache: CacheStatus; mail: MailStatus }

/** What the cache probe reads (a fake in tests). */
export type CacheProbe = () => Promise<{ info: string } | null>

const PROBE_TIMEOUT_MS = 500

/**
 * Reads `INFO memory` on the `cache` connection. Null when the
 * connection is not ready within a short time or does not answer in
 * time (the connection has no offline queue).
 */
export const cacheProbe: CacheProbe = async () => {
  if (!(await cacheConnectionReady(PROBE_TIMEOUT_MS))) return null
  const connection = redis.connection('cache')
  let timer: NodeJS.Timeout | undefined
  try {
    const info = await Promise.race([
      connection.ioConnection.info('memory'),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), PROBE_TIMEOUT_MS)
      }),
    ])
    return info === null ? null : { info }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function infoNumber(info: string, field: string) {
  const match = info.match(new RegExp(`^${field}:(\\d+)`, 'm'))
  return match ? Number(match[1]) : null
}

export async function collectCache(probe: CacheProbe = cacheProbe): Promise<CacheStatus> {
  const answer = await probe()
  if (!answer) return { reachable: false, usedBytes: null, maxBytes: null }
  const max = infoNumber(answer.info, 'maxmemory')
  return {
    reachable: true,
    usedBytes: infoNumber(answer.info, 'used_memory'),
    // 0 means "no cap" (development); show it as unknown.
    maxBytes: max && max > 0 ? max : null,
  }
}

export async function collectMail(
  options: { production?: boolean; delivery?: typeof mailDelivery } = {}
): Promise<MailStatus> {
  const production = options.production ?? app.inProduction
  const { source, sends } = await (options.delivery ?? mailDelivery)()
  return { source, sends, warn: production && !sends }
}

export async function collectServices(
  options: { probe?: CacheProbe; production?: boolean; delivery?: typeof mailDelivery } = {}
): Promise<ServicesStatus> {
  const [cache, mail] = await Promise.all([
    collectCache(options.probe),
    collectMail({ production: options.production, delivery: options.delivery }),
  ])
  return { cache, mail }
}
