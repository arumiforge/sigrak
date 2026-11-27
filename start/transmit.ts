/*
|--------------------------------------------------------------------------
| Transmit (server-sent events)
|--------------------------------------------------------------------------
|
| The SSE stream and the subscribe/unsubscribe endpoints live on app.
| only, behind the school users' session. Each user may listen to their
| own channel only. Loaded by the web process (and tests), never by ace
| commands, so a migration does not open the Redis transport.
|
*/

import router from '@adonisjs/core/services/router'
import transmit from '@adonisjs/transmit/services/main'
import { middleware } from '#start/kernel'
import { hosts } from '#config/hosts'
import { ownsChannelToken } from '#services/generation/progress'

router
  .group(() => {
    transmit.registerRoutes()
  })
  .domain(hosts.app)
  .use(middleware.auth({ guard: 'web' }))

transmit.authorize<{ token: string }>('users/:token/generations', (ctx, { token }) => {
  const user = ctx.auth.use('web').user
  return Boolean(user) && ownsChannelToken(user!.id, token)
})
