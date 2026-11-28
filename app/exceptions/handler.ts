import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'
import { errors as limiterErrors } from '@adonisjs/limiter'

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction

  /**
   * Friendly Indonesian error pages with a way back (Fondasi
   * web-baseline §10) in production; verbose errors in development.
   */
  protected renderStatusPages = app.inProduction

  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
    '403': (_, ctx) => this.#errorPage(ctx, 'forbidden'),
    '404': (_, ctx) => this.#errorPage(ctx, 'not_found'),
    '500..599': (_, ctx) => this.#errorPage(ctx, 'server_error'),
  }

  #errorPage(ctx: HttpContext, kind: 'forbidden' | 'not_found' | 'server_error') {
    // The shared namespaces (errors among them) are always sent.
    ctx.translationNamespaces = []
    return ctx.inertia.render('errors/error', { kind })
  }

  async handle(error: unknown, ctx: HttpContext) {
    /**
     * A rate-limited form post goes back to the form with a toast
     * instead of a bare 429 page.
     */
    if (error instanceof limiterErrors.E_TOO_MANY_REQUESTS && ctx.session) {
      ctx.session.flash('error', error.getResponseMessage(ctx))
      return ctx.response.redirect().back('/masuk')
    }
    return super.handle(error, ctx)
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
