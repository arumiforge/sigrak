import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import { queueHealth } from '#services/queue/wait_metrics'

/**
 * GET /healthz on any host (Fondasi web-baseline §7): no auth, no
 * session, no data. 200 when the app, PostgreSQL and Redis answer, else
 * 503. Answered before routing, so no session cookie is ever set.
 *
 * GET /healthz/queues: queue wait per queue (D-467) for monitors inside
 * the server network. Requests through Cloudflare carry
 * `CF-Connecting-IP`, which a client cannot remove; those get no answer
 * here and fall through to routing (404).
 */
export default class HealthzMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { request, response } = ctx
    const url = request.url()
    if (
      !['/healthz', '/healthz/queues'].includes(url) ||
      !['GET', 'HEAD'].includes(request.method())
    ) {
      return next()
    }
    if (url === '/healthz/queues' && request.header('cf-connecting-ip')) {
      return next()
    }

    response.header('Cache-Control', 'no-store')
    response.header('X-Content-Type-Options', 'nosniff')
    if (url === '/healthz/queues') {
      try {
        return response.ok(await queueHealth())
      } catch {
        return response.serviceUnavailable({ status: 'error' })
      }
    }
    try {
      await Promise.all([db.rawQuery('select 1'), redis.ping()])
      response.ok({ status: 'ok' })
    } catch {
      response.serviceUnavailable({ status: 'error' })
    }
  }
}
