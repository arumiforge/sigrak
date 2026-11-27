import i18nManager from '@adonisjs/i18n/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Names the translation files (resources/lang/id/<namespace>.json) a
 * route's pages need. The Inertia middleware sends those messages, plus
 * "common", to the browser as the `messages` prop.
 */
export default class TranslationsMiddleware {
  async handle(ctx: HttpContext, next: NextFn, namespaces: string[] = []) {
    ctx.translationNamespaces = [...(ctx.translationNamespaces ?? []), ...namespaces]
    return next()
  }
}

/**
 * Flat key → message map for the given namespaces, e.g.
 * { "calendar.title": "Kalender" }.
 */
export function messagesFor(locale: string, namespaces: string[]): Record<string, string> {
  const all = i18nManager.getTranslationsFor(locale)
  const prefixes = [...new Set(namespaces)].map((namespace) => `${namespace}.`)
  return Object.fromEntries(
    Object.entries(all).filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix)))
  )
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    translationNamespaces?: string[]
  }
}
