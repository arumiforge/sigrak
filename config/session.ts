import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, stores } from '@adonisjs/session'
import type { Area } from '#config/hosts'

/**
 * Per-area session settings. Every area has its own cookie name; the
 * cookies carry no Domain attribute, so each one stays on its own
 * hostname. Staff sessions end after 60 minutes without activity and
 * use SameSite=Strict (Fondasi web-baseline §1).
 */
const areaOptions: Record<Area, { cookieName: string; age: string; sameSite: 'lax' | 'strict' }> = {
  app: { cookieName: 'sigrak_app_session', age: '2h', sameSite: 'lax' },
  admin: { cookieName: 'sigrak_admin_session', age: '60m', sameSite: 'strict' },
  exam: { cookieName: 'sigrak_exam_session', age: '3h', sameSite: 'lax' },
}

function sessionConfigFor(area: Area) {
  const options = areaOptions[area]

  return defineConfig({
    enabled: true,
    cookieName: options.cookieName,
    clearWithBrowser: false,
    age: options.age,

    cookie: {
      path: '/',
      httpOnly: true,
      secure: app.inProduction,
      sameSite: options.sameSite,
    },

    store: env.get('SESSION_DRIVER'),

    stores: {
      cookie: stores.cookie(),
      redis: stores.redis({ connection: 'main' }),
    },
  })
}

/**
 * Resolved by AreaSessionMiddleware, one config per area.
 */
export const areaSessions: Record<Area, ReturnType<typeof sessionConfigFor>> = {
  app: sessionConfigFor('app'),
  admin: sessionConfigFor('admin'),
  exam: sessionConfigFor('exam'),
}

export const sessionCookieNames: Record<Area, string> = {
  app: areaOptions.app.cookieName,
  admin: areaOptions.admin.cookieName,
  exam: areaOptions.exam.cookieName,
}

/**
 * The package's own default (used by its Japa plugins and the session
 * collection) is the app area.
 */
export default areaSessions.app
