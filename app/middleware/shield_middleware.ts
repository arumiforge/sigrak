import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ShieldMiddleware from '@adonisjs/shield/shield_middleware'
import type { ShieldConfig } from '@adonisjs/shield/types'
import { isPublicHost } from '#config/hosts'

/**
 * Shield (config/shield.ts) on every host. The public site on the bare
 * domain (D-435) has no session, so it gets the same headers (CSP,
 * HSTS, frame and sniffing guards) without CSRF: it only answers GET
 * and sets no cookie.
 */
export default class SiteShieldMiddleware {
  static #publicShield: Promise<ShieldMiddleware> | undefined

  static #public() {
    if (!this.#publicShield) {
      this.#publicShield = (async () => {
        const config = app.config.get<ShieldConfig>('shield', {})
        const encryptionManager = await app.container.make('encryption')
        const encryption = encryptionManager.use()
        const edgeModule = app.usingEdgeJS ? await import('edge.js') : undefined
        const edge = edgeModule?.default
        return new ShieldMiddleware({ ...config, csrf: { enabled: false } }, encryption, edge)
      })()
    }
    return this.#publicShield
  }

  async handle(ctx: HttpContext, next: NextFn) {
    const shield = isPublicHost(ctx.request.hostname())
      ? await SiteShieldMiddleware.#public()
      : await app.container.make(ShieldMiddleware)
    return shield.handle(ctx, next)
  }
}
