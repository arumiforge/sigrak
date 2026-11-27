import { configProvider } from '@adonisjs/core'
import app from '@adonisjs/core/services/app'
import emitter from '@adonisjs/core/services/emitter'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import SessionMiddleware from '@adonisjs/session/session_middleware'
import type { ResolvedSessionConfig, SessionStoreFactory } from '@adonisjs/session/types'
import { areaSessions } from '#config/session'
import { areaForHost, type Area } from '#config/hosts'

type Stores = Record<string, SessionStoreFactory>
type AreaMiddleware = SessionMiddleware<Stores>

/**
 * Session middleware that picks the session config (cookie name,
 * lifetime, SameSite) from the request's hostname, so app., admin. and
 * ujian. never share a session. Requests on any other host get no
 * session (no route matches them anyway).
 */
export default class AreaSessionMiddleware {
  static #instances: Promise<Record<Area, AreaMiddleware>> | undefined

  static #resolve() {
    if (!this.#instances) {
      this.#instances = (async () => {
        const entries = await Promise.all(
          (Object.keys(areaSessions) as Area[]).map(async (area) => {
            const config = await configProvider.resolve<ResolvedSessionConfig>(
              app,
              areaSessions[area]
            )
            if (!config) {
              throw new Error(`Invalid session config for area "${area}"`)
            }
            return [area, new SessionMiddleware<Stores>(config, emitter)] as const
          })
        )
        return Object.fromEntries(entries) as Record<Area, AreaMiddleware>
      })()
    }
    return this.#instances
  }

  async handle(ctx: HttpContext, next: NextFn) {
    const area = areaForHost(ctx.request.hostname())
    if (!area) {
      return next()
    }

    const instances = await AreaSessionMiddleware.#resolve()
    return instances[area].handle(ctx, next)
  }
}
