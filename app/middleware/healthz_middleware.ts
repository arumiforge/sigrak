import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'

/**
 * GET /healthz on any host (Fondasi web-baseline §7): no auth, no
 * session, no data. 200 when the app, PostgreSQL and Redis answer, else
 * 503. Answered before routing, so no session cookie is ever set.
 */
export default class HealthzMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { request, response } = ctx
    if (request.url() !== '/healthz' || !['GET', 'HEAD'].includes(request.method())) {
      return next()
    }

    response.header('Cache-Control', 'no-store')
    response.header('X-Content-Type-Options', 'nosniff')
    try {
      await Promise.all([db.rawQuery('select 1'), redis.ping()])
      response.ok({ status: 'ok' })
    } catch {
      response.serviceUnavailable({ status: 'error' })
    }
  }
}
