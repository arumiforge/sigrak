/*
|--------------------------------------------------------------------------
| HTTP kernel file
|--------------------------------------------------------------------------
|
| Registers the middleware with the server and the router.
|
*/

import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.errorHandler(() => import('#exceptions/handler'))

/**
 * Runs on every request, even without a matching route.
 */
server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('#middleware/healthz_middleware'),
  () => import('@adonisjs/static/static_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
  () => import('@adonisjs/vite/vite_middleware'),
  () => import('#middleware/inertia_middleware'),
])

/**
 * Runs on every request with a matching route.
 */
router.use([
  () => import('#middleware/security_headers_middleware'),
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('#middleware/area_session_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
  () => import('#middleware/detect_user_locale_middleware'),
])

/**
 * Named middleware, assigned to routes explicitly.
 */
export const middleware = router.named({
  guest: () => import('#middleware/guest_middleware'),
  auth: () => import('#middleware/auth_middleware'),
  translations: () => import('#middleware/translations_middleware'),
})
