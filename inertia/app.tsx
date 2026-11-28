import './css/app.css'
import { createRoot } from 'react-dom/client'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react'
import { layoutFor } from '~/layouts/resolve_layout'
import { matches, REDUCED_MOTION_QUERY } from '~/lib/media'

createInertiaApp({
  title: (title) => (title ? `${title} · SIGRAK` : 'SIGRAK'),
  resolve: async (name) => {
    const page = await resolvePageComponent(
      `./pages/${name}.tsx`,
      import.meta.glob<{ default: ResolvedComponent }>('./pages/**/*.tsx')
    )
    return page.default
  },
  // Persistent layout per area, by page folder (layouts/resolve_layout.ts).
  layout: (name) => layoutFor(name),
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />)
  },
  defaults: {
    prefetch: { cacheFor: '30s', hoverDelay: 75 },
    /**
     * Page changes cross-fade the content with a view transition
     * (D-389): only full page visits, never partial reloads or form
     * posts, and never when the visitor asked for less motion.
     */
    visitOptions: (_href, options) => {
      const pageChange = options.method === 'get' && !options.only?.length && !options.preserveState
      return pageChange && !matches(REDUCED_MOTION_QUERY)
        ? { ...options, viewTransition: true }
        : options
    },
  },
  // Thin brand-coloured bar for visits slower than 250 ms.
  progress: {
    color: 'var(--brand)',
    delay: 250,
    showSpinner: false,
  },
})
