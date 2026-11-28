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
 * Messages already picked, per locale and namespace set. Kept per
 * translations object, so reloaded translations are picked again.
 */
const picked = new WeakMap<object, Map<string, Readonly<Record<string, string>>>>()

/**
 * Flat key → message map for the given namespaces, e.g.
 * { "calendar.title": "Kalender" }. Server-only namespaces are left out.
 * Runs on every request (the Inertia `messages` prop), so the result is
 * kept per namespace set instead of filtering every key again (R1-11).
 * The returned object is frozen and shared.
 */
export function messagesFor(
  locale: string,
  namespaces: string[]
): Readonly<Record<string, string>> {
  const all = i18nManager.getTranslationsFor(locale)
  const wanted = [...new Set(namespaces)]
    .filter((namespace) => !SERVER_ONLY_NAMESPACES.has(namespace))
    .sort()
  const cacheKey = `${locale}|${wanted.join(',')}`
  let cache = picked.get(all)
  if (!cache) {
    cache = new Map()
    picked.set(all, cache)
  }
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const prefixes = wanted.map((namespace) => `${namespace}.`)
  const messages = Object.freeze(
    Object.fromEntries(
      Object.entries(all).filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix)))
    )
  )
  cache.set(cacheKey, messages)
  return messages
}

declare module '@adonisjs/core/http' {
  export interface HttpContext {
    translationNamespaces?: string[]
  }
}
