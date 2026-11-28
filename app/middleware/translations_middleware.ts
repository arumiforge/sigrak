import i18nManager from '@adonisjs/i18n/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Translation files (resources/lang/id/<namespace>.json) every page
 * gets: shared words and actions, the menus, and the error messages a
 * page may need after a failed request.
 */
export const SHARED_NAMESPACES = ['common', 'nav', 'errors'] as const

/**
 * Validation messages are read on the server only (VineJS messages
 * provider) and never reach the browser.
 */
export const VALIDATION_NAMESPACE = 'validation'
const SERVER_ONLY_NAMESPACES = new Set<string>([VALIDATION_NAMESPACE])

/**
 * Names the translation files a route's pages need. The Inertia
 * middleware sends those messages, plus the shared ones, to the
 * browser as the `messages` prop.
 */
export default class TranslationsMiddleware {
  async handle(ctx: HttpContext, next: NextFn, namespaces: string[] = []) {
    ctx.translationNamespaces = [...(ctx.translationNamespaces ?? []), ...namespaces]
    return next()
  }
}

/**
 * Flat key → message map for the given namespaces, e.g.
 * { "calendar.title": "Kalender" }. Server-only namespaces are left out.
 */
export function messagesFor(locale: string, namespaces: string[]): Record<string, string> {
  const all = i18nManager.getTranslationsFor(locale)
  const prefixes = [...new Set(namespaces)]
    .filter((namespace) => !SERVER_ONLY_NAMESPACES.has(namespace))
    .map((namespace) => `${namespace}.`)
  return Object.fromEntries(
    Object.entries(all).filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix)))
  )
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    translationNamespaces?: string[]
  }
}
