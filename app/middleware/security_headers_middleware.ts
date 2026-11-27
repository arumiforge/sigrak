import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Headers Shield does not set (Fondasi web-baseline §1, assets.md):
 * referrer policy, permissions policy, and no long caching of pages.
 * CSP, HSTS, X-Frame-Options and nosniff come from config/shield.ts.
 */
export default class SecurityHeadersMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const response = ctx.response
    response.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.header(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
    )
    response.header('Cross-Origin-Opener-Policy', 'same-origin')

    await next()

    if (!response.getHeader('Cache-Control')) {
      response.header('Cache-Control', 'no-store')
    }
  }
}
