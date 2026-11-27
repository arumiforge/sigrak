import { defineConfig } from '@adonisjs/static'

/**
 * Built assets carry a content hash in their file name, so they are
 * cached for a year (Fondasi assets.md). HTML is never cached long
 * (SecurityHeadersMiddleware sets no-store on pages).
 */
const staticServerConfig = defineConfig({
  enabled: true,
  prefixes: ['/assets', '/favicon.ico', '/robots.txt'],
  etag: true,
  lastModified: true,
  dotFiles: 'ignore',
  headers: (path) =>
    path.includes('/assets/')
      ? { 'Cache-Control': 'public, max-age=31536000, immutable' }
      : { 'Cache-Control': 'public, max-age=300' },
})

export default staticServerConfig
