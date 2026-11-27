import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/shield'

/**
 * Security headers and CSRF (Fondasi web-baseline §1). Everything the
 * page needs is bundled and self-hosted, so the policy allows only
 * 'self' plus nonced inline scripts (the Vite React refresh preamble in
 * development).
 */
const shieldConfig = defineConfig({
  csp: {
    enabled: true,
    directives: {
      defaultSrc: [`'self'`],
      scriptSrc: [`'self'`, '@nonce', '@viteUrl'],
      // Radix and Sonner set inline style attributes.
      styleSrc: [`'self'`, `'unsafe-inline'`, '@viteUrl'],
      imgSrc: [`'self'`, 'data:'],
      fontSrc: [`'self'`, '@viteUrl'],
      connectSrc: app.inDev ? [`'self'`, 'ws:', 'wss:', '@viteUrl'] : [`'self'`],
      objectSrc: [`'none'`],
      baseUri: [`'self'`],
      formAction: [`'self'`],
      frameAncestors: [`'self'`],
    },
    reportOnly: false,
  },

  csrf: {
    enabled: true,
    exceptRoutes: [],
    // Inertia's HTTP client sends the XSRF-TOKEN cookie back as a header.
    enableXsrfCookie: true,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },

  xFrame: {
    enabled: true,
    action: 'SAMEORIGIN',
  },

  hsts: {
    enabled: true,
    maxAge: '180 days',
  },

  contentTypeSniffing: {
    enabled: true,
  },
})

export default shieldConfig
